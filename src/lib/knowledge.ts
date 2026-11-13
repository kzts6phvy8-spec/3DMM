// 知識データの決まり（リンク・確認状態・つながり）。画面から独立した純粋な処理だけを置く。
// 決まりの根拠：docs/ux/03-structure.md
import type { KnowledgeNode, ManualCheck, Relation, Statement, Verification } from '../types';

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

/**
 * 確認状態を決める。
 * - 出典0個 → 未確認、1個以上 → 出典あり（自動）
 * - 確認済みは、出典が1個以上あるときだけ有効（人が付ける）
 * - 異論ありは、人が付ければ有効
 */
export function verificationOf(item: { sourceIds: string[]; manualCheck: ManualCheck }): Verification {
  if (item.manualCheck === 'disputed') return 'disputed';
  if (item.manualCheck === 'verified' && item.sourceIds.length > 0) return 'verified';
  return item.sourceIds.length > 0 ? 'sourced' : 'unverified';
}

export function statementVerification(st: Statement): Verification | null {
  return st.kind === 'opinion' ? null : verificationOf(st);
}

export function relationVerification(r: Relation): Verification | null {
  return r.explanationKind === 'opinion' ? null : verificationOf(r);
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

/** 星の確かさのまとめ。例：事実5件中、確認済み4件 */
export function starCertainty(starId: string, statements: Statement[]) {
  const facts = statements.filter((s) => s.starId === starId && s.kind === 'fact');
  const count = (v: Verification) => facts.filter((s) => verificationOf(s) === v).length;
  return {
    facts: facts.length,
    verified: count('verified'),
    sourced: count('sourced'),
    unverified: count('unverified'),
    disputed: count('disputed'),
  };
}
