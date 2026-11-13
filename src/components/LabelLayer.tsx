// 星の名前ラベルを並べる層。位置は3D側（LabelProjector）が毎フレーム更新する
import { useCosmos } from '../store/useCosmos';
import { labelElements } from '../lib/labelRegistry';
import { displayName } from '../lib/knowledge';

export function LabelLayer() {
  const nodes = useCosmos((s) => s.nodes);
  const selectedId = useCosmos((s) => s.selectedId);
  const connectFromId = useCosmos((s) => s.connectFromId);
  return (
    <div className="label-layer" aria-hidden="true">
      {nodes.map((n) => (
        <div
          key={n.id}
          className={`star-label${n.id === selectedId || n.id === connectFromId ? ' is-selected' : ''}${n.status === 'unknown' ? ' is-unknown' : ''}`}
          style={{ visibility: 'hidden' }}
          ref={(el) => {
            if (el) labelElements.set(n.id, el);
            else labelElements.delete(n.id);
          }}
        >
          {displayName(n)}
        </div>
      ))}
    </div>
  );
}
