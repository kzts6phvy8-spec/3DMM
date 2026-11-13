// 友達の宇宙と重ねる（アイデア⑦）。画面から独立した純粋な処理だけを置く。
// - 「宇宙カード」：自分が関わった星の名前と、関わりの深さだけを入れた小さなファイル。
//   記述・出典・メモなどの中身は入れない。サーバーは使わず、ファイルを送り合う。
// - 初期セットは全員同じなので、「持っているか」ではなく「関わったか」で比べる。
import type { KnowledgeNode, Relation, Statement } from '../types';
import { engagementSummary, type EngagementMap } from './engagement';
import { displayName } from './knowledge';
import { normalize } from './search';

/** 関わりの深さ。1：開いた ／ 2：深く関わった（記述を加えた・つないだ・広げた・自分で作った） */
export type Depth = 1 | 2;

export const DEPTH_LABELS: Record<Depth, string> = { 1: '開いた', 2: '深く関わった' };

export interface CardStar {
  title: string;
  category: string;
  depth: Depth;
}

export interface CosmosCard {
  app: 'knowledge-cosmos';
  kind: 'card';
  version: 1;
  name: string;
  createdAt: string;
  stars: CardStar[];
}

type Data = { nodes: KnowledgeNode[]; statements: Statement[]; relations: Relation[]; engagement: EngagementMap };

/** 星を見分けるキー。名前で合わせる（同じ言葉なら、初期セットの星でも自分で作った星でも同じ星とみなす） */
export function cardKey(title: string): string {
  return normalize(title).replace(/\s+/g, '');
}

export function depthOf(star: KnowledgeNode, data: Data): Depth | 0 {
  const e = engagementSummary(star, data);
  const deep = e.wrote > 0 || e.connected > 0 || e.seeded > 0 || (e.createdByMe && star.status === 'known');
  if (deep) return 2;
  return e.views > 0 ? 1 : 0;
}

export function buildCard(name: string, data: Data, now: Date = new Date()): CosmosCard {
  const seen = new Map<string, CardStar>();
  for (const n of data.nodes) {
    const depth = depthOf(n, data);
    if (!depth) continue;
    const title = displayName(n);
    const key = cardKey(title);
    const prev = seen.get(key);
    if (!prev || prev.depth < depth) seen.set(key, { title, category: n.category, depth });
  }
  const stars = [...seen.values()].sort((a, b) => b.depth - a.depth || a.title.localeCompare(b.title, 'ja'));
  return { app: 'knowledge-cosmos', kind: 'card', version: 1, name: name.trim().slice(0, 30), createdAt: now.toISOString(), stars };
}

/** 読み込んだファイルが宇宙カードかを確かめる。壊れた項目は捨てる */
export function parseCard(text: string): CosmosCard {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('ファイルを読めませんでした');
  }
  const r = raw as Partial<CosmosCard> | null;
  if (!r || r.app !== 'knowledge-cosmos' || r.kind !== 'card' || !Array.isArray(r.stars)) {
    throw new Error('宇宙カードのファイルではないようです（バックアップのファイルは「その他」→「復元」で使います）');
  }
  const stars: CardStar[] = [];
  for (const s of r.stars as unknown[]) {
    const x = s as Partial<CardStar> | null;
    if (!x || typeof x.title !== 'string' || !x.title.trim() || (x.depth !== 1 && x.depth !== 2)) continue;
    stars.push({ title: x.title.slice(0, 200), category: typeof x.category === 'string' ? x.category.slice(0, 50) : '', depth: x.depth });
  }
  return {
    app: 'knowledge-cosmos',
    kind: 'card',
    version: 1,
    name: typeof r.name === 'string' ? r.name.slice(0, 30) : '',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
    stars,
  };
}

export interface CompareItem {
  title: string;
  category: string;
  mine: Depth | 0;
  friend: Depth | 0;
  /** 自分の宇宙にある同じ名前の星（なければ undefined） */
  nodeId?: string;
}

export interface Comparison {
  both: CompareItem[];
  mineOnly: CompareItem[];
  friendOnly: CompareItem[];
  /** 重なり度（0〜100）：共通の星 ÷ どちらかが関わった星 */
  overlap: number;
  /** 2人とも深く関わった星 */
  bothDeep: number;
}

export function compareCards(mine: CosmosCard, friend: CosmosCard, nodes: KnowledgeNode[]): Comparison {
  const byKey = new Map<string, KnowledgeNode>();
  for (const n of nodes) {
    // 登録済みの星を優先する
    const k = cardKey(displayName(n));
    if (!byKey.has(k) || (n.status === 'known' && byKey.get(k)!.status !== 'known')) byKey.set(k, n);
  }
  const items = new Map<string, CompareItem>();
  const put = (s: CardStar, who: 'mine' | 'friend') => {
    const k = cardKey(s.title);
    const it = items.get(k) ?? { title: s.title, category: s.category, mine: 0, friend: 0, nodeId: byKey.get(k)?.id };
    if (s.depth > it[who]) it[who] = s.depth;
    if (!it.category) it.category = s.category;
    items.set(k, it);
  };
  mine.stars.forEach((s) => put(s, 'mine'));
  friend.stars.forEach((s) => put(s, 'friend'));
  const all = [...items.values()];
  const order = (a: CompareItem, b: CompareItem) => b.mine + b.friend - (a.mine + a.friend) || a.title.localeCompare(b.title, 'ja');
  const both = all.filter((i) => i.mine && i.friend).sort(order);
  return {
    both,
    mineOnly: all.filter((i) => i.mine && !i.friend).sort(order),
    friendOnly: all.filter((i) => !i.mine && i.friend).sort(order),
    overlap: all.length ? Math.round((both.length / all.length) * 100) : 0,
    bothDeep: both.filter((i) => i.mine === 2 && i.friend === 2).length,
  };
}

/** 宇宙で色分けするための、星ID → 区分 */
export type OverlayClass = 'both' | 'mine' | 'friend';

export function overlayMap(c: Comparison): Record<string, OverlayClass> {
  const out: Record<string, OverlayClass> = {};
  for (const i of c.mineOnly) if (i.nodeId) out[i.nodeId] = 'mine';
  for (const i of c.friendOnly) if (i.nodeId) out[i.nodeId] = 'friend';
  for (const i of c.both) if (i.nodeId) out[i.nodeId] = 'both';
  return out;
}
