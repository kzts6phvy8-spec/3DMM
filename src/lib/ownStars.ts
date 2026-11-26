// 「自分の星だけ表示」（2026-11-26、利用者の要望）で使う決まり。画面から独立させておく。
import type { KnowledgeNode } from '../types';

/** 自分の星：登録済みで、初期セットから入ったものではない星（自分で作った星・AIで調べて足した星・メモから作った星） */
export const isOwnStar = (n: Pick<KnowledgeNode, 'status' | 'origin'>) => n.status === 'known' && n.origin !== 'starter';

/**
 * 「自分の星だけ表示」のときに宇宙で隠す星のID。表示していないときは null。
 * 開いている星は、自分の星でなくても隠さない（つながりをたどって初期セットの星を開いたときに、宇宙から消えないように）
 */
export function hiddenStarIds(nodes: KnowledgeNode[], ownOnly: boolean, selectedId: string | null): Set<string> | null {
  if (!ownOnly) return null;
  return new Set(nodes.filter((n) => !isOwnStar(n) && n.id !== selectedId).map((n) => n.id));
}
