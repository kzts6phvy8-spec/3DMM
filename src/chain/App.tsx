// Knowledge Chain の画面：ステージ選択 → 探索 → クリア（解説・全体マップ）
import { useMemo, useState } from 'react';
import { buildAdjacency, moveTo, shortestPaths, startPlay, validateStage, type PlayState } from './engine';
import { network1, stages1 } from './data/network1';
import type { ChainEdge, ChainNetwork, ChainStage } from './types';
import { MapView } from './MapView';

const NETWORKS: Record<string, ChainNetwork> = { [network1.id]: network1 };
const STAGES: ChainStage[] = stages1;
const BEST_KEY = 'chain-best-v1';

function loadBest(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}
function saveBest(best: Record<string, number>) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // 保存できなくても遊べる（最高記録が残らないだけ）
  }
}

export function ChainApp() {
  const [stageId, setStageId] = useState<string | null>(null);
  const [best, setBest] = useState(loadBest);
  const stage = STAGES.find((s) => s.id === stageId) ?? null;

  if (!stage) return <StageSelect best={best} onStart={setStageId} />;
  return (
    <Play
      key={stage.id}
      stage={stage}
      network={NETWORKS[stage.networkId]}
      best={best[stage.id]}
      onClear={(moves) => {
        if (best[stage.id] === undefined || moves < best[stage.id]) {
          const next = { ...best, [stage.id]: moves };
          setBest(next);
          saveBest(next);
        }
      }}
      onExit={() => setStageId(null)}
    />
  );
}

function StageSelect({ best, onStart }: { best: Record<string, number>; onStart: (id: string) => void }) {
  return (
    <main className="chain">
      <header className="chain-head">
        <h1>Knowledge Chain</h1>
        <p className="chain-muted">知識のつながりをたどって、スタートからゴールまでの最短の道を探そう。</p>
      </header>
      <section className="chain-rules">
        <h2>あそびかた</h2>
        <ul>
          <li>今いる知識に、直接つながっている知識が表示されます。選ぶとそこへ移動します（1回で1手）。</li>
          <li>つながりはどちら向きにも進めます。同じ知識に戻ることもできます（戻るのも1手）。</li>
          <li>行き止まりもあります。全体の地図は、ゴールしたあとに見られます。</li>
        </ul>
      </section>
      <ul className="chain-stages">
        {STAGES.map((s) => {
          const net = NETWORKS[s.networkId];
          const check = validateStage(s, net);
          const name = (id: string) => net.nodes.find((n) => n.id === id)?.name ?? id;
          const ok = check.errors.length === 0;
          return (
            <li key={s.id}>
              <button className="chain-stage" disabled={!ok} onClick={() => onStart(s.id)}>
                <span className="chain-stage-title">{s.title}</span>
                <span className="chain-stage-route">{name(s.start)} → {name(s.goal)}</span>
                <span className="chain-muted small">
                  {ok ? `最短${check.shortest}手` : 'このステージは検証に通っていないため遊べません'}
                  {best[s.id] !== undefined && `　最高記録：${best[s.id]}手`}
                </span>
              </button>
              {!ok && (
                <ul className="chain-errors">
                  {check.errors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {Object.values(NETWORKS).some((n) => !n.reviewed) && (
        <p className="chain-note">試作品：知識とつながりのデータは確認中です（下書き）。</p>
      )}
    </main>
  );
}

function Play({ stage, network, best, onClear, onExit }: {
  stage: ChainStage;
  network: ChainNetwork;
  best: number | undefined;
  onClear: (moves: number) => void;
  onExit: () => void;
}) {
  const adj = useMemo(() => buildAdjacency(network), [network]);
  const byId = useMemo(() => new Map(network.nodes.map((n) => [n.id, n])), [network]);
  const shortest = useMemo(() => shortestPaths(adj, stage.start, stage.goal), [adj, stage]);
  const [state, setState] = useState<PlayState>(() => startPlay(stage));
  const name = (id: string) => byId.get(id)?.name ?? id;

  const go = (to: string) => {
    const next = moveTo(state, to, adj, stage.goal);
    setState(next);
    if (next.finished && !state.finished) onClear(next.moves);
    window.scrollTo({ top: 0 });
  };

  if (state.finished) {
    return <Cleared stage={stage} network={network} state={state} shortest={shortest} best={best} onRetry={() => setState(startPlay(stage))} onExit={onExit} />;
  }

  // 隣の知識は名前の順に並べる（並び順が手がかりにならないように）
  const neighbors = [...(adj.get(state.current) ?? [])].sort((a, b) => name(a.id).localeCompare(name(b.id), 'ja'));
  return (
    <main className="chain">
      <header className="chain-bar">
        <button className="chain-link" onClick={onExit}>‹ ステージ</button>
        <span className="chain-moves">{state.moves}手</span>
      </header>
      <section className="chain-ends">
        <div><span className="chain-label">スタート</span><strong>{name(stage.start)}</strong></div>
        <div className="chain-arrow">→</div>
        <div><span className="chain-label">ゴール</span><strong>{name(stage.goal)}</strong></div>
      </section>
      <section className="chain-here">
        <span className="chain-label">今いる知識</span>
        <p className="chain-current">{name(state.current)}</p>
      </section>
      <section>
        <h2 className="chain-h2">つながっている知識（{neighbors.length}）</h2>
        <ul className="chain-choices">
          {neighbors.map((nb) => (
            <li key={nb.id}>
              <button className={`chain-choice${nb.id === stage.goal ? ' is-goal' : ''}`} onClick={() => go(nb.id)}>
                {name(nb.id)}
                {nb.id === stage.goal ? <span className="chain-tag">ゴール</span> : state.visited.includes(nb.id) && <span className="chain-tag muted">通った</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="chain-h2">たどった道</h2>
        <p className="chain-history">{state.history.map(name).join(' → ')}</p>
      </section>
      <div className="chain-actions">
        <button onClick={() => { if (window.confirm('最初からやり直しますか？')) setState(startPlay(stage)); }}>最初からやり直す</button>
      </div>
    </main>
  );
}

function EdgeReason({ edge }: { edge: ChainEdge }) {
  return (
    <>
      <span className="chain-type">{edge.type}</span> {edge.reason}
      <span className="chain-src">
        {edge.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">出典：{s.title}</a>)}
      </span>
    </>
  );
}

function Cleared({ stage, network, state, shortest, best, onRetry, onExit }: {
  stage: ChainStage;
  network: ChainNetwork;
  state: PlayState;
  shortest: string[][];
  best: number | undefined;
  onRetry: () => void;
  onExit: () => void;
}) {
  const adj = useMemo(() => buildAdjacency(network), [network]);
  const byId = useMemo(() => new Map(network.nodes.map((n) => [n.id, n])), [network]);
  const name = (id: string) => byId.get(id)?.name ?? id;
  const edgeOf = (a: string, b: string) => adj.get(a)?.find((nb) => nb.id === b)?.edge;
  const min = shortest[0].length - 1;
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ? byId.get(selected) : null;

  const Steps = ({ path }: { path: string[] }) => (
    <ol className="chain-steps">
      {path.slice(1).map((id, i) => {
        const e = edgeOf(path[i], id);
        return (
          <li key={`${i}-${id}`}>
            <strong>{name(path[i])} → {name(id)}</strong>
            {e && <p><EdgeReason edge={e} /></p>}
          </li>
        );
      })}
    </ol>
  );

  return (
    <main className="chain">
      <header className="chain-bar">
        <button className="chain-link" onClick={onExit}>‹ ステージ</button>
      </header>
      <section className="chain-result">
        <p className="chain-big">{state.moves === min ? '最短でゴール！' : 'ゴール！'}</p>
        <p>{state.moves}手（最短{min}手）{best !== undefined && best < state.moves && `　最高記録：${best}手`}</p>
      </section>

      <section>
        <h2 className="chain-h2">全体マップ</h2>
        <p className="chain-muted small">黄色：あなたの道／水色：最短の道。知識を押すと説明が出ます。</p>
        <MapView network={network} start={stage.start} goal={stage.goal} played={state.history} shortest={shortest} selected={selected} onSelect={setSelected} />
        {sel && (
          <div className="chain-node-info">
            <strong>{sel.name}</strong>（{sel.field}）
            <p>{sel.description}</p>
            <ul className="chain-node-links">
              {(adj.get(sel.id) ?? []).map((nb) => (
                <li key={nb.id}>
                  <button className="chain-link" onClick={() => setSelected(nb.id)}>{name(nb.id)}</button>：<EdgeReason edge={nb.edge} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="chain-h2">解説：あなたの道</h2>
        <Steps path={state.history} />
      </section>
      <section>
        <h2 className="chain-h2">解説：最短の道{shortest.length > 1 ? `（${shortest.length}通り）` : ''}</h2>
        {shortest.map((p, i) => (
          <div key={i}>
            {shortest.length > 1 && <h3 className="chain-h3">道{i + 1}：{p.map(name).join(' → ')}</h3>}
            <Steps path={p} />
          </div>
        ))}
      </section>
      <div className="chain-actions">
        <button className="primary" onClick={onRetry}>もう一度</button>
        <button onClick={onExit}>ステージ選択へ</button>
      </div>
    </main>
  );
}
