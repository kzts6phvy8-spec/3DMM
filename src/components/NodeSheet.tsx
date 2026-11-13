// 星をタップしたときに画面下から出るパネル。
// プレビュー（概要だけ）と、星のページ（記述・出典・つながりの全部）の2段階（構造の層 ③A）
import { useMemo, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { RELATION_TYPES, STAR_KINDS, VERIFICATION_LABELS, type KnowledgeNode, type Statement } from '../types';
import { RELATION_COLORS, categoryColor, formatDate } from '../lib/util';
import {
  displayName,
  parseLinkIds,
  plainText,
  relationVerification,
  splitText,
  starCertainty,
  statementVerification,
} from '../lib/knowledge';
import { SEARCH_SITES, openSearch } from '../lib/externalSearch';
import { WikipediaPreview } from './WikipediaPreview';
import { SuggestionList } from './SuggestionList';
import { SeedButton } from './SeedButton';
import { WikiStatementSuggestions } from './WikiStatementSuggestions';

/** 本文中のリンクを押せる形で表示する */
function LinkedText({ text, byId }: { text: string; byId: Map<string, KnowledgeNode> }) {
  const navigate = useCosmos((s) => s.navigate);
  return (
    <>
      {splitText(text).map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>;
        const target = byId.get(seg.id);
        if (!target) return <span key={i} className="muted">（不明な星）</span>;
        return (
          <button
            key={i}
            className={`inline-link${target.status === 'unknown' ? ' is-unknown' : ''}`}
            onClick={() => navigate(target.id)}
          >
            {displayName(target)}
          </button>
        );
      })}
    </>
  );
}

function VerificationBadge({ v }: { v: keyof typeof VERIFICATION_LABELS | null }) {
  if (!v) return <span className="badge kind-opinion">意見</span>;
  return <span className={`badge v-${v}`}>{VERIFICATION_LABELS[v]}</span>;
}

function SearchButtons({ query }: { query: string }) {
  return (
    <div className="search-sites">
      <span className="muted">調べる：</span>
      {SEARCH_SITES.map((site) => (
        <button key={site.key} className="small-btn" onClick={() => openSearch(site.url(query))}>
          {site.label}
        </button>
      ))}
    </div>
  );
}

function StatementItem({
  st,
  star,
  byId,
  onEdit,
}: {
  st: Statement;
  star: KnowledgeNode;
  byId: Map<string, KnowledgeNode>;
  onEdit: () => void;
}) {
  const sources = useCosmos((s) => s.sources);
  const { setCheck, deleteStatement } = useCosmos.getState();
  const [open, setOpen] = useState(false);
  const v = statementVerification(st);
  const plain = plainText(st.text, byId);
  const query = plain.includes(star.title) ? plain : `${star.title} ${plain}`;

  return (
    <li className={`statement${st.kind === 'opinion' ? ' is-opinion' : ''}`}>
      <div className="statement-head">
        <VerificationBadge v={v} />
        {st.topic && <span className="badge topic">{st.topic}</span>}
        <button className="small-btn ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? '閉じる' : '詳しく'}
        </button>
      </div>
      <p className="statement-text">
        <LinkedText text={st.text} byId={byId} />
      </p>
      {open && (
        <div className="statement-detail">
          {st.kind === 'fact' && (
            <>
              <h4>出典（{st.sourceIds.length}）</h4>
              {st.sourceIds.length === 0 && <p className="muted">出典がありません。下の「調べる」で探して、「編集」から追加できます。</p>}
              <ul className="source-list">
                {st.sourceIds.map((id) => {
                  const src = sources.find((x) => x.id === id);
                  if (!src) return null;
                  return (
                    <li key={id}>
                      {src.url ? (
                        <a href={src.url} target="_blank" rel="noreferrer">{src.title}</a>
                      ) : (
                        <span>{src.title}</span>
                      )}
                      {src.author && <span className="muted"> ／ {src.author}</span>}
                      {src.page && <span className="muted"> ／ p.{src.page}</span>}
                    </li>
                  );
                })}
              </ul>
              {st.checkNote && <p className="check-note">確認メモ：{st.checkNote}</p>}
              <SearchButtons query={query} />
              <div className="check-actions">
                <button
                  className="small-btn"
                  disabled={st.sourceIds.length === 0}
                  onClick={() => {
                    const note = window.prompt('どう確認しましたか？（例：出典を読み、内容が一致した）', st.checkNote);
                    if (note !== null) setCheck(st.id, 'verified', note);
                  }}
                >
                  ✓ 確認済みにする
                </button>
                <button
                  className="small-btn"
                  onClick={() => {
                    const note = window.prompt('異論の理由を書いてください', st.checkNote);
                    if (note !== null) setCheck(st.id, 'disputed', note);
                  }}
                >
                  ⚠ 異論あり
                </button>
                {st.manualCheck && (
                  <button className="small-btn" onClick={() => setCheck(st.id, null, st.checkNote)}>判断を外す</button>
                )}
              </div>
              {st.sourceIds.length === 0 && <p className="muted small">「確認済み」にするには出典が必要です。</p>}
            </>
          )}
          {st.kind === 'opinion' && <p className="muted">これは自分の考え（意見）です。確認状態はありません。</p>}
          <div className="check-actions">
            <button className="small-btn" onClick={onEdit}>✎ 編集</button>
            <button
              className="small-btn danger"
              onClick={() => {
                if (window.confirm('この記述を削除しますか？')) deleteStatement(st.id);
              }}
            >
              削除
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function NodeSheet({
  onEdit,
  onEditStatement,
}: {
  onEdit: (id: string) => void;
  onEditStatement: (starId: string, statementId: string | null) => void;
}) {
  const selectedId = useCosmos((s) => s.selectedId);
  const mode = useCosmos((s) => s.mode);
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const relations = useCosmos((s) => s.relations);
  const expanded = useCosmos((s) => s.expanded);
  const trail = useCosmos((s) => s.trail);
  const { select, setMode, focusOn, deleteNode, deleteRelation, navigate, goBack, goToTrail, setExpanded } = useCosmos.getState();
  const [moreOpen, setMoreOpen] = useState(false);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const node = selectedId ? byId.get(selectedId) : undefined;

  const own = useMemo(
    () => statements.filter((s) => s.starId === selectedId).sort((a, b) => a.order - b.order),
    [statements, selectedId],
  );
  const related = useMemo(() => {
    if (!node) return [];
    return relations
      .filter((r) => r.sourceNodeId === node.id || r.targetNodeId === node.id)
      .map((r) => {
        const otherId = r.sourceNodeId === node.id ? r.targetNodeId : r.sourceNodeId;
        return { relation: r, other: byId.get(otherId), outgoing: r.sourceNodeId === node.id };
      });
  }, [node, relations, byId]);
  /** この星にリンクしている記述（どこから言及されているか） */
  const backlinks = useMemo(
    () => (node ? statements.filter((st) => st.starId !== node.id && parseLinkIds(st.text).includes(node.id)) : []),
    [node, statements],
  );

  // プレビューに出す雑学（開くたびにランダムに1つ）
  const trivia = useMemo(() => {
    const list = own.filter((st) => st.topic === '雑学');
    return list.length ? list[Math.floor(Math.random() * list.length)] : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, own.length]);

  if (!node || mode !== 'view') return null;

  const certainty = starCertainty(node.id, statements);
  const prev = trail.length ? byId.get(trail[trail.length - 1]) : undefined;

  const handleDelete = () => {
    const lines = [`「${displayName(node)}」を削除しますか？`];
    if (own.length) lines.push(`・記述${own.length}件が消えます`);
    if (related.length) lines.push(`・意味のつながり${related.length}本が消えます`);
    if (backlinks.length) lines.push(`・この星へのリンク${backlinks.length}件は残り、「まだ知らない星」に戻ります`);
    lines.push('（削除の直後は「元に戻す」ができます）');
    if (window.confirm(lines.join('\n'))) deleteNode(node.id);
  };

  // 記述を話題ごとにまとめる（話題なしは先頭）
  const groups = new Map<string, Statement[]>();
  for (const st of own) {
    const key = st.topic || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(st);
  }

  // たどった道のり（押すとそこまで戻れる）。長いときは最後の4つだけ見せる
  const trailNodes = trail.map((id, i) => ({ i, n: byId.get(id) })).filter((t) => t.n);
  const shown = trailNodes.slice(-4);
  const breadcrumb = trailNodes.length > 0 && (
    <nav className="breadcrumb" aria-label="たどった道のり">
      {trailNodes.length > shown.length && <span className="muted">…</span>}
      {shown.map(({ i, n }) => (
        <span key={`${i}-${n!.id}`} className="crumb">
          <button className="crumb-btn" onClick={() => goToTrail(i)}>{displayName(n!)}</button>
          <span className="muted">›</span>
        </span>
      ))}
      <span className="crumb-current">{displayName(node)}</span>
    </nav>
  );

  const header = (
    <header className="sheet-header">
      {prev && (
        <button className="icon-btn" onClick={goBack} aria-label={`戻る（${displayName(prev)}）`} title={displayName(prev)}>‹</button>
      )}
      <span className="dot" style={{ background: node.status === 'unknown' ? '#8f99c2' : categoryColor(node.category) }} />
      <h2>{displayName(node)}</h2>
      <button className="icon-btn" onClick={() => select(null)} aria-label="閉じる">×</button>
    </header>
  );

  // ---- まだ知らない星 ----
  if (node.status === 'unknown') {
    return (
      <section className={`sheet${expanded ? ' is-expanded' : ''}`} aria-label="まだ知らない星">
        <div className="sheet-handle" />
        {breadcrumb}
        {header}
        <div className="sheet-body">
          <p className="muted">
            まだ知らない星です。
            {node.seedOf && byId.get(node.seedOf) ? (
              <>
                「<button className="link-like" onClick={() => navigate(node.seedOf!)}>{displayName(byId.get(node.seedOf)!)}</button>」から広げた言葉です。
              </>
            ) : (
              'どこかの記述でリンクされていますが、中身はまだありません。'
            )}
          </p>
          <WikipediaPreview key={node.id} starId={node.id} title={node.title} />
          <SearchButtons query={node.title} />
          <div className="sheet-actions inline">
            <button onClick={() => onEdit(node.id)}>＋ 自分で書いて登録する</button>
          </div>
          <h3>この言葉が出てくる記述（{backlinks.length}）</h3>
          <ul className="backlinks">
            {backlinks.map((st) => {
              const from = byId.get(st.starId);
              return (
                <li key={st.id}>
                  <button className="link-like" onClick={() => from && navigate(from.id)}>{from ? displayName(from) : ''}</button>
                  <p className="statement-text small"><LinkedText text={st.text} byId={byId} /></p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );
  }

  // ---- 登録済みの星 ----
  return (
    <section className={`sheet${expanded ? ' is-expanded' : ''}`} aria-label="星の詳細">
      <div className="sheet-handle" />
      {breadcrumb}
      {header}
      <div className="sheet-sub">
        <span>{STAR_KINDS[node.kind]}</span>
        {node.category && <span>・{node.category}</span>}
        {certainty.facts > 0 && (
          <span className="certainty">
            ・事実{certainty.facts}件中 確認済み{certainty.verified}件
          </span>
        )}
      </div>
      {node.summary ? (
        <p className="summary">{node.summary}</p>
      ) : (
        own[0] && <p className="summary"><LinkedText text={own[0].text} byId={byId} /></p>
      )}
      {!expanded && trivia && (
        <p className="trivia">
          <span className="trivia-mark">✦ 雑学</span>
          <LinkedText text={trivia.text} byId={byId} />
        </p>
      )}

      <div className="sheet-actions">
        {!expanded && <button className="primary" onClick={() => setExpanded(true)}>開く</button>}
        {expanded && <button onClick={() => setExpanded(false)}>たたむ</button>}
        <button onClick={() => focusOn(node.id)}>◎ 焦点</button>
        <button onClick={() => setMode('connect')}>⟷ つなぐ</button>
        <button onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen} aria-label="その他の操作">⋯</button>
      </div>
      {moreOpen && (
        <div className="sheet-more">
          <button onClick={() => { setMoreOpen(false); onEdit(node.id); }}>✎ 編集</button>
          <button className="danger" onClick={() => { setMoreOpen(false); handleDelete(); }}>削除</button>
          <p className="muted small">星を動かすには、宇宙で星を長押ししてそのまま動かします。</p>
        </div>
      )}

      {expanded && (
        <div className="sheet-body">
          <div className="section-head">
            <h3>記述（{own.length}）</h3>
            <button className="small-btn" onClick={() => onEditStatement(node.id, null)}>＋ 記述を追加</button>
          </div>
          {own.length === 0 && <p className="muted">まだ記述がありません。事実や意見を1文ずつ追加できます。</p>}
          <WikiStatementSuggestions star={node} />
          <div className="statement-groups">
            {[...groups.entries()].map(([topic, list]) => (
              <div key={topic || '_'}>
                {topic && <h4 className="topic-head">{topic === '雑学' ? '✦ 雑学' : topic}</h4>}
                <ul className="statements">
                  {list.map((st) => (
                    <StatementItem key={st.id} st={st} star={node} byId={byId} onEdit={() => onEditStatement(node.id, st.id)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h3>意味のつながり（{related.length}）</h3>
          {related.length === 0 && <p className="muted">「⟷ つなぐ」で他の星と結べます。</p>}
          <ul className="related">
            {related.map(({ relation, other, outgoing }) => (
              <li key={relation.id}>
                <button className="related-main" onClick={() => other && navigate(other.id)}>
                  <span className="badge" style={{ borderColor: RELATION_COLORS[relation.relationType], color: RELATION_COLORS[relation.relationType] }}>
                    {RELATION_TYPES[relation.relationType]}
                  </span>
                  <VerificationBadge v={relationVerification(relation)} />
                  <span className="related-title">{outgoing ? '→ ' : '← '}{other ? displayName(other) : '（不明）'}</span>
                  {relation.explanation && <span className="related-expl">{relation.explanation}</span>}
                </button>
                <button
                  className="icon-btn small"
                  aria-label="このつながりを削除"
                  onClick={() => {
                    if (window.confirm(`「${other ? displayName(other) : ''}」とのつながりを削除しますか？`)) deleteRelation(relation.id);
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <SuggestionList key={node.id} star={node} />
          <SeedButton key={`seed-${node.id}`} star={node} />

          {backlinks.length > 0 && (
            <>
              <h3>この星が出てくる記述（{backlinks.length}）</h3>
              <ul className="backlinks">
                {backlinks.map((st) => {
                  const from = byId.get(st.starId);
                  return (
                    <li key={st.id}>
                      <button className="link-like" onClick={() => from && navigate(from.id)}>{from ? displayName(from) : ''}</button>
                      <p className="statement-text small"><LinkedText text={st.text} byId={byId} /></p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <dl className="meta">
            {node.aliases.length > 0 && (<><dt>別名</dt><dd>{node.aliases.join('、')}</dd></>)}
            {node.tags.length > 0 && (<><dt>タグ</dt><dd>{node.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</dd></>)}
            <dt>登録</dt><dd>{formatDate(node.createdAt)}</dd>
            {node.origin === 'starter' && (<><dt>出どころ</dt><dd>初期セット（AIが用意。出典は自分で確認してください）</dd></>)}
          </dl>
        </div>
      )}
    </section>
  );
}
