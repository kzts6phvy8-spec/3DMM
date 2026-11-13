// 関わり方の記録（星ごと）。画面から独立した純粋な処理だけを置く。
// 「登録済みかどうか」とは別に、その星とどう関わってきたかを残す。
// 今月の発見レポート・友達の宇宙との比較などの土台になる。
import type { KnowledgeNode, Relation, Statement } from '../types';

/** 星を開いた記録 */
export interface StarEngagement {
  /** 開いた回数（続けて開いたときは1回と数える） */
  views: number;
  firstViewedAt: string;
  lastViewedAt: string;
  /** 月ごとの開いた回数。キーは「2026-11」の形 */
  monthly: Record<string, number>;
}

/** 星ID → 開いた記録 */
export type EngagementMap = Record<string, StarEngagement>;

/** この時間内にもう一度開いても、同じ1回と数える（行ったり来たりで増えすぎないように） */
const SAME_VISIT_MS = 10 * 60 * 1000;

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 星を開いたことを記録する（元のデータは変えず、新しい記録を返す） */
export function addView(map: EngagementMap, starId: string, now: Date = new Date()): EngagementMap {
  const iso = now.toISOString();
  const prev = map[starId];
  if (prev && now.getTime() - Date.parse(prev.lastViewedAt) < SAME_VISIT_MS) {
    return { ...map, [starId]: { ...prev, lastViewedAt: iso } };
  }
  const m = monthKey(now);
  const base: StarEngagement = prev ?? { views: 0, firstViewedAt: iso, lastViewedAt: iso, monthly: {} };
  return {
    ...map,
    [starId]: { ...base, views: base.views + 1, lastViewedAt: iso, monthly: { ...base.monthly, [m]: (base.monthly[m] ?? 0) + 1 } },
  };
}

/** 2つの記録を合わせる（バックアップ復元用。何度合わせても結果は同じで、記録は減らない） */
export function mergeEngagement(a: EngagementMap, b: EngagementMap): EngagementMap {
  const out: EngagementMap = { ...a };
  for (const [id, y] of Object.entries(b)) {
    const x = out[id];
    if (!x) {
      out[id] = y;
      continue;
    }
    const monthly = { ...x.monthly };
    for (const [m, n] of Object.entries(y.monthly)) monthly[m] = Math.max(monthly[m] ?? 0, n);
    out[id] = {
      views: Math.max(x.views, y.views),
      firstViewedAt: x.firstViewedAt < y.firstViewedAt ? x.firstViewedAt : y.firstViewedAt,
      lastViewedAt: x.lastViewedAt > y.lastViewedAt ? x.lastViewedAt : y.lastViewedAt,
      monthly,
    };
  }
  return out;
}

/** 読み込んだ記録の形を確かめ、壊れた項目は捨てる */
export function sanitizeEngagement(raw: unknown): EngagementMap {
  const out: EngagementMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = v as Partial<StarEngagement> | null;
    if (!e || typeof e.views !== 'number' || typeof e.firstViewedAt !== 'string' || typeof e.lastViewedAt !== 'string') continue;
    const monthly: Record<string, number> = {};
    if (e.monthly && typeof e.monthly === 'object') {
      for (const [m, n] of Object.entries(e.monthly)) if (/^\d{4}-\d{2}$/.test(m) && typeof n === 'number' && n >= 0) monthly[m] = n;
    }
    out[id] = { views: Math.max(0, Math.floor(e.views)), firstViewedAt: e.firstViewedAt, lastViewedAt: e.lastViewedAt, monthly };
  }
  return out;
}

/** 初期セットから入ったもの（記述・つながり）は、IDが「starter-」で始まる */
export function isFromStarter(id: string): boolean {
  return id.startsWith('starter-');
}

/** 星との関わり方のまとめ */
export interface EngagementSummary {
  views: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  /** 自分で加えた記述（自分で書いたもの・Wikipediaなどから選んで加えたもの） */
  wrote: number;
  /** 自分で結んだ意味のつながり */
  connected: number;
  /** 「🌱 広げる」でこの星から生まれた星 */
  seeded: number;
  /** 自分で作った星か（初期セットではない） */
  createdByMe: boolean;
}

export function engagementSummary(
  star: KnowledgeNode,
  data: { nodes: KnowledgeNode[]; statements: Statement[]; relations: Relation[]; engagement: EngagementMap },
): EngagementSummary {
  const e = data.engagement[star.id];
  return {
    views: e?.views ?? 0,
    firstViewedAt: e?.firstViewedAt ?? null,
    lastViewedAt: e?.lastViewedAt ?? null,
    wrote: data.statements.filter((s) => s.starId === star.id && !isFromStarter(s.id)).length,
    connected: data.relations.filter((r) => (r.sourceNodeId === star.id || r.targetNodeId === star.id) && !isFromStarter(r.id)).length,
    seeded: data.nodes.filter((n) => n.seedOf === star.id).length,
    createdByMe: star.origin !== 'starter',
  };
}
