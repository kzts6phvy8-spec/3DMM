// 「その他」の中の「アカウントと同期」（ログインはAIで調べるにも使う。同期は有料プラン）。ログイン・プランの確認・今すぐ同期・ログアウト。
import { useState } from 'react';
import { openBillingPortal, refreshPlan, signIn, signOut, signUp, startCheckout, syncNow, useSync } from '../sync/sync';
import { syncConfigured } from '../sync/config';
import type { Billing } from '../sync/sync';

function formatTime(iso: string | null) {
  if (!iso) return 'まだ';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function billingText(b: Billing) {
  if (b.source === 'manual') return '管理画面で有料（お支払いなし）';
  const end = b.periodEnd ? `（次の更新：${formatTime(b.periodEnd).split(' ')[0]}）` : '';
  if (b.status === 'past_due') return `お支払いを確かめられていません。カードを確かめてください${end}`;
  if (b.status === 'canceling') return b.periodEnd ? `解約済み（${formatTime(b.periodEnd).split(' ')[0]}まで有料）` : '解約済み（期間の終わりまで有料）';
  return `Stripeでお支払い中${end}`;
}

export function SyncSection() {
  const { email, plan, status, message, lastSyncedAt, billing } = useSync();
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
        <h3>アカウントと同期</h3>
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
      <h3>アカウントと同期</h3>
      <dl className="meta">
        <dt>ログイン中</dt><dd>{email}</dd>
        <dt>プラン</dt><dd>{plan === 'paid' ? '有料' : plan === 'free' ? '無料' : '確認中…'}</dd>
        {plan === 'paid' && billing && (
          <><dt>お支払い</dt><dd>{billingText(billing)}</dd></>
        )}
        {plan === 'paid' && (<><dt>最後の同期</dt><dd>{status === 'syncing' ? '同期しています…' : formatTime(lastSyncedAt)}</dd></>)}
      </dl>
      {plan === 'free' && (
        <>
          <p className="muted small">有料プランでは、AIで調べるが月300回まで（無料は月20回）になり、端末の同期も使えます。お支払いはStripe（カード決済のサービス）の画面で行います。いつでも解約できます。</p>
          <div className="more-actions">
            <button className="primary" disabled={busy} onClick={() => void run(() => startCheckout('month'))}>有料プランにする（月額）</button>
            <button disabled={busy} onClick={() => void run(() => startCheckout('year'))}>有料プランにする（年額）</button>
          </div>
        </>
      )}
      {note && <p className="more-message is-error">{note}</p>}
      {message && <p className="more-message is-error">{message}</p>}
      <div className="more-actions">
        {plan === 'paid' && (
          <button disabled={status === 'syncing'} onClick={() => void syncNow()}>🔄 今すぐ同期</button>
        )}
        {plan === 'free' && <button onClick={() => void refreshPlan()}>プランを確かめ直す</button>}
        {billing?.hasCustomer && (
          <button disabled={busy} onClick={() => void run(() => openBillingPortal())}>お支払いの管理（解約・カードの変更）</button>
        )}
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
