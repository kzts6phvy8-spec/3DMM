"""Wikipedia（日本語版）APIを、制限（429）に配慮しながら呼び出す小さな部品。
初期セットの取り込みスクリプトから使う（アプリ本体では使わない）。"""
import json
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "KnowledgeCosmosDev/0.1 (starter-set builder)"}
API = "https://ja.wikipedia.org/w/api.php"


def api(params: dict, tries: int = 8) -> dict:
    q = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    wait = 3.0
    for _ in range(tries):
        try:
            req = urllib.request.Request(f"{API}?{q}", headers=UA)
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            retry = e.headers.get("Retry-After")
            time.sleep(float(retry) if retry and retry.isdigit() else wait)
            wait = min(wait * 2, 60)
        except Exception:
            time.sleep(wait)
            wait = min(wait * 2, 60)
    raise RuntimeError(f"Wikipedia API failed: {params}")
