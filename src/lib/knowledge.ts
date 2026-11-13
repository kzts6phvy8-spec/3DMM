// 知識データの決まり（リンク・つながり）。画面から独立した純粋な処理だけを置く。
// 決まりの根拠：docs/ux/03-structure.md
import type { KnowledgeNode, Statement } from '../types';

/** 記述の本文中のリンク。星の名前ではなくIDで指すので、名前を変えても切れない */
const LINK_RE = /\[\[@([^\]]+)\]\]/g;

export function linkToken(starId: string): string {
  return `[[@${starId}]]`;
}

export function parseLinkIds(text: string): string[] {
  return [...text.matchAll(LINK_RE)].map((m) => m[1]);
}

export type TextSegment = { type: 'text'; value: string } | { type: 'link'; id: string };

/** 本文を「ふつうの文字」と「リンク」に分ける（表示用） */
export function splitText(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    if (m.index! > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    out.push({ type: 'link', id: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

/** リンクを星の名前に置き換えた文字列（検索や一覧表示用） */
export function plainText(text: string, byId: Map<string, KnowledgeNode>): string {
  return text.replace(LINK_RE, (_, id: string) => {
    const n = byId.get(id);
    return n ? displayName(n) : '（不明な星）';
  });
}

export function displayName(node: Pick<KnowledgeNode, 'title' | 'qualifier'>): string {
  return node.qualifier ? `${node.title}（${node.qualifier}）` : node.title;
}

/** 言及のつながり：記述の中のリンクから自動で計算する（保存しない） */
export interface MentionEdge {
  id: string;
  a: string;
  b: string;
  /** 事実の記述からのリンクが1つでもあれば fact */
  kind: 'fact' | 'opinion';
}

export function mentionEdges(statements: Statement[], nodeIds: Set<string>): MentionEdge[] {
  const map = new Map<string, MentionEdge>();
  for (const st of statements) {
    for (const target of parseLinkIds(st.text)) {
      if (target === st.starId || !nodeIds.has(target) || !nodeIds.has(st.starId)) continue;
      const [a, b] = st.starId < target ? [st.starId, target] : [target, st.starId];
      const key = `${a}|${b}`;
      const prev = map.get(key);
      if (!prev) map.set(key, { id: `m:${key}`, a, b, kind: st.kind });
      else if (st.kind === 'fact') prev.kind = 'fact';
    }
  }
  return [...map.values()];
}

let mentionCache: { statements: Statement[]; nodes: KnowledgeNode[]; edges: MentionEdge[] } | null = null;

/** 言及のつながり（データが変わらない限り使い回す。星が1万個・記述が3万件あっても、画面の各部分で何度も数え直さないように） */
export function mentionEdgesFor(statements: Statement[], nodes: KnowledgeNode[]): MentionEdge[] {
  if (mentionCache && mentionCache.statements === statements && mentionCache.nodes === nodes) return mentionCache.edges;
  const edges = mentionEdges(statements, new Set(nodes.map((n) => n.id)));
  mentionCache = { statements, nodes, edges };
  return edges;
}

let backlinkCache: { statements: Statement[]; map: Map<string, Statement[]> } | null = null;

/** 星ID → その星にリンクしている記述（データが変わらない限り使い回す。星を開くたびに3万件の記述を調べ直さないように） */
export function backlinksOf(starId: string, statements: Statement[]): Statement[] {
  if (!backlinkCache || backlinkCache.statements !== statements) {
    const map = new Map<string, Statement[]>();
    for (const st of statements) {
      for (const id of new Set(parseLinkIds(st.text))) {
        if (id === st.starId) continue;
        (map.get(id) ?? map.set(id, []).get(id)!).push(st);
      }
    }
    backlinkCache = { statements, map };
  }
  return backlinkCache.map.get(starId) ?? [];
}
