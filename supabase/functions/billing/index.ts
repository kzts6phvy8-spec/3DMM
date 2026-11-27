// 有料プランの支払い（Stripe）。1つの関数で3つの役目をする（貼り直しを1回で済ませるため）。
//   action: 'checkout' … 支払い画面（Stripe Checkout）を作って、そのURLを返す（ログインしている本人だけ）
//   action: 'portal'   … お支払いの管理画面（解約・カードの変更）を作って、そのURLを返す（Stripeで支払った本人だけ）
//   Stripe からの知らせ（Webhook。stripe-signature の見出し付き）… 支払い・解約に合わせて profiles.plan を書き換える
// 秘密の鍵は Supabase の Secrets にだけ置く：
//   STRIPE_SECRET_KEY（sk_test_… / sk_live_…）、STRIPE_WEBHOOK_SECRET（whsec_…）、
//   STRIPE_PRICE_MONTHLY・STRIPE_PRICE_YEARLY（任意。price_…。なければ、Stripe にある有効な月額・年額の価格を自動で探す）
// 管理画面で手動で有料にした人（plan_source = 'manual'）は、Stripe からの知らせで無料に戻さない（開発用のアカウントなど）。
// Stripe の部品（ライブラリ）は使わず、決まった形の問い合わせ（REST API）を直接送る（起動を軽くするため）。
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://qhaxsvljyohdohromjch.supabase.co';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? 'sb_publishable_hG5FBFMHuLcKpVhgLAd4-A_fMmLyTXB';

// 支払いのあとに戻ってよい場所（ほかのサイトへ飛ばされないように、決まった場所だけにする）
const ALLOWED_RETURN = [/^https:\/\/kzts6phvy8-spec\.github\.io\/3DMM\//, /^http:\/\/localhost(:\d+)?\//];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POSTで呼んでください' }, 405);
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: '支払いの準備がまだできていません（Stripeの鍵が未登録）', code: 'nokey' }, 503);

  const signature = req.headers.get('stripe-signature');
  if (signature) return handleWebhook(req, signature);

  // ---- 本人確認 ----
  const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: userData, error: userError } = await sb.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: 'ログインしてください', code: 'login' }, 401);
  const admin = adminClient();
  if (!admin) return json({ error: '支払いの準備がまだできていません（管理用の鍵がない）', code: 'nokey' }, 503);
  const { data: profile } = await admin.from('profiles').select('plan, plan_source, stripe_customer_id').eq('user_id', user.id).maybeSingle();

  let body: { action?: string; interval?: string; returnUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* 下で弾く */
  }
  const returnUrl = String(body.returnUrl ?? '');
  if (!ALLOWED_RETURN.some((re) => re.test(returnUrl))) return json({ error: '戻り先が正しくありません', code: 'bad' }, 400);
  const back = (state: string) => `${returnUrl.split('#')[0].split('?')[0]}?billing=${state}`;

  if (body.action === 'checkout') {
    if (profile?.plan === 'paid') return json({ error: 'すでに有料プランです', code: 'already' }, 409);
    const interval = body.interval === 'year' ? 'year' : 'month';
    const price = (interval === 'year' ? Deno.env.get('STRIPE_PRICE_YEARLY') : Deno.env.get('STRIPE_PRICE_MONTHLY')) || (await findPrice(stripeKey, interval));
    if (!price) return json({ error: 'Stripe に有効な価格（月額／年額）が見つかりません', code: 'nokey' }, 503);
    const params: Record<string, string> = {
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      client_reference_id: user.id,
      'metadata[user_id]': user.id,
      'subscription_data[metadata][user_id]': user.id,
      success_url: back('success'),
      cancel_url: back('cancel'),
      locale: 'ja',
      // Managed Payments（Stripe が販売者の代わりになるサービス）は使わない。普通のカード決済にする
      // （2026-11-20、利用者が Stripe を選んだときの決定。使うなら商品に税コードを設定してこの行を消す）
      'managed_payments[enabled]': 'false',
    };
    if (profile?.stripe_customer_id) params.customer = profile.stripe_customer_id;
    else if (user.email) params.customer_email = user.email;
    const r = await stripe(stripeKey, 'checkout/sessions', params);
    if (!r.ok) return json({ error: '支払い画面を作れませんでした', code: 'api' }, 502);
    return json({ url: r.data.url });
  }

  if (body.action === 'portal') {
    if (!profile?.stripe_customer_id) return json({ error: 'Stripeでのお支払いの記録がありません', code: 'nocustomer' }, 404);
    const r = await stripe(stripeKey, 'billing_portal/sessions', { customer: profile.stripe_customer_id, return_url: back('portal'), locale: 'ja' });
    if (!r.ok) return json({ error: 'お支払いの管理画面を開けませんでした', code: 'api' }, 502);
    return json({ url: r.data.url });
  }

  return json({ error: 'action が正しくありません', code: 'bad' }, 400);
});

function adminClient() {
  // Supabase が関数に自動で渡す「管理用の鍵」。profiles を書き換えるのに使う（アプリには絶対に入れない）
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return key ? createClient(SUPABASE_URL, key, { auth: { persistSession: false } }) : null;
}

/** Stripe にある有効な継続の価格から、月額（month）／年額（year）のものを探す。いくつもあれば、いちばん新しいもの */
async function findPrice(key: string, interval: 'month' | 'year'): Promise<string | null> {
  const res = await fetch('https://api.stripe.com/v1/prices?active=true&type=recurring&limit=100', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    console.error('stripe prices', res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const list: { id: string; created: number; recurring?: { interval?: string; interval_count?: number } }[] = (await res.json()).data ?? [];
  const found = list
    .filter((p) => p.recurring?.interval === interval && (p.recurring.interval_count ?? 1) === 1)
    .sort((a, b) => b.created - a.created)[0];
  return found?.id ?? null;
}

// deno-lint-ignore no-explicit-any
async function stripe(key: string, path: string, params: Record<string, string>): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('stripe', path, res.status, JSON.stringify(data).slice(0, 500));
    return { ok: false, error: String(data?.error?.message ?? res.status).slice(0, 200) };
  }
  return { ok: true, data };
}

// ---- Stripe からの知らせ ----
async function handleWebhook(req: Request, signature: string): Promise<Response> {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const raw = await req.text();
  if (!secret || !(await verifySignature(raw, signature, secret))) {
    console.error('webhook: 署名を確かめられませんでした');
    return json({ error: 'bad signature' }, 400);
  }
  const admin = adminClient();
  if (!admin) return json({ error: 'no admin key' }, 500);
  const event = JSON.parse(raw);
  const obj = event.data?.object ?? {};
  console.log('webhook', event.type, obj.id);

  if (event.type === 'checkout.session.completed' && obj.mode === 'subscription') {
    const userId = obj.client_reference_id ?? obj.metadata?.user_id;
    if (!userId) return json({ received: true });
    // 管理画面で手動で有料にしている人は、そのまま（plan_source を manual のまま）
    const { error } = await admin
      .from('profiles')
      .update({ plan: 'paid', plan_source: 'stripe', stripe_customer_id: obj.customer, subscription_status: 'active' })
      .eq('user_id', userId)
      .or('plan.eq.free,plan_source.eq.stripe');
    if (error) console.error('webhook update', error.message);
    // 手動で有料の人でも、お支払いの管理画面を開けるように、お客さま番号だけは記録する
    await admin.from('profiles').update({ stripe_customer_id: obj.customer }).eq('user_id', userId).is('stripe_customer_id', null);
    return json({ received: true });
  }

  if (event.type?.startsWith('customer.subscription.')) {
    const status: string = event.type === 'customer.subscription.deleted' ? 'canceled' : obj.status;
    // active・trialing は有料。past_due（支払いの再試行中）も、猶予として有料のまま。
    // canceled・unpaid・incomplete_expired・paused は無料に戻す。incomplete（支払いの途中）などはプランを変えない
    // （知らせは順番どおりに届くとは限らないため、支払いの途中の知らせで有料を取り消さないように）
    const plan = ['active', 'trialing', 'past_due'].includes(status)
      ? 'paid'
      : ['canceled', 'unpaid', 'incomplete_expired', 'paused'].includes(status)
        ? 'free'
        : null;
    const end = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end;
    // 期間の終わりに解約する予約（cancel_at_period_end・cancel_at）があれば、状態を canceling として記録する
    // （それまでは有料のまま。画面で「解約済み（○日まで有料）」と出すため）
    const canceling = plan === 'paid' && status !== 'past_due' && (obj.cancel_at_period_end || obj.cancel_at);
    const fields = {
      subscription_status: canceling ? 'canceling' : status,
      current_period_end: end ? new Date(end * 1000).toISOString() : null,
    };
    // まず、Stripe で有料になっている人だけ、プランを書き換える
    const q = admin.from('profiles').update(plan ? { ...fields, plan } : fields).eq('plan_source', 'stripe');
    const { error } = obj.metadata?.user_id ? await q.eq('user_id', obj.metadata.user_id) : await q.eq('stripe_customer_id', obj.customer);
    if (error) console.error('webhook update', error.message);
    // 手動で有料の人は、契約の状態だけ記録する（プランは変えない）
    await admin.from('profiles').update(fields).eq('plan_source', 'manual').eq('stripe_customer_id', obj.customer);
    return json({ received: true });
  }

  return json({ received: true });
}

/** Stripe の署名（stripe-signature: t=時刻,v1=署名）を確かめる。5分より古い知らせは受け付けない */
async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=', 2) as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(s, expected));
}

function timingSafeEqual(a: string, b: string) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
