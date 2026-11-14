// クリア後の全体マップ（SVG）。自分の道と最短の道を色分けして見せる。
import { useMemo } from 'react';
import { layoutNetwork, placeLabels } from './layout';
import type { ChainNetwork } from './types';

const W = 360;
const H = 460;
const PAD = 34;

/** 長い名前は、地図の上では短くする（押すと全部の名前と説明が出る） */
const shortName = (name: string) => (name.length > 9 ? name.slice(0, 8) + '…' : name);

export function MapView({ network, start, goal, played, shortest, selected, onSelect }: {
  network: ChainNetwork;
  start: string;
  goal: string;
  played: string[];
  shortest: string[][];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const pos = useMemo(() => layoutNetwork(network), [network]);
  const at = (id: string) => {
    const p = pos.get(id)!;
    return { x: PAD + p.x * (W - PAD * 2), y: PAD + p.y * (H - PAD * 2) };
  };
  // 名前の置き場所（スタート・ゴール → つながりの多い知識 の順に、重ならない場所を取る）
  const labels = useMemo(() => {
    const degree = new Map<string, number>();
    for (const e of network.edges) for (const id of [e.from, e.to]) degree.set(id, (degree.get(id) ?? 0) + 1);
    const order = [start, goal, ...network.nodes.map((n) => n.id).filter((id) => id !== start && id !== goal).sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0))];
    const pts = network.nodes.map((n) => {
      const p = pos.get(n.id)!;
      return { id: n.id, x: PAD + p.x * (W - PAD * 2), y: PAD + p.y * (H - PAD * 2), text: shortName(n.name) };
    });
    return placeLabels(pts, 10, W, H, order);
  }, [network, pos, start, goal]);
  const key = (a: string, b: string) => [a, b].sort().join('|');
  const playedEdges = new Set(played.slice(1).map((id, i) => key(played[i], id)));
  const shortEdges = new Set(shortest.flatMap((p) => p.slice(1).map((id, i) => key(p[i], id))));
  const visited = new Set(played);

  return (
    <svg className="chain-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="知識のつながりの全体マップ">
      {network.edges.map((e) => {
        const a = at(e.from);
        const b = at(e.to);
        const k = key(e.from, e.to);
        const cls = playedEdges.has(k) ? 'is-played' : shortEdges.has(k) ? 'is-short' : '';
        return <line key={e.id} className={`chain-map-edge ${cls}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      {network.nodes.map((n) => {
        const p = at(n.id);
        const cls = [
          n.id === start ? 'is-start' : n.id === goal ? 'is-goal' : '',
          visited.has(n.id) ? 'is-visited' : '',
          n.id === selected ? 'is-selected' : '',
        ].join(' ');
        return (
          <g key={n.id} className={`chain-map-node ${cls}`} onClick={() => onSelect(n.id)}>
            <circle cx={p.x} cy={p.y} r={n.id === start || n.id === goal ? 8 : 6} />
            {/* 押しやすいように、見えない大きめの円を重ねる */}
            <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
            <text x={labels.get(n.id)!.x} y={labels.get(n.id)!.y} textAnchor={labels.get(n.id)!.anchor}>{shortName(n.name)}</text>
          </g>
        );
      })}
    </svg>
  );
}
