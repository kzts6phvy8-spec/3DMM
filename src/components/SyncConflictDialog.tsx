// 2つの端末の両方で変更があったとき（または初めて同期するとき）に、どちらを残すかを聞く。
import { useCosmos } from '../store/useCosmos';
import { postponeConflict, resolveConflict, useSync } from '../sync/sync';

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SyncConflictDialog() {
  const conflict = useSync((s) => s.conflict);
  const busy = useSync((s) => s.status === 'syncing');
  const nodes = useCosmos((s) => s.nodes);
  if (!conflict) return null;
  const knownHere = nodes.filter((n) => n.status === 'known').length;
  const knownThere = conflict.remote.data.nodes.filter((n) => n.status === 'known').length;
  const ownHere = nodes.filter((n) => n.status === 'known' && n.origin !== 'starter').length;
  const ownThere = conflict.remote.data.nodes.filter((n) => n.status === 'known' && n.origin !== 'starter').length;

  return (
    <div className="modal-backdrop streak-backdrop">
      <section className="streak-card sync-conflict" role="dialog" aria-label="どちらのデータを残すか">
        <p className="streak-big">どちらを残しますか？</p>
        <p className="streak-text">
          {conflict.firstTime
            ? 'この端末と、保存されているデータの両方に内容があります。'
            : 'この端末と、ほかの端末の両方で変更がありました。'}
          片方を選ぶと、もう片方の変更は消えます（直後は「元に戻す」ができます）。
        </p>
        <dl className="meta sync-compare">
          <dt>この端末</dt><dd>星{knownHere}個（自分で作った星 {ownHere}個）</dd>
          <dt>保存されているデータ</dt><dd>星{knownThere}個（自分で作った星 {ownThere}個）・{formatTime(conflict.remoteUpdatedAt)}</dd>
        </dl>
        <div className="streak-actions">
          <button className="primary" disabled={busy} onClick={() => void resolveConflict('local')}>この端末のデータを残す</button>
          <button className="primary" disabled={busy} onClick={() => void resolveConflict('remote')}>保存されているデータにする</button>
          <button disabled={busy} onClick={postponeConflict}>あとで決める</button>
        </div>
      </section>
    </div>
  );
}
