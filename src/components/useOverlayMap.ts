// 友達の宇宙と重ねて表示しているときの、星ID → 区分（共通・自分だけ・友達だけ）。
// 今のデータから毎回計算するので、重ねている間に星を開いたり記述を加えたりしても色がすぐ変わる。
import { useMemo } from 'react';
import { useCosmos } from '../store/useCosmos';
import { buildCard, compareCards, overlayMap, type OverlayClass } from '../lib/compare';

export function useOverlayMap(): Record<string, OverlayClass> | null {
  const overlay = useCosmos((s) => s.overlay);
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const relations = useCosmos((s) => s.relations);
  // 重ねていないときは、関わり方の記録が変わっても計算し直さない（星を描き直さないように）
  const engagement = useCosmos((s) => (s.overlay ? s.engagement : null));
  return useMemo(() => {
    if (!overlay || !engagement) return null;
    const mine = buildCard('', { nodes, statements, relations, engagement });
    return overlayMap(compareCards(mine, overlay.card, nodes));
  }, [overlay, nodes, statements, relations, engagement]);
}
