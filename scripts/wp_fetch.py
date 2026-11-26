"""日本語版Wikipediaから、記事の冒頭（導入部の文）をまとめて取得する（初期セットの作り直し用）。

- 20件ずつまとめて取得し、Wikipediaの制限（429）のときは指示された時間だけ待つ
- 取った分は cache のファイルに少しずつ保存するので、途中で止まっても、もう一度動かすと続きから取る
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = {"User-Agent": "KnowledgeCosmosDev/0.1 (starter-set builder)"}


def api(params, tries=40):
    q = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    wait = 20
    for _ in range(tries):
        try:
            req = urllib.request.Request("https://ja.wikipedia.org/w/api.php?" + q, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
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


def fetch_extracts(titles, cache):
    """titles の各記事の冒頭を取る。戻り値：{記事名: {title（転送後の記事名）, missing, disambig, extract}}"""
    out = json.load(open(cache, encoding="utf-8")) if os.path.exists(cache) else {}
    todo = [t for t in dict.fromkeys(titles) if t not in out]
    print("titles", len(set(titles)), "todo", len(todo), file=sys.stderr, flush=True)
    for i in range(0, len(todo), 20):
        chunk = todo[i:i + 20]
        d = api({"action": "query", "prop": "extracts|pageprops", "exintro": 1, "explaintext": 1, "exlimit": 20,
                 "redirects": 1, "ppprop": "disambiguation", "titles": "|".join(chunk)})
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
            out[t] = {"title": tgt, "missing": bool(p.get("missing")) or not p,
                      "disambig": "disambiguation" in p.get("pageprops", {}), "extract": p.get("extract", "")}
        json.dump(out, open(cache, "w", encoding="utf-8"), ensure_ascii=False)
        print("done", len(out), file=sys.stderr, flush=True)
        time.sleep(4)
    return out
