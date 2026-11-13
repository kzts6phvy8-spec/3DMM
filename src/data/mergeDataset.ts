// 初期セットなどのデータを、今のデータを消さずに追加・削除する
import type { CosmosData, KnowledgeNode } from '../types';
import { displayName, parseLinkIds } from '../lib/knowledge';

type Data = Omit<CosmosData, 'version'>;

/**
 * 追加するデータを今のデータに合流させる。
 * - 同じ名前の星がすでにあれば、新しく作らずにその星へリンクをつなぎ替える
 * - 今ある星が「まだ知らない星」なら、追加データの中身で登録済みにする
 * - 自分で登録した星の中身（記述）は変えない
 */
export function mergeDataset(current: Data, incoming: Data): { data: Data; added: number } {
  const byName = new Map<string, KnowledgeNode>();
  for (const n of current.nodes) {
    for (const name of [displayName(n), n.title]) if (!byName.has(name)) byName.set(name, n);
  }
  const existingIds = new Set(current.nodes.map((n) => n.id));

  const remap = new Map<string, string>(); // 追加データのID → 今のデータのID
  const upgrade = new Set<string>(); // 中身を入れる「まだ知らない星」
  const skipContent = new Set<string>(); // 記述を追加しない星（自分で登録した星）
  const newNodes: KnowledgeNode[] = [];

  for (const n of incoming.nodes) {
    if (existingIds.has(n.id)) {
      remap.set(n.id, n.id);
      skipContent.add(n.id);
      continue;
    }
    const same = byName.get(displayName(n)) ?? (n.qualifier ? undefined : byName.get(n.title));
    if (same) {
      remap.set(n.id, same.id);
      if (same.status === 'unknown' && n.status === 'known') upgrade.add(same.id);
      else skipContent.add(n.id);
      continue;
    }
    remap.set(n.id, n.id);
    newNodes.push(n);
  }

  const mapText = (text: string) => text.replace(/\[\[@([^\]]+)\]\]/g, (_, id: string) => `[[@${remap.get(id) ?? id}]]`);
  const incomingById = new Map(incoming.nodes.map((n) => [n.id, n]));

  const nodes = current.nodes.map((n) => {
    if (!upgrade.has(n.id)) return n;
    const src = incoming.nodes.find((x) => remap.get(x.id) === n.id && x.status === 'known');
    return src ? { ...src, id: n.id, position: n.position } : n;
  });

  const existingStatementIds = new Set(current.statements.map((s) => s.id));
  const statements = [
    ...current.statements,
    ...incoming.statements
      .filter((st) => !existingStatementIds.has(st.id))
      .filter((st) => {
        const owner = incomingById.get(st.starId);
        return owner && !skipContent.has(owner.id);
      })
      .map((st) => ({ ...st, starId: remap.get(st.starId) ?? st.starId, text: mapText(st.text) })),
  ];

  const existingSourceIds = new Set(current.sources.map((s) => s.id));
  const sources = [...current.sources, ...incoming.sources.filter((s) => !existingSourceIds.has(s.id))];

  const existingRelationIds = new Set(current.relations.map((r) => r.id));
  const relations = [
    ...current.relations,
    ...incoming.relations
      .filter((r) => !existingRelationIds.has(r.id))
      .map((r) => ({ ...r, sourceNodeId: remap.get(r.sourceNodeId) ?? r.sourceNodeId, targetNodeId: remap.get(r.targetNodeId) ?? r.targetNodeId })),
  ];

  return {
    data: { nodes: [...nodes, ...newNodes], statements, sources, relations },
    added: newNodes.filter((n) => n.status === 'known').length + upgrade.size,
  };
}

/**
 * 初期セット（origin = 'starter'）をまとめて削除する。
 * ただし、自分で記述を書き足した星は残す（あなたの書いた内容を消さないため）。
 */
export function removeStarter(current: Data): { data: Data; removed: number } {
  const isStarterStatement = (id: string) => id.startsWith('starter-');
  const touched = new Set(current.statements.filter((s) => !isStarterStatement(s.id)).map((s) => s.starId));
  const removeIds = new Set(current.nodes.filter((n) => n.origin === 'starter' && !touched.has(n.id)).map((n) => n.id));

  let statements = current.statements.filter((s) => !(isStarterStatement(s.id) && removeIds.has(s.starId)));
  const relations = current.relations.filter(
    (r) => !(r.id.startsWith('starter-') || removeIds.has(r.sourceNodeId) || removeIds.has(r.targetNodeId)),
  );

  // 自分の記述からリンクされている星は「まだ知らない星」として残す
  const linked = new Set<string>();
  for (const st of statements) for (const id of parseLinkIds(st.text)) linked.add(id);
  for (const r of relations) {
    linked.add(r.sourceNodeId);
    linked.add(r.targetNodeId);
  }
  const nodes = current.nodes
    .filter((n) => !removeIds.has(n.id) || linked.has(n.id))
    .map((n) =>
      removeIds.has(n.id) ? { ...n, status: 'unknown' as const, summary: '', aliases: [], tags: [] } : n,
    );
  const nodeIds = new Set(nodes.map((n) => n.id));
  statements = statements.filter((s) => nodeIds.has(s.starId));

  // 使われなくなった初期セットの出典を消す
  const usedSources = new Set([...statements.flatMap((s) => s.sourceIds), ...relations.flatMap((r) => r.sourceIds)]);
  const sources = current.sources.filter((s) => !s.id.startsWith('starter-') || usedSources.has(s.id));

  return { data: { nodes, statements, sources, relations }, removed: removeIds.size };
}
