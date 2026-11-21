-- Knowledge Cosmos：有料プランの支払い（Stripe）に使う列。
-- Supabase の「SQL Editor」に全部貼り付けて「Run」を押す。何度実行しても壊れないように書いてある。
-- （supabase/schema.sql のあとに実行する。schema.sql の末尾にも同じものを入れてある）

-- plan_source：有料になった理由。manual＝管理画面で手動（開発用など）／stripe＝Stripeで支払い
--   manual で有料の人は、Stripe からの知らせで無料に戻されない
-- stripe_customer_id：Stripe のお客さま番号（お支払いの管理画面を開くのに使う）
-- subscription_status：Stripe の契約の状態（active・past_due・canceled など）
-- current_period_end：今の支払い期間の終わり
alter table public.profiles add column if not exists plan_source text not null default 'manual';
alter table public.profiles drop constraint if exists profiles_plan_source_check;
alter table public.profiles add constraint profiles_plan_source_check check (plan_source in ('manual', 'stripe'));
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists subscription_status text;
alter table public.profiles add column if not exists current_period_end timestamptz;
create unique index if not exists profiles_stripe_customer_id_key on public.profiles (stripe_customer_id);
-- 本人は読めるだけ（今までどおり）。書き換えるのは管理画面と、支払いの関数（billing）だけ
-- 支払いの関数（billing）が使う「管理用の役割」（service_role）に、profiles を読み書きする許可を付ける
-- （新しい Supabase では、表を作っても service_role に自動で許可が付かないことがあるため）
grant select, update on public.profiles to service_role;
