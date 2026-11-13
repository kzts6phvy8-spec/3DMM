// 初期セットなどのデータを、今のデータを消さずに追加・削除する
import type { CosmosData, KnowledgeNode } from '../types';
import { displayName, parseLinkIds } from '../lib/knowledge';

type Data = Omit<CosmosData, 'version'>;

/**
 * 追加するデータを今のデータに合流させる。
 * - 同じ名前の星がすでにあれば、新しく作らずにその星へリンクをつなぎ替える
 * - 今ある星が「まだ知らない星」なら、追加データの中身で登録済みにする
 * - 同じ名前の星には、足りない記述だけを足す（今ある記述は変えない・消さない）
 * - 概要が空なら、追加データの概要で埋める
 */
export function mergeDataset(current: Data, incoming: Data): { data: Data; added: number } {
  const byName = new Map<string, KnowledgeNode>();
  for (const n of current.nodes) {
    for (const name of [displayName(n), n.title]) if (!byName.has(name)) byName.set(name, n);
  }
  // IDで引ける表（星が1万個あっても、1つずつ探し直さないように）
  const currentById = new Map(current.nodes.map((n) => [n.id, n]));

  const remap = new Map<string, string>(); // 追加データのID → 今のデータのID
  const upgrade = new Set<string>(); // 中身を入れる「まだ知らない星」
  const fillSummary = new Map<string, string>(); // 概要が空の星 → 埋める概要
  const newNodes: KnowledgeNode[] = [];

  for (const n of incoming.nodes) {
    const same = currentById.get(n.id) ?? byName.get(displayName(n)) ?? (n.qualifier ? undefined : byName.get(n.title));
    if (same) {
      remap.set(n.id, same.id);
      if (same.status === 'unknown' && n.status === 'known') upgrade.add(same.id);
      else if (!same.summary && n.summary) fillSummary.set(same.id, n.summary);
      continue;
    }
    remap.set(n.id, n.id);
    newNodes.push(n);
  }

  const mapText = (text: string) => text.replace(/\[\[@([^\]]+)\]\]/g, (_, id: string) => `[[@${remap.get(id) ?? id}]]`);
  const incomingById = new Map(incoming.nodes.map((n) => [n.id, n]));

  // 中身を入れる「まだ知らない星」→ 追加データの登録済みの星
  const upgradeSource = new Map<string, KnowledgeNode>();
  for (const x of incoming.nodes) {
    const to = remap.get(x.id);
    if (to && upgrade.has(to) && x.status === 'known' && !upgradeSource.has(to)) upgradeSource.set(to, x);
  }
  const nodes = current.nodes.map((n) => {
    if (fillSummary.has(n.id)) return { ...n, summary: fillSummary.get(n.id)! };
    if (!upgrade.has(n.id)) return n;
    const src = upgradeSource.get(n.id);
    return src ? { ...src, id: n.id, position: n.position } : n;
  });

  // 同じ星に同じ文がすでにあれば足さない（何度合流しても重複しない）
  const existingStatementIds = new Set(current.statements.map((s) => s.id));
  const existingTexts = new Set(current.statements.map((s) => `${s.starId}|${s.text}`));
  const statements = [...current.statements];
  for (const st of incoming.statements) {
    if (existingStatementIds.has(st.id) || !incomingById.has(st.starId)) continue;
    const starId = remap.get(st.starId) ?? st.starId;
    const text = mapText(st.text);
    if (existingTexts.has(`${starId}|${text}`)) continue;
    existingTexts.add(`${starId}|${text}`);
    statements.push({ ...st, starId, text });
  }

  const existingSourceIds = new Set(current.sources.map((s) => s.id));
  const sources = [...current.sources, ...incoming.sources.filter((s) => !existingSourceIds.has(s.id))];

  const existingRelationIds = new Set(current.relations.map((r) => r.id));
  const relations = [
    ...current.relations,
    ...incoming.relations
      .filter((r) => !existingRelationIds.has(r.id))
      .map((r) => ({ ...r, sourceNodeId: remap.get(r.sourceNodeId) ?? r.sourceNodeId, targetNodeId: remap.get(r.targetNodeId) ?? r.targetNodeId })),
  ];

  // 新しい星は、今の宇宙で同じ分野の星が集まっている場所の近くに置く（星団がばらけないように）
  const centroid = (list: KnowledgeNode[]) => {
    const map = new Map<string, { sum: number[]; n: number }>();
    for (const n of list) {
      if (n.status !== 'known' || !n.category) continue;
      const e = map.get(n.category) ?? { sum: [0, 0, 0], n: 0 };
      n.position.forEach((v, k) => (e.sum[k] += v));
      e.n++;
      map.set(n.category, e);
    }
    return new Map([...map].map(([k, e]) => [k, e.sum.map((v) => v / e.n)]));
  };
  const curC = centroid(current.nodes);
  const inC = centroid(incoming.nodes);
  const placed = newNodes.map((n) => {
    const a = curC.get(n.category);
    const b = inC.get(n.category);
    if (!a || !b) return n;
    return { ...n, position: n.position.map((v, k) => v - b[k] + a[k]) as KnowledgeNode['position'] };
  });

  return {
    data: { nodes: [...nodes, ...placed], statements, sources, relations },
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

  // 初期セットの記述を消す。ただし、自分で記述を書き足して残す初期セットの星の記述は残す
  const keptStarter = new Set(current.nodes.filter((n) => n.origin === 'starter' && !removeIds.has(n.id)).map((n) => n.id));
  let statements = current.statements.filter((s) => !isStarterStatement(s.id) || keptStarter.has(s.starId));
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
