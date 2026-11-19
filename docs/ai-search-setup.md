# 「🔭 AIで調べる」を使えるようにする準備

AIの秘密の鍵（APIキー）は、アプリの中には入れません。Supabase の中の「秘密の置き場所」に預けて、Supabase の上で動く小さな処理（Edge Function）から AI を呼びます。

準備は3つです。どれも、iPhone の Safari でできます。画面の表示名は、変わることがあります。

## 1. AIの鍵を作る（Anthropic）

1. https://console.anthropic.com を開いて、アカウントを作る（ログインする）
2. 「Billing」（支払い）で、クレジット（前払いの利用料）を購入する
   - AIは使うたびに料金がかかります。ここで買った分から引かれます。
3. 「API Keys」→「Create Key」を押す。名前は `knowledge-cosmos` など
4. 表示された鍵（`sk-ant-` で始まる長い文字）をコピーする
   - **この鍵はチャットに貼らないでください。** 次の手順で Supabase にだけ貼ります。
   - 鍵は一度しか表示されません。なくしたら作り直せます。

## 2. 鍵を Supabase に預ける

1. https://supabase.com/dashboard を開いて、Knowledge Cosmos のプロジェクトを選ぶ
2. 左のメニューの「Edge Functions」→「Secrets」を開く
3. 「Add new secret」（新しい秘密を追加）で、次を入れて保存する
   - Name（名前）：`ANTHROPIC_API_KEY`
   - Value（値）：1でコピーした鍵

## 3. 処理（Edge Function）を置く

1. GitHub アプリで `supabase/functions/ai-search/index.ts` を開き、中身を全部コピーする
   - Safari なら、ファイルの画面の「Raw」を押すと、文字だけの画面になってコピーしやすい
2. Supabase の「Edge Functions」→「Deploy a new function」→「Via Editor」を押す
3. 名前を `ai-search` にする（この名前でアプリが呼ぶので、1文字も変えない）
4. 最初から入っている文字を全部消して、1でコピーしたものを貼り付ける
5. 「Deploy function」を押す

## 4. 確かめる

1. アプリで、有料プランのアカウントでログインしておく（「その他」→「端末の同期」）
2. 「探す」で、宇宙にない言葉を入れる
3. 「🔭 AIで調べる」を押す。30秒ほどで、星と枝が出れば完成

うまくいかないときは、画面に出た文をそのまま Claude Code に伝えてください。

| 画面に出る文 | 原因 |
|---|---|
| ログインが必要です | アプリでログインしていない |
| 有料プランの機能です | `profiles` の `plan` が `paid` になっていない |
| AIの鍵がまだ登録されていません／正しくありません | 手順2がまだ、または鍵の貼り間違い |
| AIにつながりませんでした | 手順3がまだ、または名前が `ai-search` になっていない |

## 料金の目安（意見）

1回調べるごとに、AIが最大5回Web検索して文章をまとめます。1回あたり数十円ほどになる見込みです。実際の金額は、Anthropic の管理画面の「Usage」（使用量）で確かめてください。
