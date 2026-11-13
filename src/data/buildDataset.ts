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
  /**
   * SourceSpec の key（他の星の記事は `wp-その星のキー`）。
   * 省略した事実の記述には、その星のWikipedia記事が自動で付く。空配列なら出典なし。
   */
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
  /** この星の出典にするWikipedia（日本語版）の記事名。出典 `wp-キー` が自動で作られる */
  wp?: string;
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
  sources?: SourceSpec[];
  stars: StarSpec[];
  relations?: RelationSpec[];
}

const NAME_LINK_RE = /\[\[([^\]@][^\]]*)\]\]/g;

export function buildDataset(spec: DatasetSpec): CosmosData {
  const t = spec.createdAt;
  const idOf = (key: string) => `${spec.origin}-${key}`;

  const sourceSpecs: SourceSpec[] = [
    ...(spec.sources ?? []),
    ...spec.stars
      .filter((s) => s.wp)
      .map((s) => ({
        key: `wp-${s.key}`,
        type: 'web' as const,
        title: `Wikipedia：${s.wp}`,
        url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(s.wp!)}`,
      })),
  ];
  const sources: Source[] = sourceSpecs.map((s) => ({
    id: idOf(`src-${s.key}`),
    type: s.type,
    title: s.title,
    url: s.url ?? '',
    author: s.author ?? '',
    page: '',
    addedAt: t,
  }));
  const sourceId = (key: string) => {
    if (!sourceSpecs.some((s) => s.key === key)) throw new Error(`出典 ${key} がありません`);
    return idOf(`src-${key}`);
  };

  const layout = clusterLayout(spec.stars);
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
    position: s.position ?? layout[i],
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
        sourceIds: (st.sources ?? (st.kind !== 'opinion' && s.wp ? [`wp-${s.key}`] : [])).map(sourceId),
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

/** 文字列から決まった疑似乱数を作る（毎回同じ配置にするため） */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * 座標の指定がない星を、カテゴリーごとのまとまり（星団）に分けて置く。
 * 同じ分野の星は近くに、違う分野は離れた場所に集まる。
 */
function clusterLayout(stars: StarSpec[]): Vec3[] {
  const categories = [...new Set(stars.map((s) => s.category))];
  const counts = new Map<string, number>();
  for (const s of stars) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  const centers = new Map<string, Vec3>();
  // 星団の大きさは星の数に合わせ、星団どうしが重ならない距離に中心を並べる
  const spreadOf = (c: string) => 4 + Math.sqrt(counts.get(c) ?? 1) * 1.8;
  const R = 10 + Math.sqrt(stars.length) * 1.8;
  categories.forEach((c, i) => {
    // カテゴリーの中心を球面上に均等に並べる
    const y = categories.length === 1 ? 0 : 1 - (2 * i) / (categories.length - 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399;
    centers.set(c, [Math.cos(theta) * r * R, y * R * 0.75, Math.sin(theta) * r * R]);
  });
  const pos: Vec3[] = stars.map((s) => {
    if (s.position) return [...s.position] as Vec3;
    const rand = seeded(s.key);
    const c = centers.get(s.category)!;
    const sp = spreadOf(s.category);
    // 星団の中に、球状に散らす
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const rr = Math.cbrt(rand()) * sp;
    const ru = Math.sqrt(1 - u * u);
    return [c[0] + Math.cos(th) * ru * rr, c[1] + u * rr * 0.8, c[2] + Math.sin(th) * ru * rr];
  });
  // 近すぎる星を少しずつ押し離す（格子に分けて、近くの星どうしだけを比べる）
  const MIN = 3.0;
  for (let iter = 0; iter < 30; iter++) {
    const grid = new Map<string, number[]>();
    const cell = (p: Vec3) => p.map((v) => Math.floor(v / MIN));
    pos.forEach((p, i) => {
      const k = cell(p).join(',');
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
    });
    let moved = false;
    for (let i = 0; i < pos.length; i++) {
      const [cx, cy, cz] = cell(pos[i]);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
              if (j <= i) continue;
              const d = [pos[j][0] - pos[i][0], pos[j][1] - pos[i][1], pos[j][2] - pos[i][2]];
              const len = Math.hypot(d[0], d[1], d[2]) || 0.01;
              if (len >= MIN) continue;
              const push = (MIN - len) / 2 / len;
              moved = true;
              for (let k = 0; k < 3; k++) {
                if (!stars[i].position) pos[i][k] -= d[k] * push;
                if (!stars[j].position) pos[j][k] += d[k] * push;
              }
            }
          }
    }
    if (!moved) break;
  }
  // 全体の中心を原点にそろえる（カメラが宇宙の中心を向くように）
  const free = pos.filter((_, i) => !stars[i].position);
  if (free.length) {
    const c = [0, 1, 2].map((k) => free.reduce((sum, p) => sum + p[k], 0) / free.length);
    pos.forEach((p, i) => {
      if (!stars[i].position) for (let k = 0; k < 3; k++) p[k] -= c[k];
    });
  }
  return pos;
}
