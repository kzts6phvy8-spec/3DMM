# 「🔭 AIで調べる」を使えるようにする準備

AIの秘密の鍵（APIキー）は、アプリの中には入れません。Supabase の中の「秘密の置き場所」に預けて、Supabase の上で動く小さな処理（Edge Function）から AI を呼びます。

使うAIは、預けた鍵で決まります。
- `GEMINI_API_KEY` があれば、Google の Gemini を使う（無料枠で試せる。2026-11-20、利用者が選択）
- なければ `ANTHROPIC_API_KEY` で Claude を使う（有料）

あとでAIを変えるときは、鍵を預け直すだけで済みます。アプリを作り直す必要はありません。

準備は3つです。どれも、iPhone の Safari でできます。画面の表示名は、変わることがあります。

## 1. AIの鍵を作る（Gemini・有料枠が必要）

1. https://aistudio.google.com を開いて、Google アカウントでログインする
2. 「Get API key」（APIキーを取得）→「Create API key」（APIキーを作成）を押す
3. 表示された鍵をコピーする
   - **この鍵はチャットに貼らないでください。** 次の手順で Supabase にだけ貼ります。
   - **無料枠では動きません。** Google検索で確かめる機能（Grounding with Google Search）は、Googleの料金表で無料枠が「Not available」（使えない）になっている（2026-11-20に確認。https://ai.google.dev/gemini-api/docs/pricing ）。無料枠の鍵だと、どのモデルも 429 になる。
   - AI Studio の鍵の画面で「お支払い情報を設定」（Set up billing）を押し、有料枠（Tier 1）にする。鍵はそのまま使える。
   - 有料枠では、Google検索は Gemini 3 以降のモデル全体で月5,000回まで無料、その後は有料（同じ料金表）。文章を作る分（トークン）は別に料金がかかる。
   - 使うモデルは `gemini-3.8-flash` だけ（2026-11-20に決定。`gemini-2.5-flash` などは「新しい利用者には使えない」と返される）。

### （あとで）Claude に切り替えるとき

1. https://console.anthropic.com で、利用料を前払いし、「API Keys」→「Create Key」で鍵を作る
2. 手順2で、名前 `ANTHROPIC_API_KEY` として預け、`GEMINI_API_KEY` を消す

## 2. 鍵を Supabase に預ける

1. https://supabase.com/dashboard を開いて、Knowledge Cosmos のプロジェクトを選ぶ
2. 左のメニューの「Edge Functions」→「Secrets」を開く
3. 「Add new secret」（新しい秘密を追加）で、次を入れて保存する
   - Name（名前）：`GEMINI_API_KEY`
   - Value（値）：1でコピーした鍵
   - Geminiのモデルを変えたいときだけ、`GEMINI_MODEL` も追加する（なければ `gemini-3.8-flash` を使う）

## 3. 処理（Edge Function）を置く

1. GitHub アプリで `supabase/functions/ai-search/index.ts` を開き、中身を全部コピーする
   - Safari なら、ファイルの画面の「Raw」を押すと、文字だけの画面になってコピーしやすい
2. Supabase の「Edge Functions」→「Deploy a new function」→「Via Editor」を押す
3. 名前を付ける。アプリは `src/sync/config.ts` の `AI_SEARCH_FUNCTION` の名前で呼ぶ（今は `ai-search-`。2026-11-20に置いたときの名前に合わせた）
4. 最初から入っている文字を全部消して、1でコピーしたものを貼り付ける
5. 「Deploy function」を押す
6. 置いたあと「Settings」で「Verify JWT with legacy secret」をオフにして「Save changes」を押す（ログインの確認は処理の中で行うため）

## 3.5 回数の表を作る（無料は月20回・有料は月300回）

1. Supabase の「SQL Editor」→「＋」（New query）
2. `supabase/ai_quota.sql` の中身を全部貼り付けて「Run」を押す
   - コピーしやすいURL：https://raw.githubusercontent.com/kzts6phvy8-spec/3DMM/main/supabase/ai_quota.sql

## 4. 確かめる

1. アプリで、有料プランのアカウントでログインしておく（「その他」→「端末の同期」）
2. 「探す」で、宇宙にない言葉を入れる
3. 「🔭 AIで調べる」を押す。30秒ほどで、星と枝が出れば完成

うまくいかないときは、画面に出た文をそのまま Claude Code に伝えてください。

| 画面に出る文 | 原因 |
|---|---|
| ログインが必要です | アプリでログインしていない |
| 有料プランの機能です | `profiles` の `plan` が `paid` になっていない |
| 無料で使える回数を超えたか、混み合っています | Gemini の無料枠を使い切った、または一度にたくさん使った。時間をおく |
| AIの呼び出しに失敗しました（数字） | モデルの名前が違う、など。Supabase の Edge Functions の「Logs」に詳しい理由が出る |
| AIの鍵がまだ登録されていません／正しくありません | 手順2がまだ、または鍵の貼り間違い |
| AIにつながりませんでした | 手順3がまだ、名前が `AI_SEARCH_FUNCTION` と違う、または手順3-6のスイッチがオンのまま |

## 料金の目安

- Gemini（支払い情報なし）：無料枠の中だけで動き、料金はかからない。無料で何回使えるかは、Google の料金ページと AI Studio で確かめる（ページの書き方が変わることがある）。
- Claude（意見）：1回調べるごとにAIが最大5回Web検索するので、1回あたり数十円ほどの見込み。実際の金額は Anthropic の管理画面の「Usage」で確かめる。

## Google の決まりについて（確認が必要）

Gemini で Google 検索を使って答えたときは、Google から届く「検索の候補」を画面に出すことが求められている、と理解している（公式の説明を、この作業環境からは読めなかったため未確認）。アプリでは、調べた星の画面の「つながっている星」の下に出している。一般公開の前に、Google の利用規約で確かめる。
