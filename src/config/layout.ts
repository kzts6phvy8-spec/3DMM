// 主な操作の置き場所（骨格の層 ①）。3案を見比べた結果、A（下部バー）に決定（2026-11-13）。
//   A：下部バーに「探す・リスト・＋追加・その他」
//   B：上部バーに同じ4つを並べる
//   C：右下に丸い「＋」、ほかは右上の「⋯」の中
export type LayoutVariant = 'A' | 'B' | 'C';
export const LAYOUT: LayoutVariant = 'A';
