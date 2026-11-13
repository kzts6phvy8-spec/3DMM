// 星の名前ラベルを並べる層。位置は3D側（LabelProjector）が毎フレーム更新する
import { memo, useEffect, useMemo } from 'react';
import { useCosmos } from '../store/useCosmos';
import { labelElements } from '../lib/labelRegistry';
import { displayName } from '../lib/knowledge';

const SEP_FIELD = '\u0001';
const SEP_ITEM = '\u0002';

let sigCache: { nodes: unknown; sig: string } | null = null;

/** ラベルの一覧の「しるし」（名前と状態）。星の一覧が同じなら作り直さない（ほかの操作のたびに1万個分の文字列を作らないように） */
function signatureOf(nodes: { id: string; title: string; qualifier: string; status: string }[]): string {
  if (sigCache && sigCache.nodes === nodes) return sigCache.sig;
  const sig = nodes.map((n) => [n.id, displayName(n), n.status].join(SEP_FIELD)).join(SEP_ITEM);
  sigCache = { nodes, sig };
  return sig;
}

// 親の画面が描き直されても、星の一覧が変わらない限り1万個のラベルを描き直さない
export const LabelLayer = memo(function LabelLayer() {
  // 星の位置が動いても（ドラッグ中など）ラベルの一覧は作り直さない。名前・状態が変わったときだけ作り直す
  const signature = useCosmos((s) => signatureOf(s.nodes));
  const items = useMemo(
    () => (signature ? signature.split(SEP_ITEM).map((x) => { const [id, name, status] = x.split(SEP_FIELD); return { id, name, status }; }) : []),
    [signature],
  );
  // 選んでいる星のラベルだけ、印を付け替える（星が1万個あっても、選ぶたびに全部のラベルを描き直さないように）
  useEffect(() => {
    let marked: string[] = [];
    const apply = (ids: (string | null)[]) => {
      for (const id of marked) labelElements.get(id)?.classList.remove('is-selected');
      marked = ids.filter((x): x is string => !!x);
      for (const id of marked) labelElements.get(id)?.classList.add('is-selected');
    };
    const { selectedId, connectFromId } = useCosmos.getState();
    apply([selectedId, connectFromId]);
    return useCosmos.subscribe((st, prev) => {
      if (st.selectedId !== prev.selectedId || st.connectFromId !== prev.connectFromId) apply([st.selectedId, st.connectFromId]);
    });
  }, [items]);

  return (
    <div className="label-layer">
      {items.map((n) => (
        <div
          key={n.id}
          className={`star-label${n.status === 'unknown' ? ' is-unknown' : ''}`}
          style={{ visibility: 'hidden' }}
          // 名前を押しても、その星を選べる（星が密集していても、狙った星を選びやすいように）
          onClick={() => useCosmos.getState().tapNode(n.id)}
          ref={(el) => {
            if (el) labelElements.set(n.id, el);
            else labelElements.delete(n.id);
          }}
        >
          {n.name}
        </div>
      ))}
    </div>
  );
});
