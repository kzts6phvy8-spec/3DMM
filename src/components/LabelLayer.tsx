// 星の名前ラベルを並べる層。どの星の名前をどこに出すかは、3D側（LabelProjector）が毎フレーム決める。
// 要素は決まった数だけ作って使い回す（星が1万個あっても、画面の部品を1万個作らないように）
import { memo } from 'react';
import { useCosmos } from '../store/useCosmos';
import { LABEL_POOL_SIZE, labelPool, labelSlots } from '../lib/labelRegistry';

const slots = Array.from({ length: LABEL_POOL_SIZE }, (_, i) => i);

export const LabelLayer = memo(function LabelLayer() {
  return (
    <div className="label-layer">
      {slots.map((i) => (
        <div
          key={i}
          className="star-label"
          style={{ visibility: 'hidden' }}
          // 名前を押しても、その星を選べる（星が密集していても、狙った星を選びやすいように）
          onClick={(e) => {
            const id = labelSlots.get(e.currentTarget)?.id;
            if (id) useCosmos.getState().tapNode(id);
          }}
          ref={(el) => {
            if (el) labelPool[i] = el;
          }}
        />
      ))}
    </div>
  );
});
