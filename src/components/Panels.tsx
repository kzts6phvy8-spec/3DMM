// 宇宙の上に重ねて開く画面：探す・リスト・その他（骨格の層 4-3 E〜G）
import { useMemo, useRef, useState } from 'react';
import { useCosmos, type LabelDensity } from '../store/useCosmos';
import { dropCheckFields } from '../storage/repository';
import { sanitizeEngagement, type EngagementMap } from '../lib/engagement';
import { sanitizeDays } from '../lib/streak';
import { SyncSection } from './SyncSection';
import { STAR_KINDS, type CosmosData, type KnowledgeNode, type StarKind } from '../types';
import { categoryColor } from '../lib/util';
import { displayName, parseLinkIds } from '../lib/knowledge';
import { normalize, searchIndex } from '../lib/search';
import { AiSearchButton } from './AiSearchButton';
import { addSearchHistory, clearSearchHistory, removeSearchHistory, useSearchHistory } from '../lib/searchHistory';

/** 星を開く（宇宙の視点を動かし、プレビューを出す） */
export function openStar(id: string, expanded = false) {
  useCosmos.setState({ panel: null, selectedId: id, trail: [], expanded, mode: 'view', focus: { id, nonce: Date.now() } });
}

export function PanelFrame({ title, children }: { title: string; children: React.ReactNode }) {
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
  const history = useSearchHistory();
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // 消した星は履歴に出さない
  const historyNodes = history.map((id) => byId.get(id)).filter((n): n is KnowledgeNode => !!n);

  const categories = useMemo(
    () => [...new Set(nodes.filter((n) => n.status === 'known' && n.category).map((n) => n.category))].sort((a, b) => a.localeCompare(b, 'ja')),
    [nodes],
  );

  // 検索用の索引（データが変わらない限り使い回す。1文字打つたびに全記述を作り直さないため）
  const index = useMemo(() => searchIndex(nodes, statements, sources), [nodes, statements, sources]);

  const results = useMemo(() => {
    const q = normalize(query);
    const filtering = category || kind;
    if (!q && !filtering) return [];
    const out: { node: KnowledgeNode; score: number; snippet: string }[] = [];
    for (const n of nodes) {
      if (category && n.category !== category) continue;
      if (kind && n.kind !== kind) continue;
      const e = index.get(n.id);
      if (!e) continue;
      let score = q ? 0 : 1;
      let snippet = n.summary;
      if (q) {
        const names = e.names;
        if (names.some((x) => x === q)) score = 100;
        else if (names.some((x) => x.startsWith(q))) score = 80;
        else if (names.some((x) => x.includes(q))) score = 60;
        else if (e.summary.includes(q)) score = 40;
        else {
          const hit = e.statements.find((s) => s.norm.includes(q));
          if (hit) {
            score = 30;
            snippet = hit.plain;
          } else {
            const src = e.sources.find((x) => x.norm.includes(q));
            if (src) {
              score = 20;
              snippet = `出典：${src.title}`;
            }
          }
        }
      }
      if (n.status === 'unknown') score -= 5;
      if (score > 0) out.push({ node: n, score, snippet: snippet || e.statements[0]?.plain || '' });
    }
    return out.sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title, 'ja')).slice(0, 80);
  }, [query, category, kind, nodes, index]);

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
      </div>
      {/* 言葉を入れたら、結果があってもなくても、いちばん上に「AIで調べる」を出す（2026-11-25、利用者が決定）。
          検索は言葉の途中にも当たるので（例：「ぴえん」→「サピエンス」）、結果があっても調べたい言葉の星がないことが多いため */}
      {query.trim() && <AiSearchButton key={query.trim()} query={query.trim()} targetId={null} primary />}
      <ul className="panel-list">
        {results.map(({ node, snippet }) => (
          <li key={node.id}>
            <button
              className="panel-item"
              onClick={() => {
                addSearchHistory(node.id);
                openStar(node.id);
              }}
            >
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
      {(query.trim() || category || kind) && results.length === 0 && (
        <div className="panel-empty">
          <p className="muted">見つかりませんでした。</p>
          {query.trim() && (
            <>
              <button onClick={() => onCreate(query.trim())}>「{query.trim()}」を自分で書いて追加</button>
            </>
          )}
        </div>
      )}
      {!query.trim() && !category && !kind && (
        <>
          {historyNodes.length > 0 && (
            <section className="search-history" aria-label="最近探した星">
              <div className="section-head">
                <h3>最近探した星</h3>
                <button className="small-btn ghost" onClick={() => window.confirm('検索履歴をすべて消しますか？') && clearSearchHistory()}>
                  すべて消す
                </button>
              </div>
              <ul className="panel-list">
                {historyNodes.map((node) => (
                  <li key={node.id} className="history-item">
                    <button
                      className="panel-item"
                      onClick={() => {
                        addSearchHistory(node.id);
                        openStar(node.id);
                      }}
                    >
                      <span className="dot" style={{ background: node.status === 'unknown' ? '#8f99c2' : categoryColor(node.category) }} />
                      <span className="panel-item-main">
                        <span className="panel-item-title">{displayName(node)}</span>
                      </span>
                      <span className="muted small">{node.category}</span>
                    </button>
                    <button className="icon-btn small" onClick={() => removeSearchHistory(node.id)} aria-label={`「${displayName(node)}」を履歴から消す`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="muted small">名前・記述・出典の言葉で探せます。分野や種類で絞り込むこともできます。</p>
        </>
      )}
    </PanelFrame>
  );
}

// ---------------- リスト ----------------

export function ListPanel() {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
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

  return (
    <PanelFrame title="リスト">
      <p className="muted small">まだ知らない星 {unknown.length}個</p>
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
      {unknown.length === 0 && <p className="muted">ありません。</p>}
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
function parseBackup(text: string): { data: CosmosData; engagement: EngagementMap; activity: string[] } {
  const raw = JSON.parse(text);
  const d = raw?.app === 'knowledge-cosmos' ? raw.data : raw;
  const ok = d && Array.isArray(d.nodes) && Array.isArray(d.statements) && Array.isArray(d.sources) && Array.isArray(d.relations);
  if (!ok) throw new Error('Knowledge Cosmos のバックアップファイルではないようです');
  if (d.nodes.some((n: unknown) => typeof (n as { id?: unknown })?.id !== 'string')) throw new Error('星のデータが壊れています');
  // 存在しない星を指す記述・つながりは取り除く（データの整合性を保つ）
  const ids = new Set(d.nodes.map((n: { id: string }) => n.id));
  const statements = d.statements.filter((st: { starId: string }) => ids.has(st.starId));
  const relations = d.relations.filter((r: { sourceNodeId: string; targetNodeId: string }) => ids.has(r.sourceNodeId) && ids.has(r.targetNodeId));
  const data = dropCheckFields({ version: 2, nodes: d.nodes, statements, sources: d.sources, relations });
  // 関わり方の記録（古いバックアップにはない）
  return { data, engagement: sanitizeEngagement(raw?.engagement), activity: sanitizeDays(raw?.activity) };
}

export function MorePanel() {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const sources = useCosmos((s) => s.sources);
  const relations = useCosmos((s) => s.relations);
  const labelDensity = useCosmos((s) => s.labelDensity);
  const { setLabelDensity, addStarterSet, removeStarterSet, replaceAll, openPanel, mergeEngagementFrom, mergeActivityFrom } = useCosmos.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const known = nodes.filter((n) => n.status === 'known').length;
  const facts = statements.filter((s) => s.kind === 'fact');
  const starterCount = nodes.filter((n) => n.origin === 'starter' && n.status === 'known').length;

  const doExport = () => {
    const payload = { app: 'knowledge-cosmos', version: 2, exportedAt: new Date().toISOString(), data: { nodes, statements, sources, relations }, engagement: useCosmos.getState().engagement, activity: useCosmos.getState().activityDays };
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
      const parsed = parseBackup(await file.text());
      const { engagement, activity } = parsed;
      // 古いバックアップには、直す前の初期セットの壊れた記述が入っていることがあるので、ここでも直す
      const [{ applyCorrections }, corrections] = await Promise.all([
        import('../data/applyCorrections'),
        import('../data/corrections.json').then((m) => m.default as unknown as import('../data/applyCorrections').Corrections),
      ]);
      const fixed = applyCorrections(parsed.data, corrections).data;
      const data = { ...parsed.data, ...fixed };
      const n = data.nodes.filter((x) => x.status === 'known').length;
      if (!window.confirm(`今のデータ（星${known}個）を、バックアップのデータ（星${n}個）で置き換えます。\nよろしいですか？（直後は「元に戻す」ができます）`)) return;
      replaceAll(data);
      mergeEngagementFrom(engagement);
      mergeActivityFrom(activity);
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
      <h3>あそぶ・振り返る</h3>
      <div className="more-actions">
        <button onClick={() => openPanel('quiz')}>❓ 言葉クイズ（星の種を見つける）</button>
        <button onClick={() => openPanel('report')}>📅 今月の発見</button>
        <button onClick={() => openPanel('compare')}>👥 友達の宇宙と重ねる</button>
      </div>

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

      <SyncSection />

      <h3>初期セット</h3>
      <div className="more-actions">
        <button
          onClick={async () => {
            setMessage('初期セットを読み込んでいます…');
            const n = await addStarterSet();
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
        <dt>出典</dt><dd>{sources.length}件</dd>
        <dt>意味のつながり</dt><dd>{relations.length}本</dd>
      </dl>

      <h3>このアプリについて</h3>
      <p className="muted small legal-links">
        <a href="legal/terms.html" target="_blank" rel="noopener">利用規約</a>
        <a href="legal/privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>
        <a href="legal/tokushoho.html" target="_blank" rel="noopener">特定商取引法に基づく表記</a>
      </p>
    </PanelFrame>
  );
}
