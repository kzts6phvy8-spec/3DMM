-- Knowledge Cosmos：端末の同期（有料プランの機能）に使う表と決まり。
-- Supabase の「SQL Editor」に全部貼り付けて「Run」を押すと作られる。何度実行しても壊れないように書いてある。

-- ===== 1. プラン（無料／有料） =====
-- 本人は自分のプランを読めるだけ。書き換えられるのは管理画面（Table Editor）からだけ。
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
drop policy if exists "本人のプランを読める" on public.profiles;
create policy "本人のプランを読める" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- 新しく登録した人に、無料プランの行を自動で作る
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
-- すでに登録済みの人の分も作る
insert into public.profiles (user_id) select id from auth.users on conflict do nothing;

-- 有料プランかどうか（決まりの中で使う）
create or replace function public.is_paid() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where user_id = (select auth.uid()) and plan = 'paid');
$$;
revoke all on function public.is_paid() from public, anon;
grant execute on function public.is_paid() to authenticated;

-- ===== 2. 同期するデータ（1人1行） =====
-- data：宇宙のデータ全体を圧縮して文字にしたもの。version：保存するたびに1ずつ増える番号
create table if not exists public.cosmos_sync (
  user_id uuid primary key references auth.users (id) on delete cascade,
  version bigint not null,
  device_id text not null,
  data text not null,
  updated_at timestamptz not null default now()
);
alter table public.cosmos_sync enable row level security;
revoke all on public.cosmos_sync from anon, authenticated;
grant select, insert, update on public.cosmos_sync to authenticated;
drop policy if exists "有料の本人だけ読める" on public.cosmos_sync;
create policy "有料の本人だけ読める" on public.cosmos_sync
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_paid()));
drop policy if exists "有料の本人だけ作れる" on public.cosmos_sync;
create policy "有料の本人だけ作れる" on public.cosmos_sync
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_paid()));
drop policy if exists "有料の本人だけ書き換えられる" on public.cosmos_sync;
create policy "有料の本人だけ書き換えられる" on public.cosmos_sync
  for update to authenticated using (user_id = (select auth.uid()) and (select public.is_paid()))
  with check (user_id = (select auth.uid()));

-- 保存する（ほかの端末が先に保存していたら、上書きせずに conflict で止める）
-- expected_version：この端末が最後に知っている番号（初めてなら0）
create or replace function public.push_cosmos(expected_version bigint, payload text, device text) returns bigint
  language plpgsql security invoker set search_path = '' as $$
declare
  new_version bigint;
begin
  if not public.is_paid() then
    raise exception 'not_paid';
  end if;
  if expected_version = 0 then
    insert into public.cosmos_sync (user_id, version, device_id, data)
      values (auth.uid(), 1, device, payload)
      on conflict (user_id) do nothing
      returning version into new_version;
  else
    update public.cosmos_sync
      set version = version + 1, device_id = device, data = payload, updated_at = now()
      where user_id = auth.uid() and version = expected_version
      returning version into new_version;
  end if;
  if new_version is null then
    raise exception 'conflict';
  end if;
  return new_version;
end;
$$;
revoke all on function public.push_cosmos(bigint, text, text) from public, anon;
grant execute on function public.push_cosmos(bigint, text, text) to authenticated;
