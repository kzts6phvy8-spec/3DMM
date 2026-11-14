// 同期に使う Supabase のプロジェクト。
// ここに入れる鍵は「公開してよい鍵」（publishable / anon）。画面側に置く前提の鍵で、
// データは Supabase の決まり（RLS：本人で、有料プランの人だけ読み書きできる）で守る。秘密の鍵（secret / service_role）は絶対に入れない。
// 表と決まりは supabase/schema.sql で作る。
export const SUPABASE_URL: string = 'https://qhaxsvljyohdohromjch.supabase.co';
export const SUPABASE_KEY: string = '';

export const syncConfigured = () => SUPABASE_URL !== '' && SUPABASE_KEY !== '';
