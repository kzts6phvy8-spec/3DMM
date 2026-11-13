// 保存処理。UIや3D表示から切り離しておくことで、
// 将来クラウド同期に差し替えるときもこのファイルだけ変えればよい。
import { createStore, get, set } from 'idb-keyval';
import type { CosmosData, KnowledgeNode, Relation, Source, Statement, Vec3 } from '../types';

export interface CosmosRepository {
  /** 保存データを読み込む。まだ何も保存されていなければ null */
  load(): Promise<CosmosData | null>;
  save(data: CosmosData): Promise<void>;
  /** 一度だけ行う処理の記録（例：初期セットの自動追加） */
  getFlag(name: string): Promise<boolean>;
  setFlag(name: string): Promise<void>;
}

const store = createStore('knowledge-cosmos', 'data');
const KEY_V1 = 'cosmos-v1';
const KEY_V2 = 'cosmos-v2';

export const indexedDbRepository: CosmosRepository = {
  async load() {
    const v2 = await get<CosmosData>(KEY_V2, store);
    if (v2) return dropCheckFields(v2);
    // 旧い形（v1）のデータがあれば、新しい形に移し替える。v1のデータは消さずに残す
    const v1 = await get<V1Data>(KEY_V1, store);
    if (v1) {
      const migrated = migrateV1(v1);
      await set(KEY_V2, migrated, store);
      return migrated;
    }
    return null;
  },
  async save(data) {
    await set(KEY_V2, data, store);
  },
  async getFlag(name) {
    return (await get<boolean>(`flag:${name}`, store)) === true;
  },
  async setFlag(name) {
    await set(`flag:${name}`, true, store);
  },
};

/**
 * 以前あった「確認状態」（確認済み・異論あり）の項目を取り除く。
 * 2026-11-13にファクトチェック機能をなくしたため。出典・事実／意見の区別はそのまま残す。
 */
export function dropCheckFields(data: CosmosData): CosmosData {
  const strip = <T extends object>(item: T): T => {
    if (!('manualCheck' in item) && !('checkNote' in item)) return item;
    const { manualCheck: _m, checkNote: _c, ...rest } = item as T & { manualCheck?: unknown; checkNote?: unknown };
    return rest as T;
  };
  return { ...data, statements: data.statements.map(strip), relations: data.relations.map(strip) };
}

// ---- v1（最初のプロトタイプ）からの移行 ----

interface V1Node {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
  position: Vec3;
  importance: number;
}
interface V1Relation {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: Relation['relationType'];
  explanation: string;
  createdAt: string;
}
interface V1Data {
  nodes: V1Node[];
  relations: V1Relation[];
}

/** v1の「説明」は、事実の記述1件（出典URLがあれば出典付き）として引き継ぐ */
export function migrateV1(v1: V1Data): CosmosData {
  const nodes: KnowledgeNode[] = [];
  const statements: Statement[] = [];
  const sources: Source[] = [];
  for (const n of v1.nodes) {
    nodes.push({
      id: n.id,
      status: 'known',
      title: n.title,
      qualifier: '',
      aliases: [],
      kind: 'other',
      category: n.category,
      tags: n.tags,
      summary: '',
      importance: n.importance,
      position: n.position,
      origin: 'user',
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    });
    const sourceIds: string[] = [];
    if (n.sourceUrl) {
      const id = `src-${n.id}`;
      sources.push({ id, type: 'web', title: n.sourceUrl, url: n.sourceUrl, author: '', page: '', addedAt: n.updatedAt });
      sourceIds.push(id);
    }
    if (n.description) {
      statements.push({
        id: `st-${n.id}`,
        starId: n.id,
        text: n.description,
        kind: 'fact',
        topic: '',
        sourceIds,
        order: 0,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      });
    }
  }
  const relations: Relation[] = v1.relations.map((r) => ({
    ...r,
    explanationKind: 'fact',
    sourceIds: [],
  }));
  return { version: 2, nodes, statements, sources, relations };
}
