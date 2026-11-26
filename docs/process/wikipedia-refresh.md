# 初期セットの文をWikipediaの今の記事に合わせる（作り直しの手順）

2026-11-26、利用者が「年に1〜2回、作り直す」を選んだ。仕組みだけを作り、実際の作り直しはまだしていない。

## なぜ必要か

初期セット（第3・4・7弾）の星の文は、作った日のWikipediaの記事の冒頭を写したもの。アプリはWikipediaと同期していないので、記事が書き換わっても星の文は変わらない。

## 対象

- 対象：第3弾（`src/data/vital.json`）、第4弾（`vital10k.json`）、第7弾（`trivia.json`）の星の記述と概要
- 対象外：手作りの第1・2弾、第3弾が第1・2弾の星に足した記述（`vital.json` の `extra`）

## 手順（半年に1回くらい）

作業用のフォルダ（例：`/tmp/refresh`）を決めて、順に動かす。

1. 既存の星の名前の一覧を作る（リンクを付けるため）
   `node --experimental-strip-types scripts/dump_starter_names.ts > /tmp/refresh/starter-specs.json`
2. 記事を取り直して、変わる星を確かめる（ファイルは変えない）
   `python3 scripts/refresh_starter.py /tmp/refresh`
   - 1〜2時間かかる。Wikipediaの回数制限のため、待ちながら取る。途中で止まっても、もう一度動かすと続きから取る
   - 変わる星の数と、前後の文の例が出る。人が確かめる星の一覧は `/tmp/refresh/held.json`
3. 表示を確かめてから、書き込む
   `python3 scripts/refresh_starter.py /tmp/refresh --write`
   - `src/data/refresh/<年-月>.json`（差し替え一覧）ができ、元データの3つも新しい文になる
4. `npm run build` と動作確認をして、本番に出す。必要なら `held.json` の星を手で直す

## 決まり（データを壊さないため）

- 今の文と、リンクの印を外して比べる。違う星だけを差し替える。リンクの付き方の違いだけでは差し替えない
- 次の星は差し替えずに `held.json` に出す
  - 壊れた文を手で直した星（`src/data/corrections.json` にある星）：直した文が、崩れた文に戻らないように
  - 記事がなくなった・曖昧さ回避になった・別の記事に転送されるようになった・文が取れなくなった星
- 各端末では（`src/data/applyRefresh.ts`）
  - 版ごとに1回だけ反映する（印 `refresh-<年-月>`）
  - 初期セットから入った記述が、差し替え前と数も中身もすべて同じ星だけを差し替える。1つでも編集・削除した星はそのまま
  - 自分で足した記述・自分で作った星には触れない
  - 新しく使い始めた端末は、初めから新しい文で作られるので、反映済みとして扱う

## 確かめ方

- 差し替えの決まりのテスト：
  `npx rolldown scripts/test_apply_refresh.ts --platform node --format esm --file /tmp/t.mjs && node /tmp/t.mjs`
