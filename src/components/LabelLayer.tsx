// 星の名前ラベルを並べる層。位置は3D側（LabelProjector）が毎フレーム更新する
import { useMemo } from 'react';
import { useCosmos } from '../store/useCosmos';
import { labelElements } from '../lib/labelRegistry';
import { displayName } from '../lib/knowledge';

const SEP_FIELD = '\u0001';
const SEP_ITEM = '\u0002';

export function LabelLayer() {
  // 星の位置が動いても（ドラッグ中など）ラベルの一覧は作り直さない。名前・状態が変わったときだけ作り直す
  const signature = useCosmos((s) =>
    s.nodes.map((n) => [n.id, displayName(n), n.status].join(SEP_FIELD)).join(SEP_ITEM),
  );
  const selectedId = useCosmos((s) => s.selectedId);
  const connectFromId = useCosmos((s) => s.connectFromId);
  const items = useMemo(
    () => (signature ? signature.split(SEP_ITEM).map((x) => { const [id, name, status] = x.split(SEP_FIELD); return { id, name, status }; }) : []),
    [signature],
  );
  return (
    <div className="label-layer" aria-hidden="true">
      {items.map((n) => (
        <div
          key={n.id}
          className={`star-label${n.id === selectedId || n.id === connectFromId ? ' is-selected' : ''}${n.status === 'unknown' ? ' is-unknown' : ''}`}
          style={{ visibility: 'hidden' }}
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
}
