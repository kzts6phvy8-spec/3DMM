// つながりの候補を見つける（AIを使わない、ルールによる提案）。
// 提案は候補にすぎない。つなぐかどうかは必ず利用者が決める（基本方針5）。
import type { KnowledgeNode, Relation, Statement } from '../types';
import { displayName, mentionEdges, parseLinkIds, plainText } from './knowledge';
import { normalize } from './search';

export interface Suggestion {
  starId: string;
  score: number;
  reasons: string[];
}

function namesOf(n: KnowledgeNode): string[] {
  return [n.title, ...n.aliases].filter((x) => x.length >= 2);
}

/** すでに直接つながっている星（言及・意味のつながり） */
export function directNeighbors(starId: string, statements: Statement[], relations: Relation[], nodeIds: Set<string>): Set<string> {
  const set = new Set<string>();
  for (const m of mentionEdges(statements, nodeIds)) {
    if (m.a === starId) set.add(m.b);
    if (m.b === starId) set.add(m.a);
  }
  for (const r of relations) {
    if (r.sourceNodeId === starId) set.add(r.targetNodeId);
    if (r.targetNodeId === starId) set.add(r.sourceNodeId);
  }
  return set;
}

export function suggestConnections(
  target: KnowledgeNode,
  nodes: KnowledgeNode[],
  statements: Statement[],
  relations: Relation[],
  limit = 6,
): Suggestion[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = new Set(byId.keys());
  const neighbors = directNeighbors(target.id, statements, relations, nodeIds);
  const map = new Map<string, Suggestion>();
  const add = (id: string, score: number, reason: string) => {
    if (id === target.id || neighbors.has(id)) return;
    const n = byId.get(id);
    if (!n || n.status !== 'known') return;
    const s = map.get(id) ?? { starId: id, score: 0, reasons: [] };
    s.score += score;
    if (!s.reasons.includes(reason) && s.reasons.length < 3) s.reasons.push(reason);
    map.set(id, s);
  };

  // 星ごとの本文（リンクは名前に置き換えた、ふつうの文字）
  const textOf = new Map<string, string>();
  for (const n of nodes) textOf.set(n.id, normalize(n.summary));
  for (const st of statements) textOf.set(st.starId, (textOf.get(st.starId) ?? '') + ' ' + normalize(plainText(st.text, byId)));

  // ① ほかの星の記述に、この星の名前が出てくる
  const myNames = namesOf(target).map(normalize);
  for (const [id, text] of textOf) {
    if (id === target.id) continue;
    const hit = myNames.find((nm) => text.includes(nm));
    if (hit) add(id, 3, `「${displayName(byId.get(id)!)}」の記述に「${target.title}」が出てくる`);
  }

  // ② この星の記述に、ほかの星の名前が出てくる
  const myText = textOf.get(target.id) ?? '';
  if (myText.trim()) {
    for (const n of nodes) {
      if (n.id === target.id || n.status !== 'known') continue;
      const hit = namesOf(n).find((nm) => myText.includes(normalize(nm)));
      if (hit) add(n.id, 3, `この星の記述に「${hit}」が出てくる`);
    }
  }

  // ③ 共通の星にどちらもつながっている
  const linksOf = new Map<string, Set<string>>();
  for (const st of statements) {
    const set = linksOf.get(st.starId) ?? new Set<string>();
    parseLinkIds(st.text).forEach((x) => set.add(x));
    linksOf.set(st.starId, set);
  }
  const mine = new Set([...(linksOf.get(target.id) ?? []), ...neighbors]);
  for (const [id, links] of linksOf) {
    if (id === target.id) continue;
    const shared = [...links].filter((x) => mine.has(x) && x !== target.id && x !== id);
    if (shared.length) {
      const name = byId.get(shared[0]);
      add(id, Math.min(shared.length, 3), `どちらも「${name ? displayName(name) : '?'}」につながっている`);
    }
  }

  // ④ 同じタグ
  const myTags = new Set(target.tags.map(normalize));
  if (myTags.size) {
    for (const n of nodes) {
      const shared = n.tags.filter((t) => myTags.has(normalize(t)));
      if (shared.length) add(n.id, shared.length, `同じタグ「#${shared[0]}」`);
    }
  }

  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Wikipediaの記事が触れている言葉のうち、宇宙にある星を探す（ネットにつながっているときのみ） */
export async function suggestFromWikipedia(
  target: KnowledgeNode,
  nodes: KnowledgeNode[],
  statements: Statement[],
  relations: Relation[],
  signal?: AbortSignal,
): Promise<Suggestion[]> {
  const params = new URLSearchParams({
    action: 'query', prop: 'links', titles: target.title, plnamespace: '0', pllimit: 'max',
    redirects: '1', format: 'json', origin: '*',
  });
  const res = await fetch(`https://ja.wikipedia.org/w/api.php?${params}`, { signal });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const d = await res.json();
  const pages = Object.values(d?.query?.pages ?? {}) as { links?: { title: string }[] }[];
  const linked = new Set(pages.flatMap((p) => p.links ?? []).map((l) => normalize(l.title)));
  if (!linked.size) return [];
  const neighbors = directNeighbors(target.id, statements, relations, new Set(nodes.map((n) => n.id)));
  const out: Suggestion[] = [];
  for (const n of nodes) {
    if (n.id === target.id || n.status !== 'known' || neighbors.has(n.id)) continue;
    if ([n.title, displayName(n), ...n.aliases].some((nm) => linked.has(normalize(nm)))) {
      out.push({ starId: n.id, score: 4, reasons: [`Wikipediaの「${target.title}」の記事で触れられている`] });
    }
  }
  return out;
}
