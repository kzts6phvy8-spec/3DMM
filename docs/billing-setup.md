# 有料プランの支払い（Stripe）の準備

有料プラン（今は「端末の同期」）の支払いを、Stripe（カード決済のサービス）で受け付けるための準備の手順。
仕様は docs/ux/02-scope.md F18。

- 料金の形：月額と年額（2026-11-20、利用者が決定）。金額は Stripe の画面で決める（あとで変えられる）
- しくみ：
  1. アプリの「その他」→「端末の同期」→「有料プランにする（月額／年額）」を押す
  2. Supabase の関数 `billing` が Stripe の支払い画面を作り、そこへ移る
  3. 支払いが済むと、Stripe から関数 `billing` に知らせ（Webhook）が届き、`profiles.plan` を `paid` にする。解約・支払い失敗のときは `free` に戻す
  4. 有料の人は「お支払いの管理」から、Stripe の画面で解約・カードの変更ができる
- 管理画面で手動で `paid` にした人（`plan_source = manual`。開発用のアカウントなど）は、Stripe からの知らせで `free` に戻されない
- **テストモード**の間は、テスト用のカード番号で、本物のお金を払わずに試せる

準備は6つ。画面の表示名は変わることがある。

## 1. Stripe のアカウントを作る（テストモード）

1. https://dashboard.stripe.com/register で登録する
2. 画面の右上（またはメニュー）で「テストモード」（Test mode／サンドボックス）になっていることを確かめる
   - 本番で売るときは、本人確認・口座の登録をして「本番モード」に切り替える。鍵や価格は、本番用に作り直す

## 2. 商品と価格を作る

1. Stripe の「商品カタログ」（Product catalog）→「商品を追加」
2. 名前：`Knowledge Cosmos 有料プラン`
3. 価格を2つ作る
   - 継続（Recurring）・月ごと（Monthly）・金額（例：300円）
   - 継続（Recurring）・年ごと（Yearly）・金額（例：3,000円）
4. それぞれの価格の ID（`price_` で始まる文字）を控える

## 3. お支払いの管理画面（カスタマーポータル）を有効にする

1. Stripe の「設定」→「Billing」→「カスタマーポータル」（Customer portal）
2. 「解約」と「お支払い方法の更新」を許可して保存する

## 4. 表に列を足す（Supabase）

1. Supabase のダッシュボード →「SQL Editor」
2. `supabase/billing.sql` の中身を全部貼り付けて「Run」

## 5. 関数 `billing` を置く（Supabase）

1. Supabase の「Edge Functions」→「Deploy a new function」→「Via Editor」
2. 名前：`billing`（アプリは `src/sync/config.ts` の `BILLING_FUNCTION` の名前で呼ぶ）
3. `supabase/functions/billing/index.ts` の中身を全部貼り付けて「Deploy function」
   - コピーしやすいURL：https://raw.githubusercontent.com/kzts6phvy8-spec/3DMM/main/supabase/functions/billing/index.ts
4. 置いたあと「Settings」で「Verify JWT with legacy secret」を**オフ**にして保存する
   - Stripe からの知らせにはログインの印が付いていないため。ログインの確認と、知らせの署名の確認は、関数の中で行う

## 6. Stripe からの知らせ（Webhook）を登録し、鍵を Supabase に預ける

1. Stripe の「開発者」（Developers）→「Webhook」→「送信先を追加」（Add endpoint）
   - URL：`https://qhaxsvljyohdohromjch.supabase.co/functions/v1/billing`
   - 受け取るイベント：`checkout.session.completed`・`customer.subscription.created`・`customer.subscription.updated`・`customer.subscription.deleted`
2. 作った送信先の「署名シークレット」（Signing secret。`whsec_` で始まる）を控える
3. Stripe の「開発者」→「API キー」で、「シークレットキー」（`sk_test_` で始まる）を控える
4. Supabase の「Edge Functions」→「Secrets」で、次の4つを追加する（**チャットには貼らない**）
   | 名前 | 値 |
   |---|---|
   | `STRIPE_SECRET_KEY` | `sk_test_…` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
   | `STRIPE_PRICE_MONTHLY` | 月額の `price_…` |
   | `STRIPE_PRICE_YEARLY` | 年額の `price_…` |

## 試し方（テストモード）

1. **無料の**テスト用アカウントでアプリにログインする（開発用の有料アカウントにはボタンが出ない）
2. 「有料プランにする（月額）」→ Stripe の画面でカード番号 `4242 4242 4242 4242`、有効期限は未来の日付、セキュリティコードは好きな3桁
3. アプリに戻ると「お支払いを確かめています…」→「有料プランになりました」と出る
4. 「お支払いの管理」→ 解約すると、契約の期間が終わったときに無料に戻る（テストモードでは Stripe の画面で即時に解約もできる）

## 本番で売る前に必要なこと

- Stripe の本人確認と口座の登録、本番モードの鍵・価格・Webhook に差し替える
- 「特定商取引法に基づく表記」のページ（販売者の名前・連絡先・価格・返金の決まりなど）。日本でネット販売をするときに必要
- 利用規約・プライバシーポリシー
