-- Knowledge Cosmos：「🔭 AIで調べる」の回数（無料は月20回、有料は月300回。2026-11-25に利用者が決定）
-- Supabase の「SQL Editor」に全部貼り付けて「Run」を押すと作られる。何度実行しても壊れないように書いてある。
-- 前提：schema.sql（profiles と is_paid）を先に実行してあること。

-- ===== 1. 回数の表（1人・1か月ごとに1行） =====
-- month：日本時間の年月（例：2026-11）。count：その月にAIで調べて、結果が出た回数
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  count integer not null default 0,
  primary key (user_id, month)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
drop policy if exists "本人の回数を読める" on public.ai_usage;
create policy "本人の回数を読める" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));
-- 本人も書き換えられない。数を増やすのは下の ai_consume だけ

-- ===== 2. 今月の回数と上限を返す =====
create or replace function public.ai_quota() returns json
  language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m text := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM');
  paid boolean;
  used integer;
begin
  if uid is null then
    return json_build_object('ok', false);
  end if;
  paid := public.is_paid();
  select u.count into used from public.ai_usage u where u.user_id = uid and u.month = m;
  return json_build_object('ok', true, 'used', coalesce(used, 0), 'limit', case when paid then 300 else 20 end, 'paid', paid);
end;
$$;

-- ===== 3. 1回分を数える（結果が出たときだけ、関数 ai-search が呼ぶ） =====
create or replace function public.ai_consume() returns json
  language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m text := to_char(now() at time zone 'Asia/Tokyo', 'YYYY-MM');
  used integer;
begin
  if uid is null then
    return json_build_object('ok', false);
  end if;
  insert into public.ai_usage (user_id, month, count) values (uid, m, 1)
    on conflict (user_id, month) do update set count = public.ai_usage.count + 1
    returning count into used;
  return json_build_object('ok', true, 'used', used, 'limit', case when public.is_paid() then 300 else 20 end);
end;
$$;

revoke all on function public.ai_quota() from public, anon;
revoke all on function public.ai_consume() from public, anon;
grant execute on function public.ai_quota() to authenticated;
grant execute on function public.ai_consume() to authenticated;

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
