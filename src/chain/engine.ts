// Knowledge Chain の決まり（画面から独立した処理だけを置く）。
// - 接続は双方向。再訪問できる。1回の移動が1手。
// - ステージの自動検証（仕様 6）：経路があるか・最短手数・経路が複数あるか・行き止まりは意図したものか・接続の矛盾や重複
import type { ChainEdge, ChainNetwork, ChainStage } from './types';

export interface Neighbor {
  id: string;
  edge: ChainEdge;
}
export type Adjacency = Map<string, Neighbor[]>;

/** 知識ごとの、直接つながっている知識の一覧（双方向） */
export function buildAdjacency(net: ChainNetwork): Adjacency {
  const adj: Adjacency = new Map(net.nodes.map((n) => [n.id, [] as Neighbor[]]));
  for (const e of net.edges) {
    if (e.from === e.to || !adj.has(e.from) || !adj.has(e.to)) continue;
    adj.get(e.from)!.push({ id: e.to, edge: e });
    adj.get(e.to)!.push({ id: e.from, edge: e });
  }
  return adj;
}

/** ある知識から、ほかの各知識までの最少手数 */
export function distancesFrom(adj: Adjacency, from: string): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const nb of adj.get(cur) ?? []) {
      if (dist.has(nb.id)) continue;
      dist.set(nb.id, dist.get(cur)! + 1);
      queue.push(nb.id);
    }
  }
  return dist;
}

/** 最短手数（たどり着けなければ null） */
export function shortestLength(adj: Adjacency, start: string, goal: string): number | null {
  return distancesFrom(adj, start).get(goal) ?? null;
}

/** 最短経路をすべて挙げる（多すぎるときは limit 本まで） */
export function shortestPaths(adj: Adjacency, start: string, goal: string, limit = 50): string[][] {
  const fromGoal = distancesFrom(adj, goal);
  const total = fromGoal.get(start);
  if (total === undefined) return [];
  const out: string[][] = [];
  const walk = (path: string[]) => {
    if (out.length >= limit) return;
    const cur = path[path.length - 1];
    if (cur === goal) return void out.push([...path]);
    const remain = fromGoal.get(cur)!;
    for (const nb of adj.get(cur) ?? []) {
      if (fromGoal.get(nb.id) === remain - 1) walk([...path, nb.id]);
    }
  };
  walk([start]);
  return out;
}

/** 同じ知識を2度通らない経路の数（多すぎるときは cap で止める）。「経路が複数ある」かを確かめる */
export function countSimplePaths(adj: Adjacency, start: string, goal: string, cap = 1000): number {
  let count = 0;
  const seen = new Set<string>([start]);
  const walk = (cur: string) => {
    if (count >= cap) return;
    if (cur === goal) return void count++;
    for (const nb of adj.get(cur) ?? []) {
      if (seen.has(nb.id)) continue;
      seen.add(nb.id);
      walk(nb.id);
      seen.delete(nb.id);
    }
  };
  walk(start);
  return count;
}

// ---- 自動検証（仕様 6） ----

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

/** ネットワーク全体の検証：重複・矛盾・存在しない知識への接続・意図しない行き止まり・孤立 */
export function validateNetwork(net: ChainNetwork): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set<string>();
  const names = new Set<string>();
  for (const n of net.nodes) {
    if (nodeIds.has(n.id)) errors.push(`知識のIDが重複：${n.id}`);
    nodeIds.add(n.id);
    if (names.has(n.name)) errors.push(`知識の名称が重複：${n.name}`);
    names.add(n.name);
    if (!n.name.trim() || !n.description.trim()) errors.push(`名称か説明が空：${n.id}`);
    if (n.sources.length === 0) errors.push(`出典がない知識：${n.name}`);
  }
  const edgeIds = new Set<string>();
  const pairs = new Map<string, string>();
  for (const e of net.edges) {
    if (edgeIds.has(e.id)) errors.push(`接続のIDが重複：${e.id}`);
    edgeIds.add(e.id);
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
      errors.push(`存在しない知識への接続：${e.id}（${e.from} – ${e.to}）`);
      continue;
    }
    if (e.from === e.to) errors.push(`自分自身への接続：${e.id}`);
    // 双方向なので、A→B と B→A は同じ接続とみなす
    const key = [e.from, e.to].sort().join('|');
    if (pairs.has(key)) errors.push(`同じ2つの知識の接続が重複：${e.id} と ${pairs.get(key)}`);
    pairs.set(key, e.id);
    if (!e.reason.trim()) errors.push(`接続理由が空：${e.id}`);
    if (e.sources.length === 0) errors.push(`根拠資料がない接続：${e.id}`);
  }
  const adj = buildAdjacency(net);
  for (const n of net.nodes) {
    const degree = adj.get(n.id)!.length;
    if (degree === 0) errors.push(`どこにもつながっていない知識：${n.name}`);
    else if (degree === 1 && !n.deadEnd) errors.push(`意図しない行き止まり（つながりが1本だけ）：${n.name}。行き止まりにするなら deadEnd: true を付ける`);
    else if (degree > 1 && n.deadEnd) warnings.push(`行き止まりと宣言しているが、つながりが${degree}本ある：${n.name}`);
  }
  // 全体が1つにつながっているか（離れ小島があると、そこへは行けない）
  if (net.nodes.length > 0) {
    const reach = distancesFrom(adj, net.nodes[0].id);
    const isolated = net.nodes.filter((n) => !reach.has(n.id)).map((n) => n.name);
    if (isolated.length) errors.push(`ほかとつながっていない知識のまとまり：${isolated.join('、')}`);
  }
  return { errors, warnings };
}

export interface StageCheck extends CheckResult {
  shortest: number | null;
  /** 同じ知識を2度通らない経路の数（cap まで） */
  routes: number;
  /** 最短経路の本数 */
  shortestRoutes: number;
}

/** 最短手数として認める範囲（短すぎると探索にならず、長すぎると手がかりがなくなる） */
export const MIN_SHORTEST = 3;
export const MAX_SHORTEST = 7;

/** ステージの検証：経路があるか・最短手数・経路が複数あるか（ネットワークの検証も含む） */
export function validateStage(stage: ChainStage, net: ChainNetwork): StageCheck {
  const { errors, warnings } = validateNetwork(net);
  const adj = buildAdjacency(net);
  const result: StageCheck = { errors, warnings, shortest: null, routes: 0, shortestRoutes: 0 };
  if (stage.networkId !== net.id) errors.push(`ステージ「${stage.title}」のネットワークが違う：${stage.networkId}`);
  if (!adj.has(stage.start)) errors.push(`スタートの知識がない：${stage.start}`);
  if (!adj.has(stage.goal)) errors.push(`ゴールの知識がない：${stage.goal}`);
  if (stage.start === stage.goal) errors.push('スタートとゴールが同じ');
  if (!adj.has(stage.start) || !adj.has(stage.goal) || stage.start === stage.goal) return result;
  result.shortest = shortestLength(adj, stage.start, stage.goal);
  if (result.shortest === null) {
    errors.push(`スタートからゴールへの経路がない：${stage.title}`);
    return result;
  }
  if (result.shortest < MIN_SHORTEST || result.shortest > MAX_SHORTEST) {
    errors.push(`最短手数が範囲外（${result.shortest}手。${MIN_SHORTEST}〜${MAX_SHORTEST}手にする）：${stage.title}`);
  }
  result.routes = countSimplePaths(adj, stage.start, stage.goal);
  result.shortestRoutes = shortestPaths(adj, stage.start, stage.goal).length;
  if (result.routes < 2) errors.push(`ゴールへの経路が1本しかない（経路は複数にする）：${stage.title}`);
  const nodeById = new Map(net.nodes.map((n) => [n.id, n]));
  if (nodeById.get(stage.start)?.deadEnd || nodeById.get(stage.goal)?.deadEnd) {
    warnings.push(`スタートかゴールが行き止まりの知識：${stage.title}`);
  }
  return result;
}

// ---- 遊んでいる間の状態 ----

export interface PlayState {
  stageId: string;
  /** 今いる知識 */
  current: string;
  /** 通った知識の順番（スタートを含む）。再訪問も記録する */
  history: string[];
  /** 手数（移動するたびに1） */
  moves: number;
  /** 一度でも訪れた知識（開示済み） */
  visited: string[];
  finished: boolean;
}

export function startPlay(stage: ChainStage): PlayState {
  return { stageId: stage.id, current: stage.start, history: [stage.start], moves: 0, visited: [stage.start], finished: false };
}

/** 隣の知識へ移動する（つながっていない知識へは動けない。ゴール後は動かない） */
export function moveTo(state: PlayState, to: string, adj: Adjacency, goal: string): PlayState {
  if (state.finished) return state;
  if (!(adj.get(state.current) ?? []).some((nb) => nb.id === to)) return state;
  return {
    ...state,
    current: to,
    history: [...state.history, to],
    moves: state.moves + 1,
    visited: state.visited.includes(to) ? state.visited : [...state.visited, to],
    finished: to === goal,
  };
}
