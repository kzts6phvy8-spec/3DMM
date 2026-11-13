// つながりの候補を見つける（AIを使わない、ルールによる提案）。
// 提案は候補にすぎない。つなぐかどうかは必ず利用者が決める（基本方針5）。
import type { KnowledgeNode, Relation, Statement } from '../types';
import { displayName, mentionEdgesFor, parseLinkIds, plainText } from './knowledge';
import { normalize } from './search';
import { cleanTitle } from './wikipedia';

export interface Suggestion {
  starId: string;
  score: number;
  reasons: string[];
}

function namesOf(n: KnowledgeNode): string[] {
  return [n.title, ...n.aliases].filter((x) => x.length >= 2);
}

/** すでに直接つながっている星（言及・意味のつながり） */
export function directNeighbors(starId: string, statements: Statement[], relations: Relation[], nodes: KnowledgeNode[]): Set<string> {
  const set = new Set<string>();
  for (const m of mentionEdgesFor(statements, nodes)) {
    if (m.a === starId) set.add(m.b);
    if (m.b === starId) set.add(m.a);
  }
  for (const r of relations) {
    if (r.sourceNodeId === starId) set.add(r.targetNodeId);
    if (r.targetNodeId === starId) set.add(r.sourceNodeId);
  }
  return set;
}

interface Prepared {
  nodes: KnowledgeNode[];
  statements: Statement[];
  /** 星ごとの本文（概要＋記述）を「検索しやすい形」にしたもの */
  texts: Map<string, string>;
  /** 星ごとの、記述の中のリンク先 */
  linksOf: Map<string, Set<string>>;
  /** 星ごとの名前（検索しやすい形） */
  names: Map<string, string[]>;
}

let prepared: Prepared | null = null;

function textFor(node: KnowledgeNode | undefined, own: Statement[], byId: Map<string, KnowledgeNode>): string {
  return [normalize(node?.summary ?? ''), ...own.map((st) => normalize(plainText(st.text, byId)))].join(' ');
}

/**
 * 候補を出すための準備データ。データが変わらない限り使い回す（星が1万個あっても、候補を出すたびに作り直さない）。
 * 記述を1つ足しただけのときは、変わった星の分だけ作り直す（名前が変わったときは全部作り直す）。
 */
/** つながりの候補の計算に使う下ごしらえを、先に済ませておく（星のページを初めて開いたときに待たせないように） */
export function warmSuggest(nodes: KnowledgeNode[], statements: Statement[]) {
  prepare(nodes, statements, new Map(nodes.map((n) => [n.id, n])));
}

function prepare(nodes: KnowledgeNode[], statements: Statement[], byId: Map<string, KnowledgeNode>): Prepared {
  const prev = prepared;
  if (prev && prev.nodes === nodes && prev.statements === statements) return prev;
  const byStar = new Map<string, Statement[]>();
  for (const st of statements) (byStar.get(st.starId) ?? byStar.set(st.starId, []).get(st.starId)!).push(st);
  const linksOf = new Map<string, Set<string>>();
  for (const [id, own] of byStar) linksOf.set(id, new Set(own.flatMap((st) => parseLinkIds(st.text))));

  // 前の準備データから、変わった星だけを作り直せるか
  let changed: Set<string> | null = null;
  if (prev && prev.nodes.length === nodes.length) {
    const prevById = new Map(prev.nodes.map((n) => [n.id, n]));
    changed = new Set<string>();
    for (const n of nodes) {
      const old = prevById.get(n.id);
      if (!old || displayName(old) !== displayName(n) || old.aliases.join() !== n.aliases.join()) {
        changed = null; // 名前が変わると、ほかの星の本文（リンクの表示）も変わるので全部作り直す
        break;
      }
      if (old.summary !== n.summary) changed.add(n.id);
    }
    if (changed) {
      const before = new Set(prev.statements);
      const after = new Set(statements);
      for (const st of statements) if (!before.has(st)) changed.add(st.starId);
      for (const st of prev.statements) if (!after.has(st)) changed.add(st.starId);
    }
  }
  let texts: Map<string, string>;
  let names: Map<string, string[]>;
  if (changed && prev) {
    texts = new Map(prev.texts);
    for (const id of changed) texts.set(id, textFor(byId.get(id), byStar.get(id) ?? [], byId));
    names = prev.names;
  } else {
    texts = new Map();
    for (const n of nodes) texts.set(n.id, textFor(n, byStar.get(n.id) ?? [], byId));
    names = new Map(nodes.map((n) => [n.id, namesOf(n).map(normalize)]));
  }
  prepared = { nodes, statements, texts, linksOf, names };
  return prepared;
}

export function suggestConnections(
  target: KnowledgeNode,
  nodes: KnowledgeNode[],
  statements: Statement[],
  relations: Relation[],
  limit = 6,
  /** つなぐ画面用：記述のリンクだけでつながっている星や、同じ分野の星も候補に入れる */
  forConnect = false,
): Suggestion[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // つなぐ画面では、すでに意味のつながりがある星だけを除く
  const neighbors = forConnect
    ? new Set(
        relations
          .filter((r) => r.sourceNodeId === target.id || r.targetNodeId === target.id)
          .map((r) => (r.sourceNodeId === target.id ? r.targetNodeId : r.sourceNodeId)),
      )
    : directNeighbors(target.id, statements, relations, nodes);
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

  // 星ごとの本文（リンクは名前に置き換えた、ふつうの文字）など。データが変わらない限り使い回す
  const prep = prepare(nodes, statements, byId);
  const textOf = prep.texts;

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
      const norm = prep.names.get(n.id) ?? [];
      const i = norm.findIndex((nm) => myText.includes(nm));
      if (i >= 0) add(n.id, 3, `この星の記述に「${namesOf(n)[i]}」が出てくる`);
    }
  }

  // ③ 共通の星にどちらもつながっている
  const linksOf = prep.linksOf;
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

  if (forConnect) {
    // 記述のリンクでつながっている星（まだ意味のつながりがない）
    for (const m of mentionEdgesFor(statements, nodes)) {
      const other = m.a === target.id ? m.b : m.b === target.id ? m.a : null;
      if (other) add(other, 2, '記述の中でつながっている（理由はまだない）');
    }
    // 同じ分野
    if (target.category) {
      for (const n of nodes) if (n.category === target.category) add(n.id, 0.5, `同じ分野「${target.category}」`);
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
    action: 'query', prop: 'links', titles: target.wikiTitle ?? cleanTitle(target.title), plnamespace: '0', pllimit: 'max',
    redirects: '1', format: 'json', origin: '*',
  });
  const res = await fetch(`https://ja.wikipedia.org/w/api.php?${params}`, { signal });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const d = await res.json();
  const pages = Object.values(d?.query?.pages ?? {}) as { links?: { title: string }[] }[];
  const linked = new Set(pages.flatMap((p) => p.links ?? []).map((l) => normalize(l.title)));
  if (!linked.size) return [];
  const neighbors = directNeighbors(target.id, statements, relations, nodes);
  const out: Suggestion[] = [];
  for (const n of nodes) {
    if (n.id === target.id || n.status !== 'known' || neighbors.has(n.id)) continue;
    if ([n.title, displayName(n), ...n.aliases].some((nm) => linked.has(normalize(nm)))) {
      out.push({ starId: n.id, score: 4, reasons: [`Wikipediaの「${target.wikiTitle ?? cleanTitle(target.title)}」の記事で触れられている`] });
    }
  }
  return out;
}
