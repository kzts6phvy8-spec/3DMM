// 選んだ星と「つながっている星」を集める（3D空間で光らせる・カメラを合わせる・名前を出すのに使う）
import type { KnowledgeNode, Relation, Statement } from '../types';
import { backlinksOf, parseLinkIds } from './knowledge';

/** 選んだ星自身と、記述のリンク・逆リンク・自分で結んだ線・広げた星でつながっている星のID */
export function neighborIds(id: string | null, data: { statements: Statement[]; relations: Relation[]; nodes: KnowledgeNode[] }): Set<string> {
  const set = new Set<string>();
  if (!id) return set;
  set.add(id);
  for (const st of data.statements) if (st.starId === id) parseLinkIds(st.text).forEach((x) => set.add(x));
  for (const st of backlinksOf(id, data.statements)) set.add(st.starId);
  for (const r of data.relations) {
    if (r.sourceNodeId === id) set.add(r.targetNodeId);
    if (r.targetNodeId === id) set.add(r.sourceNodeId);
  }
  for (const n of data.nodes) if (n.seedOf === id) set.add(n.id);
  return set;
}
