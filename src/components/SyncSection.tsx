// 「その他」の中の「端末の同期（有料プラン）」。ログイン・プランの確認・今すぐ同期・ログアウト。
import { useState } from 'react';
import { refreshPlan, signIn, signOut, signUp, syncNow, useSync } from '../sync/sync';
import { syncConfigured } from '../sync/config';

function formatTime(iso: string | null) {
  if (!iso) return 'まだ';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SyncSection() {
  const { email, plan, status, message, lastSyncedAt } = useSync();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!syncConfigured()) return null;

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setNote(null);
    try {
      setNote(await fn());
    } finally {
      setBusy(false);
    }
  };

  // ---- ログインしていない ----
  if (!email) {
    const ok = form.email.includes('@') && form.password.length >= 6;
    return (
      <>
        <h3>端末の同期（有料プラン）</h3>
        <p className="muted small">ログインすると、iPhoneとPCなど、ほかの端末と同じ宇宙を使えます。</p>
        <form
          className="sync-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) void run(() => signIn(form.email.trim(), form.password));
          }}
        >
          <label className="field">
            メールアドレス
            <input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="field">
            パスワード（6文字以上）
            <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <div className="more-actions">
            <button type="submit" className="primary" disabled={!ok || busy}>ログイン</button>
            <button
              type="button"
              disabled={!ok || busy}
              onClick={() =>
                void run(async () => {
                  const r = await signUp(form.email.trim(), form.password);
                  if (r.error) return r.error;
                  return r.needConfirm ? '確認のメールを送りました。メールのリンクを押してから、ここでログインしてください。' : null;
                })
              }
            >
              新しく登録する
            </button>
          </div>
        </form>
        {note && <p className="more-message">{note}</p>}
      </>
    );
  }

  // ---- ログインしている ----
  return (
    <>
      <h3>端末の同期（有料プラン）</h3>
      <dl className="meta">
        <dt>ログイン中</dt><dd>{email}</dd>
        <dt>プラン</dt><dd>{plan === 'paid' ? '有料' : plan === 'free' ? '無料' : '確認中…'}</dd>
        {plan === 'paid' && (<><dt>最後の同期</dt><dd>{status === 'syncing' ? '同期しています…' : formatTime(lastSyncedAt)}</dd></>)}
      </dl>
      {plan === 'free' && (
        <p className="muted small">端末の同期は有料プランの機能です。申し込みの仕組みはまだ準備中です。</p>
      )}
      {message && <p className="more-message is-error">{message}</p>}
      <div className="more-actions">
        {plan === 'paid' && (
          <button disabled={status === 'syncing'} onClick={() => void syncNow()}>🔄 今すぐ同期</button>
        )}
        {plan === 'free' && <button onClick={() => void refreshPlan()}>プランを確かめ直す</button>}
        <button
          onClick={() => {
            if (window.confirm('ログアウトしますか？\nこの端末のデータは消えません。')) void signOut();
          }}
        >
          ログアウト
        </button>
      </div>
    </>
  );
}
