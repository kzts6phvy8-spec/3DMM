// データの形（型）の定義。保存・表示・将来のAI処理はすべてこの形を共有する。
// 設計の根拠：docs/ux/02-scope.md（要件）と docs/ux/03-structure.md（構造）

export type Vec3 = [number, number, number];

export const STAR_KINDS = {
  person: '人物',
  concept: '概念',
  event: '出来事',
  place: '場所',
  work: '作品',
  term: '用語',
  other: 'その他',
} as const;
export type StarKind = keyof typeof STAR_KINDS;

/** 星の出どころ。初期セットはまとめて削除できるように印を付ける */
export type StarOrigin = 'user' | 'starter' | 'wikipedia';

/** 星（百科事典の1項目） */
export interface KnowledgeNode {
  id: string;
  /** known：登録済み ／ unknown：リンクされただけで中身がない「まだ知らない星」 */
  status: 'known' | 'unknown';
  title: string;
  /** 同じ名前で別のものを区別する補足。例：マーキュリー（惑星）の「惑星」 */
  qualifier: string;
  /** 別名・表記ゆれ。リンクの自動検出や検索に使う */
  aliases: string[];
  kind: StarKind;
  category: string;
  tags: string[];
  /** 一文の要約 */
  summary: string;
  importance: number; // 1〜5。星の大きさに反映
  position: Vec3;
  origin: StarOrigin;
  /** この星の説明に使うWikipediaの記事名（利用者が選んだもの）。なければ名前で探す */
  wikiTitle?: string;
  /** 「🌱 広げる」で生まれた星の、もとの星のID（まだ知らない星を残しておく理由になる） */
  seedOf?: string;
  createdAt: string;
  updatedAt: string;
}

/** 人が付ける確認の判断。自動で付けることは禁止 */
export type ManualCheck = 'verified' | 'disputed' | null;

/** 表示用の確認状態（自動の判定と人の判断を合わせたもの） */
export type Verification = 'unverified' | 'sourced' | 'verified' | 'disputed';

export const VERIFICATION_LABELS: Record<Verification, string> = {
  unverified: '未確認',
  sourced: '出典あり',
  verified: '確認済み',
  disputed: '異論あり',
};

/** 記述（1つの文）。本文中の [[@星ID]] は別の星へのリンク */
export interface Statement {
  id: string;
  starId: string;
  text: string;
  kind: 'fact' | 'opinion';
  /** 任意の話題。例：語源・定義・歴史 */
  topic: string;
  sourceIds: string[];
  manualCheck: ManualCheck;
  checkNote: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export const SOURCE_TYPES = {
  web: 'Webページ',
  book: '書籍',
  paper: '論文',
  other: 'その他',
} as const;
export type SourceType = keyof typeof SOURCE_TYPES;

/** 出典。複数の記述から使い回せる */
export interface Source {
  id: string;
  type: SourceType;
  title: string;
  url: string;
  author: string;
  page: string;
  addedAt: string;
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

/** 意味のつながり（自分で結ぶ明るい線） */
export interface Relation {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: RelationType;
  explanation: string; // つながる理由
  explanationKind: 'fact' | 'opinion';
  sourceIds: string[];
  manualCheck: ManualCheck;
  createdAt: string;
}

export interface CosmosData {
  version: 2;
  nodes: KnowledgeNode[];
  statements: Statement[];
  sources: Source[];
  relations: Relation[];
}
