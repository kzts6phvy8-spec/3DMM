"""初期セット（第3・4・7弾）の文を、Wikipediaの今の記事に合わせて作り直す。2026-11-26、利用者が「年に1〜2回、作り直す」を選んだ。

使い方（半年に1回くらい。作業用のフォルダで）：
  1. node --experimental-strip-types scripts/dump_starter_names.ts > <作業用フォルダ>/starter-specs.json
  2. python3 scripts/refresh_starter.py <作業用フォルダ>
     → 記事の冒頭を取り直し（1〜2時間。途中から再開できる）、変わる星の数と例を表示するだけ（ファイルは変えない）
  3. 表示を確かめてから python3 scripts/refresh_starter.py <作業用フォルダ> --write
     → src/data/refresh/<年-月>.json（差し替え一覧）を作り、vital.json・vital10k.json・trivia.json も新しい文にする
  4. npm run build と動作確認をして、本番に出す。アプリは起動時に、差し替え一覧を各端末に1回だけ反映する（src/data/applyRefresh.ts）

決まり：
  - 文の作り方は作ったときと同じ（記事の冒頭から最大3文。リンクは第4弾と同じ Linker と、ひらがなの決まり）
  - 今の文とリンクの印を外して比べ、違う星だけを差し替える（リンクの付き方の違いだけでは差し替えない）
  - 次の星は差し替えない（表示だけする）
      - 壊れた文を手で直した星（src/data/corrections.json にある星）：直した文が崩れた文に戻らないように
      - 記事がなくなった・曖昧さ回避になった・別の記事に転送されるようになった・文が取れない星：人が確かめるため
  - 各端末では、利用者が編集・削除した記述がある星には触れない（applyRefresh.ts）
  - 手作りの第1・2弾と、第3弾が第1・2弾の星に足した記述（vital.json の extra）は対象外
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_trivia import unlink_broken  # noqa: E402
from build_vital import sentences, split_qualifier  # noqa: E402
from build_vital10k import Linker  # noqa: E402
from fetch_trivia_cats import existing_names  # noqa: E402
from wp_fetch import fetch_extracts  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETS = ["src/data/vital.json", "src/data/vital10k.json", "src/data/trivia.json"]
LINK = re.compile(r"\[\[([^\]（]+)(?:（[^\]]*）)?\]\]")


def plain(text):
    """リンクの印を外した文。リンクの名前に付いた区別の補足（例：[[関数（数学）]] の（数学））は、記事の文にはないので外す"""
    return LINK.sub(r"\1", text)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    write = "--write" in sys.argv
    work = args[0]
    version = args[1] if len(args) > 1 else time.strftime("%Y-%m")

    data = {p: json.load(open(f"{ROOT}/{p}", encoding="utf-8")) for p in SETS}
    corrections = json.load(open(f"{ROOT}/src/data/corrections.json", encoding="utf-8"))
    corrected = {c["star"] for c in corrections["statements"]} | {c["star"] for c in corrections["summaries"]}

    stars = [s for p in SETS for s in data[p]["stars"] if s.get("wp")]
    articles = fetch_extracts([s["wp"] for s in stars], f"{work}/articles.json")

    # リンクを付けられる名前（第1〜4弾の名前と、第7弾の名前・別名）
    terms = existing_names(work)
    for s in data["src/data/trivia.json"]["stars"]:
        terms.add(s["title"])
        terms.update(s["aliases"])
    linker = Linker(terms)

    report = {"同じ": 0, "差し替え": 0, "手で直した星": 0, "記事がない・曖昧さ回避": 0, "転送先が変わった": 0, "文が取れない": 0}
    held = []  # 人が確かめる星
    entries = []
    for s in stars:
        a = articles[s["wp"]]
        if a["missing"] or a["disambig"] or not a["extract"]:
            report["記事がない・曖昧さ回避"] += 1
            held.append((s["key"], s["title"], "記事がない・曖昧さ回避"))
            continue
        if a["title"] != s["wp"]:
            report["転送先が変わった"] += 1
            held.append((s["key"], s["title"], f"{s['wp']} → {a['title']}"))
            continue
        sents = sentences(a["extract"])[:3]
        if not sents:
            report["文が取れない"] += 1
            held.append((s["key"], s["title"], "文が取れない"))
            continue
        old = [st["text"] for st in s["statements"]]
        if [plain(t) for t in old] == sents and s["summary"] == sents[0]:
            report["同じ"] += 1
            continue
        if s["key"] in corrected:
            report["手で直した星"] += 1
            held.append((s["key"], s["title"], "手で直した星"))
            continue
        title = s["title"]
        self_names = sorted({title, s["wp"], split_qualifier(s["wp"])[0], *s["aliases"]}, key=len, reverse=True)
        new = [unlink_broken(linker.link(t, self_names)) for t in sents]
        # 文が同じでリンクの付き方だけが違うなら、今のリンクを残す
        new = [o if plain(o) == plain(n) else n for o, n in zip(old, new)] + new[len(old):]
        entries.append({"star": s["key"], "old": old, "new": new, "oldSummary": s["summary"], "newSummary": sents[0]})
        report["差し替え"] += 1
        if write:
            s["statements"] = [{"text": t} for t in new]
            s["summary"] = sents[0]

    print(f"星 {len(stars)}", file=sys.stderr)
    for k, v in report.items():
        print(f"  {k}：{v}", file=sys.stderr)
    for e in entries[:15]:
        print(f"\n[{e['star']}]\n  前：{' '.join(plain(t) for t in e['old'])}\n  後：{' '.join(plain(t) for t in e['new'])}", file=sys.stderr)
    with open(f"{work}/held.json", "w", encoding="utf-8") as f:
        json.dump(held, f, ensure_ascii=False, indent=1)
    print(f"\n人が確かめる星の一覧：{work}/held.json（{len(held)}個）", file=sys.stderr)

    if not write:
        print("\n確かめるだけで終わりました。ファイルを書き換えるには --write を付けて動かします。", file=sys.stderr)
        return
    if not entries:
        print("差し替える星がないので、何も書きませんでした。", file=sys.stderr)
        return
    os.makedirs(f"{ROOT}/src/data/refresh", exist_ok=True)
    out = f"{ROOT}/src/data/refresh/{version}.json"
    if os.path.exists(out):
        raise SystemExit(f"{out} はもうあります。別の版の名前を2つ目の引数で指定してください")
    json.dump({"version": version, "stars": entries}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    for p in SETS:
        json.dump(data[p], open(f"{ROOT}/{p}", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"書きました：{out}（{len(entries)}個）と、元データ {len(SETS)}つ", file=sys.stderr)


if __name__ == "__main__":
    main()
