// Knowledge Chain のデータの形（仕様 v1.0 の 5. データ構造）。
// 知識（ノード）と接続は分けて持つ。接続は双方向として扱う。

/** 出典（根拠資料） */
export interface ChainSource {
  title: string;
  url: string;
}

/** 知識ノード */
export interface ChainNode {
  id: string;
  /** 名称 */
  name: string;
  /** 説明（クリア後の解説で使う） */
  description: string;
  /** 分野 */
  field: string;
  sources: ChainSource[];
  /** 行き止まりとして意図したノード（つながりが1本だけでよい） */
  deadEnd?: boolean;
}

/** 関係の種類 */
export type ChainRelationType = '師弟' | '影響' | '発見・発明' | '著作・作品' | '場所' | '出来事' | '概念' | '比較';

/** 接続（双方向） */
export interface ChainEdge {
  id: string;
  from: string;
  to: string;
  type: ChainRelationType;
  /** 接続理由（なぜつながっているか。事実として書く） */
  reason: string;
  /** 根拠資料 */
  sources: ChainSource[];
}

/** 知識のネットワーク（いくつかのステージで使い回す） */
export interface ChainNetwork {
  id: string;
  title: string;
  /**
   * 人間が確認したデータか（仕様 5：初期版では人間が確認したデータだけを使う）。
   * Claude が下書きした段階では false。利用者が中身を確認したら true にする。
   */
  reviewed: boolean;
  nodes: ChainNode[];
  edges: ChainEdge[];
}

/** ステージ（スタートとゴールの組） */
export interface ChainStage {
  id: string;
  title: string;
  networkId: string;
  start: string;
  goal: string;
}
