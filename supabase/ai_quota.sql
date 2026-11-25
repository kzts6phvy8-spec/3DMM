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
