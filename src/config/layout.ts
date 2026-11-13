// 主な操作の置き場所（骨格の層 ①）。試しブランチではこの1行だけを変えて見比べる。
//   A：下部バーに「探す・リスト・＋追加・その他」
//   B：上部バーに同じ4つを並べる
//   C：右下に丸い「＋」、ほかは右上の「⋯」の中
export type LayoutVariant = 'A' | 'B' | 'C';
export const LAYOUT: LayoutVariant = 'A';
