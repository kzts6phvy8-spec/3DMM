// 今月の発見レポート：ある月に、宇宙がどう育ったかをまとめる（画面から独立した純粋な処理）。
// サーバーは使わず、端末内のデータと関わり方の記録だけから計算する。
import type { KnowledgeNode, Relation, Statement } from '../types';
import { isFromStarter, monthKey, type EngagementMap } from './engagement';
import { parseLinkIds } from './knowledge';

export interface CategoryPair {
  a: string;
  b: string;
  /** その組み合わせを初めて結んだもの（星の名前の組） */
  via: [string, string];
}

export interface MonthlyReport {
  month: string;
  /** 月の初め・終わり（今月なら今）の登録済みの星の数。初期セットは最初からあったものとして数える */
  starsBefore: number;
  starsAfter: number;
  /** この月に自分で加えた星（初期セットは除く） */
  newStars: KnowledgeNode[];
  /** この月に加えた記述の数（初期セットは除く） */
  newStatements: number;
  /** この月に結んだ意味のつながり */
  newRelations: Relation[];
  /** この月に初めてつながった分野の組み合わせ */
  newCategoryPairs: CategoryPair[];
  /** この月に開いた星の数と、その分野の数 */
  viewedStars: number;
  viewedCategories: number;
  /** この月によく開いた星（多い順） */
  topViewed: { node: KnowledgeNode; count: number }[];
}

function pairKey(a: string, b: string): [string, string, string] {
  const [x, y] = a < b ? [a, b] : [b, a];
  return [x, y, `${x}|${y}`];
}

/** データの中にある月（新しい順）。記録が何もなければ今月だけ */
export function availableMonths(
  data: { nodes: KnowledgeNode[]; statements: Statement[]; relations: Relation[]; engagement: EngagementMap },
  now: Date = new Date(),
): string[] {
  const set = new Set<string>([monthKey(now)]);
  const add = (iso: string) => {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) set.add(monthKey(new Date(t)));
  };
  for (const n of data.nodes) if (n.origin !== 'starter') add(n.createdAt);
  for (const s of data.statements) if (!isFromStarter(s.id)) add(s.createdAt);
  for (const r of data.relations) if (!isFromStarter(r.id)) add(r.createdAt);
  for (const e of Object.values(data.engagement)) for (const m of Object.keys(e.monthly)) set.add(m);
  return [...set].filter((m) => m <= monthKey(now)).sort().reverse();
}

export function buildMonthlyReport(
  month: string,
  data: { nodes: KnowledgeNode[]; statements: Statement[]; relations: Relation[]; engagement: EngagementMap },
): MonthlyReport {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime();
  const time = (iso: string) => Date.parse(iso);
  const inMonth = (iso: string) => time(iso) >= start && time(iso) < end;
  const before = (iso: string) => time(iso) < start;

  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const known = data.nodes.filter((n) => n.status === 'known');

  const newStars = known
    .filter((n) => n.origin !== 'starter' && inMonth(n.createdAt))
    .sort((a, b) => time(a.createdAt) - time(b.createdAt));
  const newStatements = data.statements.filter((s) => !isFromStarter(s.id) && inMonth(s.createdAt)).length;
  const newRelations = data.relations
    .filter((r) => !isFromStarter(r.id) && inMonth(r.createdAt))
    .sort((a, b) => time(a.createdAt) - time(b.createdAt));

  // 分野の組み合わせ：意味のつながりと、記述の中のリンクの両方から数える
  // 初期セットから入ったつながりは「最初からあったもの」として扱う（入れた月の発見には数えない）
  type Link = { a: KnowledgeNode; b: KnowledgeNode; at: string; starter: boolean };
  const links: Link[] = [];
  for (const r of data.relations) {
    const a = byId.get(r.sourceNodeId);
    const b = byId.get(r.targetNodeId);
    if (a && b) links.push({ a, b, at: r.createdAt, starter: isFromStarter(r.id) });
  }
  for (const s of data.statements) {
    const a = byId.get(s.starId);
    if (!a) continue;
    for (const id of parseLinkIds(s.text)) {
      const b = byId.get(id);
      if (b && b.id !== a.id) links.push({ a, b, at: s.createdAt, starter: isFromStarter(s.id) });
    }
  }
  const existing = new Set<string>();
  for (const l of links) {
    if (!l.a.category || !l.b.category || l.a.category === l.b.category) continue;
    if (l.starter || before(l.at)) existing.add(pairKey(l.a.category, l.b.category)[2]);
  }
  const found = new Map<string, CategoryPair>();
  for (const l of [...links].sort((p, q) => time(p.at) - time(q.at))) {
    if (!l.a.category || !l.b.category || l.a.category === l.b.category || l.starter || !inMonth(l.at)) continue;
    const [a, b, key] = pairKey(l.a.category, l.b.category);
    if (existing.has(key) || found.has(key)) continue;
    const [na, nb] = a === l.a.category ? [l.a, l.b] : [l.b, l.a];
    found.set(key, { a, b, via: [na.title, nb.title] });
  }

  const viewed = Object.entries(data.engagement)
    .map(([id, e]) => ({ node: byId.get(id), count: e.monthly[month] ?? 0 }))
    .filter((v): v is { node: KnowledgeNode; count: number } => !!v.node && v.count > 0)
    .sort((a, b) => b.count - a.count || a.node.title.localeCompare(b.node.title, 'ja'));

  // 初期セットの星は「最初からあった星」として数える
  const existedBy = (n: KnowledgeNode, t: number) => n.origin === 'starter' || time(n.createdAt) < t;
  return {
    month,
    starsBefore: known.filter((n) => existedBy(n, start)).length,
    starsAfter: known.filter((n) => existedBy(n, end)).length,
    newStars,
    newStatements,
    newRelations,
    newCategoryPairs: [...found.values()],
    viewedStars: viewed.length,
    viewedCategories: new Set(viewed.map((v) => v.node.category).filter(Boolean)).size,
    topViewed: viewed.slice(0, 5),
  };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
}
