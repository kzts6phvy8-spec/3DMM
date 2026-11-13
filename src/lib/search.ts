// 検索用の小さな部品。接続先の検索と、今後の検索画面（F6）で共通に使う
import type { KnowledgeNode } from '../types';
import { displayName } from './knowledge';

/** 表記ゆれを吸収する：全角/半角・大文字/小文字・カタカナ/ひらがなを同じに扱う */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .trim();
}

/** 名前・別名・カテゴリー・タグ・概要から探し、名前に近いものほど上に並べる */
export function searchNodes(nodes: KnowledgeNode[], query: string, limit = 8): KnowledgeNode[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { node: KnowledgeNode; score: number }[] = [];
  for (const node of nodes) {
    const title = normalize(displayName(node));
    const names = [node.title, ...node.aliases].map(normalize);
    let score = 0;
    if (names.some((n) => n === q)) score = 100;
    else if (names.some((n) => n.startsWith(q))) score = 80;
    else if (title.includes(q) || names.some((n) => n.includes(q))) score = 60;
    else if (node.tags.some((t) => normalize(t).includes(q))) score = 40;
    else if (normalize(node.category).includes(q)) score = 30;
    else if (normalize(node.summary).includes(q)) score = 20;
    if (node.status === 'unknown') score -= 5; // 登録済みの星を先に出す
    if (score > 0) scored.push({ node, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title, 'ja'))
    .slice(0, limit)
    .map((s) => s.node);
}
