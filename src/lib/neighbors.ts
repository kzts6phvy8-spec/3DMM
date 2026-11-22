// 選んだ星と「つながっている星」を集める（3D空間で光らせる・カメラを合わせる・名前を出すのに使う）
// 1歩目（直接つながっている星）と、2歩目（その先の星）を返す。
// 星が1万個あっても軽いように、つながりの表はデータが変わったときだけ作り直す。
import type { KnowledgeNode, Relation, Statement } from '../types';
import { parseLinkIds } from './knowledge';

type Data = { statements: Statement[]; relations: Relation[]; nodes: KnowledgeNode[] };

let cache: { statements: Statement[]; relations: Relation[]; nodes: KnowledgeNode[]; adj: Map<string, Set<string>> } | null = null;

/** 星ID → つながっている星IDの表（記述のリンク・逆リンク・自分で結んだ線・広げた星。向きは区別しない） */
function adjacency(data: Data): Map<string, Set<string>> {
  if (cache && cache.statements === data.statements && cache.relations === data.relations && cache.nodes === data.nodes) return cache.adj;
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
    (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a);
  };
  for (const st of data.statements) for (const id of parseLinkIds(st.text)) link(st.starId, id);
  for (const r of data.relations) link(r.sourceNodeId, r.targetNodeId);
  for (const n of data.nodes) if (n.seedOf) link(n.seedOf, n.id);
  cache = { statements: data.statements, relations: data.relations, nodes: data.nodes, adj };
  return adj;
}

/** 選んだ星自身と、1歩目の星のID */
export function neighborIds(id: string | null, data: Data): Set<string> {
  const set = new Set<string>();
  if (!id) return set;
  set.add(id);
  for (const x of adjacency(data).get(id) ?? []) set.add(x);
  return set;
}

/** 2歩目の星のID（1歩目の星とつながっている星のうち、選んだ星と1歩目の星を除いたもの） */
export function secondRingIds(id: string | null, data: Data, first = neighborIds(id, data)): Set<string> {
  const set = new Set<string>();
  if (!id) return set;
  const adj = adjacency(data);
  for (const f of first) {
    if (f === id) continue;
    for (const x of adj.get(f) ?? []) if (!first.has(x)) set.add(x);
  }
  return set;
}
