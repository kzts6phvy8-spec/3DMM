// データの形（型）の定義。保存・表示・将来のAI処理はすべてこの形を共有する。

export type Vec3 = [number, number, number];

/** 知識ノード（宇宙に浮かぶ1つの星） */
export interface KnowledgeNode {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  sourceUrl: string;
  createdAt: string; // ISO 8601 形式の日時
  updatedAt: string;
  position: Vec3; // 3D空間上の座標
  importance: number; // 1〜5。星の大きさに反映
}

export const RELATION_TYPES = {
  causal: '因果関係',
  similarity: '類似性',
  historical: '歴史的関係',
  opposition: '対立・反論',
  application: '応用・発展',
  partWhole: '部分と全体',
  other: 'その他',
} as const;

export type RelationType = keyof typeof RELATION_TYPES;

/** 関係性（星と星を結ぶ光の線） */
export interface Relation {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: RelationType;
  explanation: string; // つながる理由
  createdAt: string;
}

export interface CosmosData {
  nodes: KnowledgeNode[];
  relations: Relation[];
}
