// 記述（1つの文）の追加・編集フォーム。
// 本文は [[名前]] で書き、保存時に星へのリンク [[@ID]] に変換する。
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useCosmos } from '../store/useCosmos';
import { SOURCE_TYPES, type KnowledgeNode, type SourceType } from '../types';
import { displayName, linkToken, plainText } from '../lib/knowledge';
import { normalize, searchNodes } from '../lib/search';
import { SEARCH_SITES, openSearch } from '../lib/externalSearch';

const TOPICS = ['定義', '語源', '歴史', '人物', '数値', '影響'];
const ID_LINK_RE = /\[\[@([^\]]+)\]\]/g;
const NAME_LINK_RE = /\[\[([^\]@][^\]]*)\]\]/g;

/** 保存されている本文（[[@ID]]）を、編集しやすい形（[[名前]]）にする */
function toEditable(text: string, byId: Map<string, KnowledgeNode>): string {
  return text.replace(ID_LINK_RE, (_, id: string) => {
    const n = byId.get(id);
    return n ? `[[${displayName(n)}]]` : '';
  });
}

/** 本文中に出てくる既存の星の名前を、リンクの候補として探す（確定は人がする） */
function findLinkCandidates(text: string, nodes: KnowledgeNode[], selfId: string): KnowledgeNode[] {
  const outside = normalize(text.replace(NAME_LINK_RE, ' '));
  const linked = new Set([...text.matchAll(NAME_LINK_RE)].map((m) => normalize(m[1])));
  return nodes.filter((n) => {
    if (n.id === selfId || linked.has(normalize(displayName(n)))) return false;
    return [n.title, ...n.aliases].some((name) => name.length >= 2 && outside.includes(normalize(name)));
  });
}

export function StatementForm({ starId, statementId, onClose }: { starId: string; statementId: string | null; onClose: () => void }) {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const allSources = useCosmos((s) => s.sources);
  const { addStatement, updateStatement, ensureStar, addSource } = useCosmos.getState();
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const star = byId.get(starId);
  const editing = statementId ? statements.find((s) => s.id === statementId) : undefined;

  const [text, setText] = useState(editing ? toEditable(editing.text, byId) : '');
  const [kind, setKind] = useState<'fact' | 'opinion'>(editing?.kind ?? 'fact');
  const [topic, setTopic] = useState(editing?.topic ?? '');
  const [sourceIds, setSourceIds] = useState<string[]>(editing?.sourceIds ?? []);
  const [linkQuery, setLinkQuery] = useState<string | null>(null);
  const [newSource, setNewSource] = useState<{ type: SourceType; title: string; url: string; author: string; page: string } | null>(null);
  const [sourcePick, setSourcePick] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const candidates = useMemo(() => findLinkCandidates(text, nodes, starId), [text, nodes, starId]);
  const linkResults = useMemo(() => (linkQuery ? searchNodes(nodes, linkQuery, 6) : []), [nodes, linkQuery]);
  const pickableSources = useMemo(() => {
    const q = normalize(sourcePick);
    if (!q) return [];
    return allSources.filter((s) => !sourceIds.includes(s.id) && normalize(s.title + s.url).includes(q)).slice(0, 5);
  }, [allSources, sourcePick, sourceIds]);

  if (!star) return null;

  /** カーソル位置に [[名前]] を差し込む */
  const insertLink = (name: string) => {
    const el = textRef.current;
    const pos = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const token = `[[${name}]]`;
    setText(text.slice(0, pos) + token + text.slice(end));
    setLinkQuery(null);
  };

  /** 本文中の名前をそのまま [[ ]] で囲む（自動検出した候補の採用） */
  const wrapName = (n: KnowledgeNode) => {
    const names = [n.title, ...n.aliases].sort((a, b) => b.length - a.length);
    for (const name of names) {
      const idx = text.indexOf(name);
      if (idx >= 0) {
        setText(text.slice(0, idx) + `[[${displayName(n)}]]` + text.slice(idx + name.length));
        return;
      }
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    // [[名前]] を [[@ID]] に変換。登録されていない名前は「まだ知らない星」を作る
    const stored = text.trim().replace(NAME_LINK_RE, (_, raw: string) => {
      const name = raw.trim();
      const found =
        nodes.find((n) => displayName(n) === name) ??
        nodes.find((n) => n.title === name) ??
        nodes.find((n) => n.aliases.includes(name));
      return linkToken((found ?? ensureStar(name, starId)).id);
    });
    const input = { text: stored, kind, topic: topic.trim(), sourceIds: kind === 'fact' ? sourceIds : [] };
    if (editing) updateStatement(editing.id, input);
    else addStatement(starId, input);
    onClose();
  };

  const previewQuery = (() => {
    const plain = plainText(text.replace(NAME_LINK_RE, (_, n: string) => n), byId);
    return plain.includes(star.title) ? plain : `${star.title} ${plain}`;
  })();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? '記述を編集' : '記述を追加'}<span className="muted small">　{displayName(star)}</span></h2>

        <div className="field">
          <span>区分</span>
          <div className="chips">
            <button type="button" className={kind === 'fact' ? 'chip active' : 'chip'} onClick={() => setKind('fact')}>事実</button>
            <button type="button" className={kind === 'opinion' ? 'chip active' : 'chip'} onClick={() => setKind('opinion')}>意見（自分の考え）</button>
          </div>
          <span className="muted small">
            {kind === 'fact' ? '出典で確かめられること。他人の主張（〇〇は△△と主張した）も事実です。' : '自分の考え・発見。事実とは区別して表示されます。'}
          </span>
        </div>

        <label>
          本文（1つの文）<span className="req">必須</span>
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="例：[[プラトン]]は彼の弟子である。"
            autoFocus
          />
        </label>
        <div className="link-tools">
          <button type="button" className="small-btn" onClick={() => setLinkQuery(linkQuery === null ? '' : null)}>
            ＋ リンクを挿入
          </button>
          <span className="muted small">[[名前]] と書いてもリンクになります</span>
        </div>
        {linkQuery !== null && (
          <div className="link-picker">
            <input
              className="search-input"
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="リンクする星を検索"
              autoFocus
            />
            <ul className="search-results">
              {linkResults.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => insertLink(displayName(n))}>
                    <span className="result-title">{displayName(n)}</span>
                    {n.status === 'unknown' && <span className="muted result-cat">まだ知らない星</span>}
                  </button>
                </li>
              ))}
              {linkQuery.trim() && !linkResults.some((n) => displayName(n) === linkQuery.trim()) && (
                <li>
                  <button type="button" onClick={() => insertLink(linkQuery.trim())}>
                    <span className="result-title">「{linkQuery.trim()}」を新しくリンクする</span>
                    <span className="muted result-cat">まだ知らない星になります</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
        {candidates.length > 0 && (
          <div className="link-candidates">
            <span className="muted small">リンクの候補（押すとリンクになります）：</span>
            {candidates.slice(0, 6).map((n) => (
              <button type="button" key={n.id} className="chip small" onClick={() => wrapName(n)}>
                {displayName(n)}
              </button>
            ))}
          </div>
        )}

        <label>
          話題（任意）
          <input value={topic} onChange={(e) => setTopic(e.target.value)} list="topic-list" placeholder="例：語源" />
          <datalist id="topic-list">
            {TOPICS.map((t) => <option key={t} value={t} />)}
          </datalist>
        </label>

        {kind === 'fact' && (
          <div className="field">
            <span>出典（{sourceIds.length}）</span>
            {sourceIds.length === 0 && <span className="muted small">出典を付けると、あとで見返せます。</span>}
            <ul className="source-list">
              {sourceIds.map((id) => {
                const src = allSources.find((s) => s.id === id);
                return (
                  <li key={id} className="source-row">
                    <span>{src?.title ?? '（不明な出典）'}</span>
                    <button type="button" className="icon-btn small" aria-label="この出典を外す" onClick={() => setSourceIds(sourceIds.filter((x) => x !== id))}>×</button>
                  </li>
                );
              })}
            </ul>
            <div className="search-sites">
              <span className="muted">調べる：</span>
              {SEARCH_SITES.map((site) => (
                <button type="button" key={site.key} className="small-btn" onClick={() => openSearch(site.url(previewQuery))}>{site.label}</button>
              ))}
            </div>
            {!newSource && (
              <div className="source-add">
                <input
                  className="search-input"
                  value={sourcePick}
                  onChange={(e) => setSourcePick(e.target.value)}
                  placeholder="登録済みの出典から探す"
                />
                {pickableSources.length > 0 && (
                  <ul className="search-results">
                    {pickableSources.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => { setSourceIds([...sourceIds, s.id]); setSourcePick(''); }}>
                          <span className="result-title">{s.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="small-btn" onClick={() => setNewSource({ type: 'web', title: '', url: '', author: '', page: '' })}>
                  ＋ 新しい出典を登録
                </button>
              </div>
            )}
            {newSource && (
              <div className="source-new">
                <div className="chips wrap">
                  {(Object.keys(SOURCE_TYPES) as SourceType[]).map((t) => (
                    <button type="button" key={t} className={newSource.type === t ? 'chip active small' : 'chip small'} onClick={() => setNewSource({ ...newSource, type: t })}>
                      {SOURCE_TYPES[t]}
                    </button>
                  ))}
                </div>
                <input value={newSource.title} onChange={(e) => setNewSource({ ...newSource, title: e.target.value })} placeholder="タイトル（必須）例：Wikipedia：ソクラテス" />
                {newSource.type !== 'book' && (
                  <input value={newSource.url} onChange={(e) => setNewSource({ ...newSource, url: e.target.value })} type="url" inputMode="url" placeholder="URL" />
                )}
                <input value={newSource.author} onChange={(e) => setNewSource({ ...newSource, author: e.target.value })} placeholder="著者・発行元（任意）" />
                {newSource.type === 'book' && (
                  <input value={newSource.page} onChange={(e) => setNewSource({ ...newSource, page: e.target.value })} placeholder="ページ（任意）" />
                )}
                <div className="chips">
                  <button type="button" className="small-btn" onClick={() => setNewSource(null)}>やめる</button>
                  <button
                    type="button"
                    className="small-btn primary"
                    disabled={!newSource.title.trim()}
                    onClick={() => {
                      const src = addSource({ ...newSource, title: newSource.title.trim(), url: newSource.url.trim() });
                      setSourceIds([...sourceIds, src.id]);
                      setNewSource(null);
                    }}
                  >
                    出典を追加
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="submit" className="primary" disabled={!text.trim()}>{editing ? '保存' : '追加'}</button>
        </div>
      </form>
    </div>
  );
}
