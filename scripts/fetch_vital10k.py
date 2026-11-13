"""初期セット第4弾のために、Wikipedia「すべての言語版にあるべき項目の一覧/1万の項目」の各ページと、
そこに載っている記事の冒頭の文を取得する。途中で止まっても、もう一度動かすと続きから取る。

使い方（作業用のフォルダで動かす）：
  1. 既存の星の名前一覧 existing-names.json を用意する（第1〜3弾の星の名前・別名・記事名の配列。
     開発サーバーで createSampleData() を呼び、登録済みの星の title・aliases と出典の記事名を書き出す）
  2. python3 scripts/fetch_vital10k.py <作業用フォルダ>
     → lists.json（一覧のwikitext）と articles.json（記事の冒頭）ができる
  3. python3 scripts/build_vital10k.py <作業用フォルダ>/lists.json <作業用フォルダ>/articles.json <作業用フォルダ>/existing-names.json src/data/vital10k.json

- 20件ずつまとめて取得し、Wikipediaの制限（429）のときは指示された時間だけ待つ。全部で2時間ほどかかる。
"""
import json, os, re, sys, time, urllib.parse, urllib.request

SUBS = ["テクノロジー", "人物", "人類学、心理学と日常生活", "哲学と宗教", "地理", "数学", "歴史", "物理科学", "生物学と保健学", "社会と社会科学", "美術"]
UA = {"User-Agent": "KnowledgeCosmosDev/0.1 (starter-set builder)"}
def api(params, tries=40):
    q = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"}); wait = 20
    for _ in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request("https://ja.wikipedia.org/w/api.php?" + q, headers=UA), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            ra = e.headers.get("Retry-After"); w = float(ra) if ra and ra.isdigit() else wait
            print("wait", e.code, w, file=sys.stderr, flush=True); time.sleep(w); wait = min(wait * 1.5, 180)
        except Exception as e:
            print("wait", repr(e)[:60], file=sys.stderr, flush=True); time.sleep(wait); wait = min(wait * 1.5, 180)
    raise SystemExit("FAIL")
os.chdir(sys.argv[1])
if not os.path.exists("lists.json"):
    lists = {}
    for s in SUBS:
        page = f"Wikipedia:すべての言語版にあるべき項目の一覧/1万の項目/{s}"
        lists[s] = api({"action": "parse", "prop": "wikitext", "page": page})["parse"]["wikitext"]
        time.sleep(3)
    json.dump(lists, open("lists.json", "w"), ensure_ascii=False)
lists = json.load(open("lists.json"))
titles = []
for sub, w in lists.items():
    for line in w.split("\n"):
        if not line.startswith(("*", "#", ":")): continue
        for m in re.finditer(r"\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]", line):
            t = m.group(1).strip()
            if ":" not in t and t not in titles: titles.append(t)
existing = set(json.load(open("existing-names.json")))
todo = [t for t in titles if t not in existing]
CACHE = "articles.json"
out = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
todo = [t for t in todo if t not in out]
print("titles", len(titles), "todo", len(todo), file=sys.stderr, flush=True)
for i in range(0, len(todo), 20):
    chunk = todo[i:i + 20]
    d = api({"action": "query", "prop": "extracts|pageprops", "exintro": 1, "explaintext": 1, "exlimit": 20, "redirects": 1, "ppprop": "disambiguation", "titles": "|".join(chunk)})
    q = d["query"]; m = {}
    for x in q.get("normalized", []) + q.get("redirects", []): m[x["from"]] = x["to"]
    pages = {p["title"]: p for p in q["pages"]}
    for t in chunk:
        tgt = t
        for _ in range(3): tgt = m.get(tgt, tgt)
        p = pages.get(tgt, {})
        out[t] = {"title": tgt, "missing": bool(p.get("missing")) or not p, "disambig": "disambiguation" in p.get("pageprops", {}), "extract": p.get("extract", "")}
    json.dump(out, open(CACHE, "w"), ensure_ascii=False)
    print("done", len(out), file=sys.stderr, flush=True)
    time.sleep(4)
print("finished", file=sys.stderr, flush=True)
