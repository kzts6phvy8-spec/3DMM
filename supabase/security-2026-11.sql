-- Knowledge Cosmos：セキュリティの点検（2026-11-27）で直すためのSQL。
-- Supabase の「SQL Editor」に全部貼り付けて「Run」を押す（1回だけ。何度実行しても壊れない）。
-- 中身は supabase/ai_quota.sql と supabase/schema.sql の末尾に足したものと同じ（新しく作り直すときは、そちらを実行すればよい）。

-- ===== 4. 先に1回分を数える（2026-11-27 セキュリティの点検で追加） =====
-- 以前は「結果が出たあとに数える」だったので、同じ人が同時にたくさん送ると上限を超えてAIが動けた。
-- 今は、AIを呼ぶ前に1回分を数え（上限に達していたら数えずに断る）、AIが失敗したら取り消す。
-- ai_reserve：本人が呼ぶ（関数 ai-search から、本人のログインで）。上限を超えるときは ok=false
create or replace function public.ai_reserve() returns json
  language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m text := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM');
  lim integer;
  used integer;
begin
  if uid is null then
    return json_build_object('ok', false, 'reason', 'login');
  end if;
  lim := case when public.is_paid() then 300 else 20 end;
  insert into public.ai_usage (user_id, month, count) values (uid, m, 0) on conflict (user_id, month) do nothing;
  -- 1つの文で「上限より少ないときだけ1増やす」ので、同時に送っても上限を超えない
  update public.ai_usage set count = count + 1
    where user_id = uid and month = m and count < lim
    returning count into used;
  if used is null then
    select u.count into used from public.ai_usage u where u.user_id = uid and u.month = m;
    return json_build_object('ok', false, 'reason', 'quota', 'used', used, 'limit', lim, 'paid', lim = 300);
  end if;
  return json_build_object('ok', true, 'used', used, 'limit', lim, 'paid', lim = 300, 'month', m);
end;
$$;
revoke all on function public.ai_reserve() from public, anon;
grant execute on function public.ai_reserve() to authenticated;

-- ai_release：AIが失敗したときに1回分を取り消す。アプリの利用者は呼べない（関数 ai-search が管理用の役割で呼ぶ）
create or replace function public.ai_release(uid uuid, m text) returns void
  language sql volatile security definer set search_path = '' as $$
  update public.ai_usage set count = greatest(count - 1, 0) where user_id = uid and month = m;
$$;
revoke all on function public.ai_release(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_release(uuid, text) to service_role;

-- ===== 同期データの大きさの上限（2026-11-27 セキュリティの点検で追加） =====
-- 今のデータは圧縮して約5MB。余裕をもって50MB（文字数）までにする（それより大きいと保存を断る）
alter table public.cosmos_sync drop constraint if exists cosmos_sync_data_size;
alter table public.cosmos_sync add constraint cosmos_sync_data_size check (length(data) <= 50000000);
