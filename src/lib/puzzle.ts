// 毎日のつながりパズル（アイデア⑩）。画面から独立した純粋な処理だけを置く。
// - 日付から決まるスタートとゴールの星を、つながりをたどって結ぶ。
// - 使うのは初期セットの星とつながりだけ。だから同じ日なら、誰でも同じ問題になる（サーバー不要）。
import type { KnowledgeNode, Relation, Statement } from '../types';
import { isFromStarter } from './engagement';
import { parseLinkIds } from './knowledge';

export type Graph = Map<string, Set<string>>;

/** 初期セットの登録済みの星を、記述のリンクと意味のつながりで結んだ図（向きは問わない） */
export function buildStarterGraph(data: { nodes: KnowledgeNode[]; statements: Statement[]; relations: Relation[] }): Graph {
  const ids = new Set(data.nodes.filter((n) => n.status === 'known' && n.origin === 'starter').map((n) => n.id));
  const g: Graph = new Map([...ids].sort().map((id) => [id, new Set<string>()]));
  const add = (a: string, b: string) => {
    if (a === b || !ids.has(a) || !ids.has(b)) return;
    g.get(a)!.add(b);
    g.get(b)!.add(a);
  };
  for (const s of data.statements) if (isFromStarter(s.id)) for (const t of parseLinkIds(s.text)) add(s.starId, t);
  for (const r of data.relations) if (isFromStarter(r.id)) add(r.sourceNodeId, r.targetNodeId);
  return g;
}

/** 最短の道のり（スタートとゴールを含む）。たどり着けなければ null */
export function shortestPath(g: Graph, from: string, to: string): string[] | null {
  if (!g.has(from) || !g.has(to)) return null;
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i];
    if (x === to) break;
    for (const y of [...g.get(x)!].sort()) {
      if (prev.has(y)) continue;
      prev.set(y, x);
      queue.push(y);
    }
  }
  if (!prev.has(to)) return null;
  const path: string[] = [];
  for (let x: string | null = to; x !== null; x = prev.get(x) ?? null) path.unshift(x);
  return path;
}

/** スタートから各星までの手数 */
function distances(g: Graph, from: string): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i];
    for (const y of g.get(x)!) {
      if (dist.has(y)) continue;
      dist.set(y, dist.get(x)! + 1);
      queue.push(y);
    }
  }
  return dist;
}

/** 日付の文字列から、決まった並びの乱数を作る（同じ日なら同じ結果） */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface DailyPuzzle {
  date: string;
  start: string;
  goal: string;
  /** 最短の手数 */
  par: number;
}

const MIN_STEPS = 3;
const MAX_STEPS = 5;

/**
 * その日の問題を決める。
 * - スタート：つながりが2本以上ある星から選ぶ
 * - ゴール：最短で3〜5手の星。できれば分野が違う星を選ぶ
 * 作れないとき（初期セットを消した場合など）は null
 */
export function dailyPuzzle(date: string, g: Graph, byId: Map<string, KnowledgeNode>): DailyPuzzle | null {
  const rand = seededRandom(`cosmos-puzzle:${date}`);
  const starts = [...g.keys()].filter((id) => g.get(id)!.size >= 2);
  if (!starts.length) return null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const start = starts[Math.floor(rand() * starts.length)];
    const dist = distances(g, start);
    const far = [...dist.entries()].filter(([, d]) => d >= MIN_STEPS && d <= MAX_STEPS).map(([id]) => id).sort();
    if (!far.length) continue;
    const cat = byId.get(start)?.category;
    const other = far.filter((id) => byId.get(id)?.category && byId.get(id)?.category !== cat);
    const pool = other.length ? other : far;
    const goal = pool[Math.floor(rand() * pool.length)];
    return { date, start, goal, par: dist.get(goal)! };
  }
  return null;
}

/** 遊んだ記録（1日に1つ） */
export interface PuzzleProgress {
  date: string;
  start: string;
  goal: string;
  /** 今の道のり（スタートを含む）。「1手戻る」で短くなる */
  path: string[];
  /** 動いた回数（戻った分も1手と数える。何度もやり直して最短にできないように） */
  moves: number;
  done: boolean;
  gaveUp: boolean;
}

/** シェア用の文（たどった途中の星は出さない。答えのネタばれにならないように） */
export function shareText(p: PuzzleProgress, par: number, startTitle: string, goalTitle: string): string {
  const steps = p.moves;
  const [y, m, d] = p.date.split('-').map(Number);
  const marks = p.gaveUp ? '🏳️' : `${'🟦'.repeat(Math.max(0, steps - 1))}⭐`;
  const result = p.gaveUp ? `ギブアップ（最短${par}手）` : steps === par ? `${steps}手（最短！）` : `${steps}手（最短${par}手）`;
  return `Knowledge Cosmos つながりパズル ${y}/${m}/${d}\n${startTitle} → ${goalTitle}\n${result}\n${marks}`;
}
