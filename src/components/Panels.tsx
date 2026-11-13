// 宇宙の上に重ねて開く画面：探す・リスト・その他（骨格の層 4-3 E〜G）
import { useMemo, useRef, useState } from 'react';
import { useCosmos, type LabelDensity } from '../store/useCosmos';
import { STAR_KINDS, VERIFICATION_LABELS, type CosmosData, type KnowledgeNode, type StarKind, type Verification } from '../types';
import { categoryColor } from '../lib/util';
import { displayName, parseLinkIds, plainText, statementVerification } from '../lib/knowledge';
import { normalize } from '../lib/search';

/** 星を開く（宇宙の視点を動かし、プレビューを出す） */
function openStar(id: string, expanded = false) {
  useCosmos.setState({ panel: null, selectedId: id, trail: [], expanded, mode: 'view', focus: { id, nonce: Date.now() } });
}

function PanelFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const openPanel = useCosmos((s) => s.openPanel);
  return (
    <div className="panel-backdrop" onClick={() => openPanel(null)}>
      <section className="panel" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="panel-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={() => openPanel(null)} aria-label="閉じる">×</button>
        </header>
        {children}
      </section>
    </div>
  );
}

// ---------------- 探す ----------------

export function SearchPanel({ onCreate }: { onCreate: (title: string) => void }) {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const sources = useCosmos((s) => s.sources);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [kind, setKind] = useState<StarKind | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const categories = useMemo(
    () => [...new Set(nodes.filter((n) => n.status === 'known' && n.category).map((n) => n.category))].sort((a, b) => a.localeCompare(b, 'ja')),
    [nodes],
  );

  const results = useMemo(() => {
    const q = normalize(query);
    const filtering = category || kind || verification;
    if (!q && !filtering) return [];
    const out: { node: KnowledgeNode; score: number; snippet: string }[] = [];
    for (const n of nodes) {
      if (category && n.category !== category) continue;
      if (kind && n.kind !== kind) continue;
      const own = statements.filter((s) => s.starId === n.id);
      if (verification && !own.some((s) => statementVerification(s) === verification)) continue;
      let score = q ? 0 : 1;
      let snippet = n.summary;
      if (q) {
        const names = [displayName(n), n.title, ...n.aliases].map(normalize);
        if (names.some((x) => x === q)) score = 100;
        else if (names.some((x) => x.startsWith(q))) score = 80;
        else if (names.some((x) => x.includes(q))) score = 60;
        else if (normalize(n.summary).includes(q)) score = 40;
        else {
          const hit = own.find((s) => normalize(plainText(s.text, byId)).includes(q));
          if (hit) {
            score = 30;
            snippet = plainText(hit.text, byId);
          } else {
            const src = own.flatMap((s) => s.sourceIds).map((id) => sources.find((x) => x.id === id)).find((x) => x && normalize(x.title + x.url).includes(q));
            if (src) {
              score = 20;
              snippet = `出典：${src.title}`;
            }
          }
        }
      }
      if (n.status === 'unknown') score -= 5;
      if (score > 0) out.push({ node: n, score, snippet: snippet || (own[0] ? plainText(own[0].text, byId) : '') });
    }
    return out.sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title, 'ja')).slice(0, 80);
  }, [query, category, kind, verification, nodes, statements, sources, byId]);

  const chip = <T,>(value: T, current: T | null, set: (v: T | null) => void, label: string) => (
    <button key={String(value)} className={current === value ? 'chip small active' : 'chip small'} onClick={() => set(current === value ? null : value)}>
      {label}
    </button>
  );

  return (
    <PanelFrame title="探す">
      <input
        className="search-input"
        type="search"
        enterKeyHint="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="星・記述・出典を検索"
        aria-label="検索"
      />
      <div className="filter-row">{categories.map((c) => chip(c, category, setCategory, c))}</div>
      <div className="filter-row">
        {(Object.keys(STAR_KINDS) as StarKind[]).map((k) => chip(k, kind, setKind, STAR_KINDS[k]))}
        {(Object.keys(VERIFICATION_LABELS) as Verification[]).map((v) => chip(v, verification, setVerification, VERIFICATION_LABELS[v]))}
      </div>
      <ul className="panel-list">
        {results.map(({ node, snippet }) => (
          <li key={node.id}>
            <button className="panel-item" onClick={() => openStar(node.id)}>
              <span className="dot" style={{ background: node.status === 'unknown' ? '#8f99c2' : categoryColor(node.category) }} />
              <span className="panel-item-main">
                <span className="panel-item-title">
                  {displayName(node)}
                  {node.status === 'unknown' && <span className="muted small">（まだ知らない星）</span>}
                </span>
                {snippet && <span className="panel-item-sub">{snippet}</span>}
              </span>
              <span className="muted small">{node.category}</span>
            </button>
          </li>
        ))}
      </ul>
      {(query.trim() || category || kind || verification) && results.length === 0 && (
        <div className="panel-empty">
          <p className="muted">見つかりませんでした。</p>
          {query.trim() && (
            <button className="primary" onClick={() => onCreate(query.trim())}>「{query.trim()}」を新しい星として追加</button>
          )}
        </div>
      )}
      {!query.trim() && !category && !kind && !verification && <p className="muted small">名前・記述・出典の言葉で探せます。分野や確認状態で絞り込むこともできます。</p>}
    </PanelFrame>
  );
}

// ---------------- リスト ----------------

type ListTab = 'unknown' | 'unchecked' | 'disputed';

export function ListPanel() {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const [tab, setTab] = useState<ListTab>('unknown');
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const unknown = useMemo(() => {
    return nodes
      .filter((n) => n.status === 'unknown')
      .map((n) => {
        const from = statements.find((st) => parseLinkIds(st.text).includes(n.id));
        return { node: n, from: from ? byId.get(from.starId) : undefined };
      })
      .sort((a, b) => a.node.title.localeCompare(b.node.title, 'ja'));
  }, [nodes, statements, byId]);
  const unchecked = useMemo(
    () => statements.filter((s) => s.kind === 'fact' && (statementVerification(s) === 'unverified' || statementVerification(s) === 'sourced')),
    [statements],
  );
  const disputed = useMemo(() => statements.filter((s) => statementVerification(s) === 'disputed'), [statements]);

  const tabs: { key: ListTab; label: string; count: number }[] = [
    { key: 'unknown', label: 'まだ知らない星', count: unknown.length },
    { key: 'unchecked', label: '確認待ちの事実', count: unchecked.length },
    { key: 'disputed', label: '異論あり', count: disputed.length },
  ];
  const statementList = tab === 'unchecked' ? unchecked : disputed;

  return (
    <PanelFrame title="リスト">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'tab active' : 'tab'} onClick={() => setTab(t.key)}>
            {t.label} <span className="muted">{t.count}</span>
          </button>
        ))}
      </div>
      {tab === 'unknown' && (
        <ul className="panel-list">
          {unknown.map(({ node, from }) => (
            <li key={node.id}>
              <button className="panel-item" onClick={() => openStar(node.id)}>
                <span className="dot" style={{ background: '#8f99c2' }} />
                <span className="panel-item-main">
                  <span className="panel-item-title">{node.title}</span>
                  {from && <span className="panel-item-sub">← {displayName(from)} から</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {tab !== 'unknown' && (
        <>
          {tab === 'unchecked' && <p className="muted small">出典を読んで内容を確かめたら、「詳しく」から「確認済み」にできます。</p>}
          <ul className="panel-list">
            {statementList.slice(0, 150).map((st) => {
              const star = byId.get(st.starId);
              const v = statementVerification(st);
              return (
                <li key={st.id}>
                  <button className="panel-item" onClick={() => openStar(st.starId, true)}>
                    <span className="panel-item-main">
                      <span className="panel-item-title">
                        {star ? displayName(star) : ''}
                        {v && <span className={`badge v-${v}`}>{VERIFICATION_LABELS[v]}</span>}
                      </span>
                      <span className="panel-item-sub">{plainText(st.text, byId)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {statementList.length > 150 && <p className="muted small">ほか{statementList.length - 150}件</p>}
          {statementList.length === 0 && <p className="muted">ありません。</p>}
        </>
      )}
    </PanelFrame>
  );
}

// ---------------- その他 ----------------

function exportFileName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `knowledge-cosmos-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}

/** 読み込んだJSONが、この宇宙のバックアップとして正しい形かを確かめる */
function parseBackup(text: string): CosmosData {
  const raw = JSON.parse(text);
  const d = raw?.app === 'knowledge-cosmos' ? raw.data : raw;
  const ok = d && Array.isArray(d.nodes) && Array.isArray(d.statements) && Array.isArray(d.sources) && Array.isArray(d.relations);
  if (!ok) throw new Error('Knowledge Cosmos のバックアップファイルではないようです');
  if (d.nodes.some((n: unknown) => typeof (n as { id?: unknown })?.id !== 'string')) throw new Error('星のデータが壊れています');
  // 存在しない星を指す記述・つながりは取り除く（データの整合性を保つ）
  const ids = new Set(d.nodes.map((n: { id: string }) => n.id));
  const statements = d.statements.filter((st: { starId: string }) => ids.has(st.starId));
  const relations = d.relations.filter((r: { sourceNodeId: string; targetNodeId: string }) => ids.has(r.sourceNodeId) && ids.has(r.targetNodeId));
  return { version: 2, nodes: d.nodes, statements, sources: d.sources, relations };
}

export function MorePanel() {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const sources = useCosmos((s) => s.sources);
  const relations = useCosmos((s) => s.relations);
  const labelDensity = useCosmos((s) => s.labelDensity);
  const { setLabelDensity, addStarterSet, removeStarterSet, replaceAll, openPanel } = useCosmos.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const known = nodes.filter((n) => n.status === 'known').length;
  const facts = statements.filter((s) => s.kind === 'fact');
  const verified = facts.filter((s) => statementVerification(s) === 'verified').length;
  const starterCount = nodes.filter((n) => n.origin === 'starter' && n.status === 'known').length;

  const doExport = () => {
    const payload = { app: 'knowledge-cosmos', version: 2, exportedAt: new Date().toISOString(), data: { nodes, statements, sources, relations } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`バックアップを書き出しました（星${known}個）。iPhoneでは「ファイル」アプリに保存できます。`);
  };

  const doImport = async (file: File) => {
    try {
      const data = parseBackup(await file.text());
      const n = data.nodes.filter((x) => x.status === 'known').length;
      if (!window.confirm(`今のデータ（星${known}個）を、バックアップのデータ（星${n}個）で置き換えます。\nよろしいですか？（直後は「元に戻す」ができます）`)) return;
      replaceAll(data);
      openPanel(null);
    } catch (e) {
      setMessage(`復元できませんでした：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const densities: { key: LabelDensity; label: string }[] = [
    { key: 'few', label: '少なめ' },
    { key: 'normal', label: '普通' },
    { key: 'many', label: '多め' },
  ];

  return (
    <PanelFrame title="その他">
      <h3>データ</h3>
      <div className="more-actions">
        <button onClick={doExport}>⬇ バックアップを書き出す</button>
        <button onClick={() => fileRef.current?.click()}>⬆ バックアップから復元する</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) doImport(f);
          }}
        />
      </div>
      {message && <p className="more-message">{message}</p>}

      <h3>初期セット</h3>
      <div className="more-actions">
        <button
          onClick={() => {
            const n = addStarterSet();
            setMessage(n > 0 ? `初期セットを追加しました（${n}個）` : '初期セットはすでに入っています（足りない記述だけ補いました）');
          }}
        >
          初期セットを追加
        </button>
        <button
          className="danger"
          disabled={starterCount === 0}
          onClick={() => {
            if (window.confirm(`初期セットの星（${starterCount}個）をまとめて削除しますか？\n自分で記述を書き足した星は残ります。\n（削除の直後は「元に戻す」ができます）`)) removeStarterSet();
          }}
        >
          初期セットをまとめて削除
        </button>
      </div>

      <h3>表示</h3>
      <div className="field">
        <span className="muted small">星の名前の表示量</span>
        <div className="chips">
          {densities.map((d) => (
            <button key={d.key} className={labelDensity === d.key ? 'chip active' : 'chip'} onClick={() => setLabelDensity(d.key)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <h3>この宇宙について</h3>
      <dl className="meta">
        <dt>星</dt><dd>{known}個（まだ知らない星 {nodes.length - known}個）</dd>
        <dt>記述</dt><dd>{statements.length}件（事実 {facts.length}・意見 {statements.length - facts.length}）</dd>
        <dt>確認済み</dt><dd>{verified} / {facts.length}件</dd>
        <dt>出典</dt><dd>{sources.length}件</dd>
        <dt>意味のつながり</dt><dd>{relations.length}本</dd>
      </dl>
    </PanelFrame>
  );
}
