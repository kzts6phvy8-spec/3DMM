"""初期セット第7弾（クイズ・雑学向けの分野）のために、日本語版Wikipediaのカテゴリから記事を集め、各記事の冒頭の文を取得する。
途中で止まっても、もう一度動かすと続きから取る。

使い方（作業用のフォルダで動かす）：
  1. 既存の星の名前一覧 existing-names.json を用意する（node scripts/dump_starter_names.ts > existing-names.json）
  2. python3 scripts/fetch_trivia.py <作業用フォルダ> [1カテゴリの取得の上限（既定350）]
     → members.json（カテゴリ → 記事名）と articles.json（記事の冒頭）ができる
  3. python3 scripts/build_trivia.py <作業用フォルダ> src/data/trivia.json

- カテゴリと分野・種類の対応は CATS。deep=True のカテゴリは、1段下の小分類の記事も集める
- 1つのカテゴリから取るのは先頭の LIMIT 件まで（組み立てで使うのは最大200個。外れる分の予備を含めた数）
- 20件ずつまとめて取得し、Wikipediaの制限（429）のときは指示された時間だけ待つ
"""
import json, os, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_trivia_cats import CATS  # noqa: E402

LIMIT = int(sys.argv[2]) if len(sys.argv) > 2 else 350
UA = {"User-Agent": "KnowledgeCosmosDev/0.1 (starter-set builder)"}


def api(params, tries=40):
    q = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    wait = 20
    for _ in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request("https://ja.wikipedia.org/w/api.php?" + q, headers=UA), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            ra = e.headers.get("Retry-After")
            w = float(ra) if ra and ra.isdigit() else wait
            print("wait", e.code, w, file=sys.stderr, flush=True)
            time.sleep(w)
            wait = min(wait * 1.5, 180)
        except Exception as e:  # noqa: BLE001
            print("wait", repr(e)[:60], file=sys.stderr, flush=True)
            time.sleep(wait)
            wait = min(wait * 1.5, 180)
    raise SystemExit("FAIL")


def members(cat, cmtype):
    out, cont = [], {}
    while True:
        d = api({"action": "query", "list": "categorymembers", "cmtitle": "Category:" + cat, "cmtype": cmtype, "cmlimit": 500, **cont})
        out += [m["title"] for m in d["query"]["categorymembers"]]
        if "continue" not in d:
            return out
        cont = {"cmcontinue": d["continue"]["cmcontinue"]}
        time.sleep(2)


os.chdir(sys.argv[1])
if not os.path.exists("members.json"):
    got = {}
    for cat, (_, _, deep) in CATS.items():
        pages = members(cat, "page")
        if deep:
            for sub in members(cat, "subcat"):
                pages += members(sub.split(":", 1)[1], "page")
                time.sleep(1)
        got[cat] = pages
        print(cat, len(pages), file=sys.stderr, flush=True)
        time.sleep(2)
    json.dump(got, open("members.json", "w"), ensure_ascii=False)
got = json.load(open("members.json"))
existing = set(json.load(open("existing-names.json")))
titles, seen = [], set()
for cat, pages in got.items():
    n = 0
    for t in pages:
        if ":" in t or "一覧" in t or t in existing or t in seen:
            continue
        if n >= LIMIT:
            break
        seen.add(t)
        titles.append(t)
        n += 1
CACHE = "articles.json"
out = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
todo = [t for t in titles if t not in out]
print("titles", len(titles), "todo", len(todo), file=sys.stderr, flush=True)
for i in range(0, len(todo), 20):
    chunk = todo[i:i + 20]
    d = api({"action": "query", "prop": "extracts|pageprops", "exintro": 1, "explaintext": 1, "exlimit": 20, "redirects": 1, "ppprop": "disambiguation", "titles": "|".join(chunk)})
    q = d["query"]
    m = {}
    for x in q.get("normalized", []) + q.get("redirects", []):
        m[x["from"]] = x["to"]
    pages = {p["title"]: p for p in q["pages"]}
    for t in chunk:
        tgt = t
        for _ in range(3):
            tgt = m.get(tgt, tgt)
        p = pages.get(tgt, {})
        out[t] = {"title": tgt, "missing": bool(p.get("missing")) or not p, "disambig": "disambiguation" in p.get("pageprops", {}), "extract": p.get("extract", "")}
    json.dump(out, open(CACHE, "w"), ensure_ascii=False)
    print("done", len(out), file=sys.stderr, flush=True)
    time.sleep(4)
print("finished", file=sys.stderr, flush=True)
