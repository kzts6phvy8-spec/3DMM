// 同期に使う Supabase のプロジェクト。
// ここに入れる鍵は「公開してよい鍵」（publishable / anon）。画面側に置く前提の鍵で、
// データは Supabase の決まり（RLS：本人で、有料プランの人だけ読み書きできる）で守る。秘密の鍵（secret / service_role）は絶対に入れない。
// 表と決まりは supabase/schema.sql で作る。
export const SUPABASE_URL: string = 'https://qhaxsvljyohdohromjch.supabase.co';
export const SUPABASE_KEY: string = 'sb_publishable_hG5FBFMHuLcKpVhgLAd4-A_fMmLyTXB';

export const syncConfigured = () => SUPABASE_URL !== '' && SUPABASE_KEY !== '';

// 「🔭 AIで調べる」で呼ぶ Edge Function の名前（Supabase の画面で付けた名前。URLの /functions/v1/ の後ろ）
export const AI_SEARCH_FUNCTION = 'ai-search-';

// 有料プランの支払い（Stripe）の Edge Function の名前（supabase/functions/billing）
export const BILLING_FUNCTION = 'billing';
