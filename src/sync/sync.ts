// 端末の同期（有料プランの機能）。
// - ログイン：メールアドレスとパスワード（Supabase Auth）
// - 預ける場所：Supabase の表 cosmos_sync（1人1行。宇宙のデータ全体を圧縮して保存）
// - 食い違ったとき：片方だけ変わっていれば自動でそろえる。両方変わっていたら、どちらを残すか利用者に聞く
// 画面（SyncSection・SyncConflict）とは、このファイルの useSync と関数だけでつながる。
import { create } from 'zustand';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useCosmos } from '../store/useCosmos';
import { BILLING_FUNCTION, SUPABASE_KEY, SUPABASE_URL, syncConfigured } from './config';
import { decodePayload, encodePayload, type SyncPayload } from './payload';

type Plan = 'free' | 'paid' | null;

export interface SyncConflict {
  /** 保存されているデータ（ほかの端末が保存したもの） */
  remote: SyncPayload;
  remoteVersion: number;
  remoteUpdatedAt: string;
  /** この端末に、まだ送っていない変更があるか（初めての同期のときは false でも聞く） */
  firstTime: boolean;
}

interface SyncState {
  email: string | null;
  plan: Plan;
  status: 'off' | 'idle' | 'syncing' | 'error';
  message: string | null;
  lastSyncedAt: string | null;
  conflict: SyncConflict | null;
  /** 支払いの様子（有料になった理由・Stripeの契約の状態）。列がまだない古い表では null */
  billing: Billing | null;
}

export interface Billing {
  /** manual：管理画面で手動で有料（開発用など）／stripe：Stripeで支払い */
  source: 'manual' | 'stripe';
  /** Stripe のお客さま番号があるか（お支払いの管理画面を開けるか） */
  hasCustomer: boolean;
  status: string | null;
  periodEnd: string | null;
}

export const useSync = create<SyncState>(() => ({
  email: null,
  plan: null,
  status: 'off',
  message: null,
  lastSyncedAt: null,
  conflict: null,
  billing: null,
}));

// ---- この端末の同期の記録（localStorage） ----
interface Local {
  userId: string;
  /** この端末が最後にそろえた、保存データの番号（0 は一度もそろえていない） */
  version: number;
  /** 最後にそろえてから、この端末で変更があったか */
  dirty: boolean;
  lastSyncedAt: string | null;
}
const LOCAL_KEY = 'cosmos-sync';
const DEVICE_KEY = 'cosmos-device-id';

function readLocal(userId: string): Local {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null');
    if (raw && raw.userId === userId && typeof raw.version === 'number') return raw as Local;
  } catch {
    // 読めなければ、一度もそろえていない扱いにする
  }
  return { userId, version: 0, dirty: false, lastSyncedAt: null };
}
function writeLocal(l: Local) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(l));
  } catch {
    // 保存できない場合は、次に開いたとき「初めての同期」として扱われる（どちらを残すか聞かれる）
  }
}
function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `${navigator.platform || 'device'}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

// ---- Supabase につなぐ（使うときだけ読み込む。同期を使わない人の読み込みを軽くするため） ----
let clientPromise: Promise<SupabaseClient> | null = null;
export function client(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } }),
    );
  }
  return clientPromise;
}

let session: Session | null = null;

/** この端末に、前にログインした記録が残っているか（Supabase のライブラリは sb-〇〇-auth-token に保存する） */
function hasSavedLogin(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? '';
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  } catch {
    return true; // わからないときは、確かめに行く
  }
  return false;
}
let listening = false;
/** ログアウト・鍵の更新を見張る（1回だけ登録する） */
async function listenAuth() {
  if (listening) return;
  listening = true;
  const sb = await client();
  sb.auth.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_OUT') void afterLogin(null);
    else if (event === 'TOKEN_REFRESHED') session = s;
  });
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e));

/** ログインの失敗理由を、わかる言葉にする */
function authMessage(e: unknown): string {
  const m = errorText(e);
  if (/Invalid login credentials/i.test(m)) return 'メールアドレスかパスワードが違います。';
  if (/Email not confirmed/i.test(m)) return 'メールアドレスの確認がまだです。届いたメールのリンクを押してから、もう一度ログインしてください。';
  if (/already registered|already exists/i.test(m)) return 'このメールアドレスは登録済みです。ログインしてください。';
  if (/Password should be at least/i.test(m)) return 'パスワードは6文字以上にしてください。';
  if (/rate limit/i.test(m)) return '試す回数が多すぎます。しばらく待ってから、もう一度試してください。';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'ネットにつながっていないようです。';
  return `うまくいきませんでした（${m}）`;
}

async function loadPlan(): Promise<Plan> {
  if (!session) return null;
  const sb = await client();
  const userId = session.user.id;
  const full = await sb
    .from('profiles')
    .select('plan, plan_source, stripe_customer_id, subscription_status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  let row: { plan?: string } | null = full.data;
  if (full.error) {
    // 支払いの列をまだ足していない表（supabase/billing.sql を実行する前）でも、プランだけは読めるようにする
    const basic = await sb.from('profiles').select('plan').eq('user_id', userId).maybeSingle();
    if (basic.error) throw basic.error;
    row = basic.data;
    useSync.setState({ billing: null });
  } else if (full.data) {
    const d = full.data;
    useSync.setState({
      billing: {
        source: d.plan_source === 'stripe' ? 'stripe' : 'manual',
        hasCustomer: !!d.stripe_customer_id,
        status: d.subscription_status ?? null,
        periodEnd: d.current_period_end ?? null,
      },
    });
  }
  return row?.plan === 'paid' ? 'paid' : 'free';
}

async function afterLogin(s: Session | null) {
  session = s;
  if (!s) {
    useSync.setState({ email: null, plan: null, status: 'off', message: null, lastSyncedAt: null, conflict: null, billing: null });
    return;
  }
  const local = readLocal(s.user.id);
  useSync.setState({ email: s.user.email ?? null, lastSyncedAt: local.lastSyncedAt, status: 'idle', message: null });
  try {
    const plan = await loadPlan();
    useSync.setState({ plan });
    if (plan === 'paid') await syncNow();
  } catch (e) {
    useSync.setState({ status: 'error', message: `プランを確かめられませんでした（${errorText(e)}）` });
  }
}

// ---- 有料プランの支払い（Stripe） ----
/** 支払いのあとに戻ってくる場所（今のページ。?billing=… は付け直す） */
const returnUrl = () => location.origin + location.pathname;

async function callBilling(body: Record<string, string>): Promise<{ url?: string; error?: string }> {
  const sb = await client();
  const { data, error } = await sb.functions.invoke(BILLING_FUNCTION, { body: { ...body, returnUrl: returnUrl() } });
  if (error) {
    let reason: string | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const b = await ctx.json();
        // Stripe が返した理由があれば添える（原因がわかるように）
        reason = b?.error ? `${b.error}${b.detail ? `（Stripeからの理由：${String(b.detail).slice(0, 200)}）` : ''}` : undefined;
      }
    } catch {
      /* 読めなければ一般的な文にする */
    }
    return { error: reason ?? '支払いの仕組みにつながりませんでした。通信を確かめて、もう一度試してください。' };
  }
  return data as { url?: string };
}

/** 支払い画面（Stripe）へ移る。うまくいかなければ理由を返す */
export async function startCheckout(interval: 'month' | 'year'): Promise<string | null> {
  if (!session) return 'ログインしてください';
  const r = await callBilling({ action: 'checkout', interval });
  if (r.url) {
    location.href = r.url;
    return null;
  }
  return r.error ?? '支払い画面を開けませんでした';
}

/** お支払いの管理画面（解約・カードの変更）へ移る */
export async function openBillingPortal(): Promise<string | null> {
  if (!session) return 'ログインしてください';
  const r = await callBilling({ action: 'portal' });
  if (r.url) {
    location.href = r.url;
    return null;
  }
  return r.error ?? 'お支払いの管理画面を開けませんでした';
}

/**
 * 支払いの画面から戻ってきたとき（?billing=success など）。
 * 有料になったという知らせ（Webhook）は少し遅れて届くことがあるので、数秒ごとに何度かプランを確かめ直す。
 */
async function afterBillingReturn() {
  const state = new URLSearchParams(location.search).get('billing');
  if (!state) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (state !== 'success') {
    await refreshPlan();
    return;
  }
  useSync.setState({ message: 'お支払いを確かめています…' });
  for (let i = 0; i < 10; i++) {
    try {
      if ((await loadPlan()) === 'paid') {
        useSync.setState({ message: '有料プランになりました。ありがとうございます。' });
        await refreshPlan();
        useSync.setState({ message: '有料プランになりました。ありがとうございます。' });
        return;
      }
    } catch {
      /* 次の回で確かめ直す */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  useSync.setState({ message: 'お支払いは受け付けました。有料プランへの切り替えに時間がかかっています。少し待ってから「プランを確かめ直す」を押してください。' });
}

/** 起動したときに呼ぶ。前にログインしていれば、そのまま同期を始める */
export async function startSync() {
  if (!syncConfigured()) return;
  // 一度もログインしていない端末では、Supabase のライブラリを読み込まない（起動を軽くするため）
  if (!hasSavedLogin()) return;
  const sb = await client();
  const { data } = await sb.auth.getSession();
  await listenAuth();
  await afterLogin(data.session);
  if (data.session) await afterBillingReturn();
}

export async function signIn(email: string, password: string): Promise<string | null> {
  try {
    const sb = await client();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return authMessage(error);
    await listenAuth();
    await afterLogin(data.session);
    return null;
  } catch (e) {
    return authMessage(e);
  }
}

/** 新しく登録する。確認メールのリンクを押すと、ログインできるようになる */
export async function signUp(email: string, password: string): Promise<{ error: string | null; needConfirm: boolean }> {
  try {
    const sb = await client();
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) return { error: authMessage(error), needConfirm: false };
    if (data.session) {
      await listenAuth();
      await afterLogin(data.session);
      return { error: null, needConfirm: false };
    }
    return { error: null, needConfirm: true };
  } catch (e) {
    return { error: authMessage(e), needConfirm: false };
  }
}

export async function signOut() {
  const sb = await client();
  await sb.auth.signOut();
  await afterLogin(null);
}

/** プランをもう一度確かめる（管理画面で有料にした直後など） */
export async function refreshPlan() {
  try {
    const plan = await loadPlan();
    useSync.setState({ plan, message: null });
    if (plan === 'paid') await syncNow();
  } catch (e) {
    useSync.setState({ status: 'error', message: `プランを確かめられませんでした（${errorText(e)}）` });
  }
}

// ---- 同期の本体 ----
let applying = false;
let running: Promise<void> | null = null;

function currentPayload(): SyncPayload {
  const s = useCosmos.getState();
  return {
    app: 'knowledge-cosmos',
    version: 2,
    savedAt: new Date().toISOString(),
    data: { version: 2, nodes: s.nodes, statements: s.statements, sources: s.sources, relations: s.relations },
    engagement: s.engagement,
    activity: s.activityDays,
  };
}

/**
 * 保存されているデータを、この端末に入れる（知識のデータは置き換え、記録は足し合わせる）。
 * withUndo：利用者が自分で選んだときだけ「元に戻す」を出す。
 * （自動でそろえたときに元に戻すと、次の同期で、ほかの端末の変更を古いデータで上書きしてしまうため）
 */
function applyRemote(p: SyncPayload, withUndo = false) {
  applying = true;
  try {
    const { replaceAll, mergeEngagementFrom, mergeActivityFrom } = useCosmos.getState();
    replaceAll(p.data, withUndo ? '保存されているデータにそろえました' : null);
    mergeEngagementFrom(p.engagement ?? {});
    mergeActivityFrom(Array.isArray(p.activity) ? p.activity : []);
  } finally {
    applying = false;
  }
}

/** この端末に、自分で作ったもの（初期セット以外の星・記述、自分で結んだつながり）があるか */
export function hasOwnContent(): boolean {
  const s = useCosmos.getState();
  // 初期セットのものは、ID が starter- で始まる
  return (
    s.relations.some((r) => !r.id.startsWith('starter-')) ||
    s.nodes.some((n) => n.status === 'known' && n.origin !== 'starter') ||
    s.statements.some((st) => !st.id.startsWith('starter-'))
  );
}

async function push(expected: number, local: Local): Promise<'ok' | 'conflict'> {
  const sb = await client();
  const payload = await encodePayload(currentPayload());
  const { data, error } = await sb.rpc('push_cosmos', { expected_version: expected, payload, device: deviceId() });
  if (error) {
    if (/conflict/.test(error.message)) return 'conflict';
    if (/not_paid/.test(error.message)) {
      useSync.setState({ plan: 'free' });
      throw new Error('有料プランではないため、同期できません');
    }
    throw error;
  }
  const now = new Date().toISOString();
  writeLocal({ ...local, version: Number(data), dirty: false, lastSyncedAt: now });
  useSync.setState({ lastSyncedAt: now });
  return 'ok';
}

async function fetchRemote(withData: boolean) {
  const sb = await client();
  const { data, error } = await sb
    .from('cosmos_sync')
    .select(withData ? 'version, updated_at, data' : 'version, updated_at')
    .eq('user_id', session!.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as { version: number; updated_at: string; data?: string } | null;
}

async function runSync() {
  if (!session || useSync.getState().plan !== 'paid' || useSync.getState().conflict) return;
  if (!useCosmos.getState().loaded) return;
  useSync.setState({ status: 'syncing', message: null });
  try {
    let local = readLocal(session.user.id);
    const remote = await fetchRemote(false);
    if (!remote) {
      // まだ何も預けていない：この端末のデータを預ける
      if ((await push(0, local)) === 'conflict') return void (await runSync());
    } else if (local.version === 0 && !hasOwnContent()) {
      // 初めての同期で、この端末にはまだ自分で作ったものがない：保存されているほうにそろえる（聞かなくてよい）
      const full = await fetchRemote(true);
      if (!full?.data) throw new Error('保存されているデータを読めませんでした');
      applyRemote(await decodePayload(full.data));
      local = { ...local, version: full.version, dirty: false, lastSyncedAt: new Date().toISOString() };
      writeLocal(local);
      useSync.setState({ lastSyncedAt: local.lastSyncedAt });
    } else if (local.version === 0 || (remote.version !== local.version && local.dirty)) {
      // 初めての同期で、すでに預けたデータがある／両方で変更があった：どちらを残すか聞く
      const full = await fetchRemote(true);
      if (!full?.data) throw new Error('保存されているデータを読めませんでした');
      useSync.setState({
        conflict: { remote: await decodePayload(full.data), remoteVersion: full.version, remoteUpdatedAt: full.updated_at, firstTime: local.version === 0 },
      });
    } else if (remote.version !== local.version) {
      // ほかの端末だけが変わった：この端末をそろえる
      const full = await fetchRemote(true);
      if (!full?.data) throw new Error('保存されているデータを読めませんでした');
      applyRemote(await decodePayload(full.data));
      local = { ...local, version: full.version, dirty: false, lastSyncedAt: new Date().toISOString() };
      writeLocal(local);
      useSync.setState({ lastSyncedAt: local.lastSyncedAt });
    } else if (local.dirty) {
      // この端末だけが変わった：預ける
      if ((await push(local.version, local)) === 'conflict') {
        // 確かめた直後にほかの端末が保存した：もう一度最初から
        return void (await runSync());
      }
    }
    useSync.setState({ status: 'idle' });
  } catch (e) {
    useSync.setState({ status: 'error', message: `同期できませんでした（${errorText(e)}）` });
  }
}

/** 今すぐ同期する（同時に2つ走らないようにする） */
export function syncNow(): Promise<void> {
  if (!running) running = runSync().finally(() => (running = null));
  return running;
}

/** 食い違いの解決：keep = 'local'（この端末を残す）／'remote'（保存されているほうにする） */
export async function resolveConflict(keep: 'local' | 'remote') {
  const c = useSync.getState().conflict;
  if (!c || !session) return;
  const local = readLocal(session.user.id);
  useSync.setState({ status: 'syncing', message: null });
  try {
    if (keep === 'remote') {
      applyRemote(c.remote, true);
      const now = new Date().toISOString();
      writeLocal({ ...local, version: c.remoteVersion, dirty: false, lastSyncedAt: now });
      useSync.setState({ conflict: null, lastSyncedAt: now, status: 'idle' });
    } else {
      const r = await push(c.remoteVersion, local);
      useSync.setState({ conflict: null, status: 'idle' });
      if (r === 'conflict') await syncNow(); // 聞いている間にまた別の端末が保存した：もう一度確かめる
    }
  } catch (e) {
    useSync.setState({ status: 'error', message: `同期できませんでした（${errorText(e)}）` });
  }
}

/** 食い違いの解決を後回しにする（次に開いたとき、また聞く） */
export function postponeConflict() {
  useSync.setState({ conflict: null, status: 'idle' });
}

// ---- この端末での変更を見張る ----
const AUTO_DELAY_MS = 20000;
let timer = 0;

/** 変更があったら「まだ送っていない」と記録し、少し待ってから自動で同期する */
useCosmos.subscribe((s, prev) => {
  if (applying || !s.loaded || !prev.loaded) return;
  const changed =
    s.nodes !== prev.nodes || s.statements !== prev.statements || s.sources !== prev.sources || s.relations !== prev.relations ||
    s.engagement !== prev.engagement || s.activityDays !== prev.activityDays;
  if (!changed || !session) return;
  const local = readLocal(session.user.id);
  if (!local.dirty) writeLocal({ ...local, dirty: true });
  if (useSync.getState().plan !== 'paid') return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), AUTO_DELAY_MS);
});

// アプリを閉じる・ほかのアプリに切り替えるときに、まだ送っていない変更を送る
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && session && useSync.getState().plan === 'paid' && readLocal(session.user.id).dirty) {
      window.clearTimeout(timer);
      void syncNow();
    }
    // 戻ってきたときに、ほかの端末の変更を取り込む
    if (document.visibilityState === 'visible' && session && useSync.getState().plan === 'paid') void syncNow();
  });
}
