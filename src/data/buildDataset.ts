// 初期データ（サンプル・初期セット）を、人が読み書きしやすい形から組み立てる。
// 記述の中の [[名前]] は、星へのリンク [[@ID]] に変換する。
// 登録されていない名前は「まだ知らない星」として自動で作る。
import type { CosmosData, KnowledgeNode, Relation, RelationType, Source, SourceType, StarKind, Statement, Vec3 } from '../types';
import { displayName } from '../lib/knowledge';

export interface SourceSpec {
  key: string;
  type: SourceType;
  title: string;
  url?: string;
  author?: string;
}

export interface StatementSpec {
  text: string;
  kind?: 'fact' | 'opinion';
  topic?: string;
  /** SourceSpec の key */
  sources?: string[];
}

export interface StarSpec {
  key: string;
  title: string;
  qualifier?: string;
  aliases?: string[];
  kind: StarKind;
  category: string;
  tags?: string[];
  summary: string;
  importance?: number;
  position?: Vec3;
  statements: StatementSpec[];
}

export interface RelationSpec {
  from: string; // StarSpec の key
  to: string;
  type: RelationType;
  explanation: string;
  kind?: 'fact' | 'opinion';
  sources?: string[];
}

export interface DatasetSpec {
  origin: KnowledgeNode['origin'];
  /** 作成日時として記録する値 */
  createdAt: string;
  sources: SourceSpec[];
  stars: StarSpec[];
  relations?: RelationSpec[];
}

const NAME_LINK_RE = /\[\[([^\]@][^\]]*)\]\]/g;

export function buildDataset(spec: DatasetSpec): CosmosData {
  const t = spec.createdAt;
  const idOf = (key: string) => `${spec.origin}-${key}`;

  const sources: Source[] = spec.sources.map((s) => ({
    id: idOf(`src-${s.key}`),
    type: s.type,
    title: s.title,
    url: s.url ?? '',
    author: s.author ?? '',
    page: '',
    addedAt: t,
  }));
  const sourceId = (key: string) => {
    if (!spec.sources.some((s) => s.key === key)) throw new Error(`出典 ${key} がありません`);
    return idOf(`src-${key}`);
  };

  const nodes: KnowledgeNode[] = spec.stars.map((s, i) => ({
    id: idOf(s.key),
    status: 'known',
    title: s.title,
    qualifier: s.qualifier ?? '',
    aliases: s.aliases ?? [],
    kind: s.kind,
    category: s.category,
    tags: s.tags ?? [],
    summary: s.summary,
    importance: s.importance ?? 3,
    position: s.position ?? fallbackPosition(i, spec.stars.length),
    origin: spec.origin,
    createdAt: t,
    updatedAt: t,
  }));

  // 名前（表示名・名前・別名）から星を探す表
  const byName = new Map<string, KnowledgeNode>();
  const register = (n: KnowledgeNode, aliases: string[] = []) => {
    for (const name of [displayName(n), n.title, ...aliases]) if (!byName.has(name)) byName.set(name, n);
  };
  nodes.forEach((n, i) => register(n, spec.stars[i].aliases));

  let unknownCount = 0;
  const resolve = (name: string, near: KnowledgeNode): string => {
    const found = byName.get(name);
    if (found) return found.id;
    // まだ知らない星を、リンク元の星の近くに作る
    const angle = unknownCount * 2.399; // 黄金角で散らす
    unknownCount++;
    const unknown: KnowledgeNode = {
      id: idOf(`unknown-${unknownCount}`),
      status: 'unknown',
      title: name,
      qualifier: '',
      aliases: [],
      kind: 'other',
      category: '',
      tags: [],
      summary: '',
      importance: 1,
      position: [
        near.position[0] + Math.cos(angle) * 2.2,
        near.position[1] + Math.sin(angle * 1.3) * 1.6,
        near.position[2] + Math.sin(angle) * 2.2,
      ],
      origin: spec.origin,
      createdAt: t,
      updatedAt: t,
    };
    nodes.push(unknown);
    register(unknown);
    return unknown.id;
  };

  const statements: Statement[] = [];
  spec.stars.forEach((s, i) => {
    const star = nodes[i];
    s.statements.forEach((st, order) => {
      statements.push({
        id: idOf(`${s.key}-st${order}`),
        starId: star.id,
        text: st.text.replace(NAME_LINK_RE, (_, name: string) => `[[@${resolve(name, star)}]]`),
        kind: st.kind ?? 'fact',
        topic: st.topic ?? '',
        sourceIds: (st.sources ?? []).map(sourceId),
        manualCheck: null, // AIが用意したものは「確認済み」にしない
        checkNote: '',
        order,
        createdAt: t,
        updatedAt: t,
      });
    });
  });

  const relations: Relation[] = (spec.relations ?? []).map((r, i) => ({
    id: idOf(`rel-${i}`),
    sourceNodeId: idOf(r.from),
    targetNodeId: idOf(r.to),
    relationType: r.type,
    explanation: r.explanation,
    explanationKind: r.kind ?? 'fact',
    sourceIds: (r.sources ?? []).map(sourceId),
    manualCheck: null,
    createdAt: t,
  }));

  return { version: 2, nodes, statements, sources, relations };
}

/** 座標の指定がない星を、球面上に散らして置く */
function fallbackPosition(i: number, total: number): Vec3 {
  const y = 1 - (2 * (i + 0.5)) / Math.max(total, 1);
  const r = Math.sqrt(1 - y * y);
  const theta = i * 2.399;
  const radius = 6 + total * 0.08;
  return [Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius];
}
