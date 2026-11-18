"""クイズ年表（scripts/chrono_timeline.txt）から、初期セット第5弾（src/data/chrono.json）を作る。

使い方：
  node scripts/dump_starter_names.ts > 既存の星.json
  python3 scripts/build_chrono.py scripts/chrono_timeline.txt,scripts/notes_trivia.txt 既存の星.json 記事.json src/data/chrono.json 確認用.txt

- 入力は「,」でつないで複数渡せる（第5弾の年表、第6弾の知識メモ）。順番を変えると星のキーが変わるので、後ろに足していく。
- 年が空欄の項目（知識メモ）は、年の星を作らず、記述の話題を「雑学」にする。

- 星は2種類作る（利用者の希望）：
  - 出来事などの星（例：関ヶ原の戦い）。すでに初期セットにある星なら、新しく作らずに記述を足す（extra）。
  - 年の星（例：1600年）。その年の出来事を記述として並べ、出来事の星へリンクする。
- 記述の中に出てくる、ほかの星の名前は [[名前]] でリンクする（1文に最大3つ）。
  言葉の一部分（「短距離」の中の「距離」など）はリンクしない。
- 出典：利用者のメモ（クイズ年表）と、その星のWikipedia記事（見つかったときだけ）。
- 記事の冒頭に、その年が書かれていない項目は、確認用.txt に書き出す（目で確かめるため）。
"""
import json
import re
import sys
import unicodedata

KIND = {"e": "event", "p": "person", "w": "work", "c": "concept", "pl": "place", "o": "other", "t": "term"}
KANJI = re.compile(r"[一-龥々〆ヵヶ]")
KATA = re.compile(r"[゠-ヿー・A-Za-z0-9]")
HIRA = re.compile(r"[ぁ-ゖ]")
KATAKANA = re.compile(r"[ァ-ヺー]")
MEMO = "chrono-memo"


def norm(s: str) -> str:
    return unicodedata.normalize("NFKC", s).lower()


def split_qualifier(title: str):
    m = re.match(r"^(.*?)\s*\((.+)\)$", title)
    return (m.group(1), m.group(2)) if m else (title, "")


def display(title: str, qualifier: str) -> str:
    return f"{title}（{qualifier}）" if qualifier else title


def year_label(y: int) -> str:
    return f"{y}年" if y > 0 else f"紀元前{-y}年"


def year_key(y: int) -> str:
    return f"y{y}" if y > 0 else f"ym{-y}"


class Linker:
    """文の中の星の名前を [[名前]] にする。長い名前を優先し、言葉の一部分はリンクしない"""

    def __init__(self, terms):
        self.index = {}
        for t in terms:
            # 年・月・日（「11月」など）や数字だけの名前はリンクしない
            if len(t) < 2 or t.isdigit() or re.fullmatch(r"(紀元前)?\d+(年|月|日)(代)?", t):
                continue
            # ひらがなだけの短い名前（「もつ」など）は、ふつうの言葉と区別できないのでリンクしない
            if len(t) <= 3 and all("ぁ" <= ch <= "ゖ" for ch in t):
                continue
            self.index.setdefault(t[:2], []).append(t)
        for v in self.index.values():
            v.sort(key=len, reverse=True)

    def link(self, text, self_names, limit=3, already=0):
        taken = [(m.start(), m.end()) for m in re.finditer(r"\[\[.*?\]\]", text)]
        for b in self_names:
            if len(b) >= 2:
                for m in re.finditer(re.escape(b), text):
                    taken.append((m.start(), m.end()))
        cands = []
        for i in range(len(text) - 1):
            for t in self.index.get(text[i:i + 2], ()):
                if t in self_names or not text.startswith(t, i):
                    continue
                j = i + len(t)
                before = text[i - 1] if i > 0 else ""
                after = text[j] if j < len(text) else ""
                # カタカナ・英数字の言葉の途中から始まる／途中で終わるものは外す
                if KATA.match(t[0]) and before and KATA.match(before):
                    continue
                if KATA.match(t[-1]) and after and KATA.match(after):
                    continue
                # 漢字の言葉の一部分（「短距離」の「距離」など）は外す
                if KANJI.match(t[0]) and before and KANJI.match(before):
                    continue
                if KANJI.match(t[-1]) and after and KANJI.match(after):
                    continue
                # カタカナに続く漢字の言葉（「カフカス山脈」の「山脈」など）も、言葉の一部分として外す
                if KANJI.match(t[0]) and before and KATAKANA.match(before):
                    continue
                # 送りがなの途中で終わるもの（「許したとされ」の「許し」など）は外す
                if HIRA.match(t[-1]) and after and HIRA.match(after):
                    continue
                cands.append((i, j, t))
        cands.sort(key=lambda c: (-(c[1] - c[0]), c[0]))
        used, hits = set(), []
        for i, j, t in cands:
            if len(hits) + already >= limit:
                break
            if t in used or any(i < e and j > s for s, e in taken):
                continue
            taken.append((i, j))
            used.add(t)
            hits.append((i, j, t))
        out, pos = [], 0
        for s, e, t in sorted(hits):
            out.append(text[pos:s])
            out.append(f"[[{t}]]")
            pos = e
        out.append(text[pos:])
        return "".join(out)


def main():
    src, existing_path, articles_path, out_path, report_path = sys.argv[1:6]
    existing = json.load(open(existing_path, encoding="utf-8"))
    try:
        articles = json.load(open(articles_path, encoding="utf-8"))
    except FileNotFoundError:
        articles = {}

    # 既存の星：名前（表示名・名前・別名）→ キーと表示名
    by_display, by_title = {}, {}
    for s in existing:
        d = display(s["title"], s["qualifier"])
        by_display.setdefault(norm(d), (s["key"], d))
        by_title.setdefault(norm(s["title"]), []).append((s["key"], d))
        for a in s["aliases"]:
            by_title.setdefault(norm(a), []).append((s["key"], d))

    entries = []
    for path in src.split(","):
        for n, line in enumerate(open(path, encoding="utf-8")):
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            y, md, name, cat, kind, body = line.split("|")
            entries.append({"year": int(y) if y else None, "md": md, "name": name, "cat": cat, "kind": KIND[kind], "body": body,
                            "line": f"{path.rsplit('/', 1)[-1]}:{n + 1}", "order": len(entries)})

    # 星の名前ごとに、既存の星か新しい星かを決める
    targets = {}  # name → {"key", "display", "new": bool, ...}
    new_count = 0
    for e in entries:
        if e["name"] in targets:
            continue
        title, qual = split_qualifier(e["name"])
        hit = by_display.get(norm(display(title, qual)))
        if not hit and not qual:
            c = by_title.get(norm(title), [])
            if len({k for k, _ in c}) == 1:
                hit = c[0]
        if hit:
            targets[e["name"]] = {"key": hit[0], "display": hit[1], "new": False}
        else:
            targets[e["name"]] = {"key": f"c{new_count}", "display": display(title, qual), "new": True, "title": title, "qualifier": qual}
            new_count += 1

    # 出典
    sources = [{"key": MEMO, "type": "other", "title": "クイズ年表（利用者のメモ、2026年）"}]
    wp_key = {}

    # 記事が、項目よりずっと広い話題に転送されるもの（出典にしない。出典はメモだけ）
    BROAD = {"折りたたみ傘", "並行輸入", "パイロットファーム",
             # 同じ名前の別の話題の記事になるもの（第6弾）
             "グランデ", "伯", "蛇蝎のごとく", "女心と秋の空", "緑の黒髪", "子は鎹", "色の白いは七難隠す"}

    def article_source(name):
        if name in BROAD:
            return None
        a = articles.get(name)
        if not a or a["missing"] or a["disambig"] or not a["extract"]:
            return None
        t = a["title"]
        if t not in wp_key:
            k = f"cw{len(wp_key)}"
            wp_key[t] = k
            sources.append({"key": k, "type": "web", "title": f"Wikipedia：{t}", "url": "https://ja.wikipedia.org/wiki/" + t.replace(" ", "_")})
        return wp_key[t]

    # リンクに使う名前：既存の星の名前と、新しい星の表示名（年の星はリンクしない）
    # 既存の星のうち、2文字の「概念」（皇帝・語源など）は、ありふれた言葉なのでリンクしない
    def linkable(s):
        return not (s["kind"] == "concept" and len(s["title"]) <= 2)
    terms = {s["title"] for s in existing if linkable(s)} | {display(s["title"], s["qualifier"]) for s in existing if s["qualifier"]}
    terms |= {t["display"] for t in targets.values()}
    # 新しい星の、補足を除いた名前（同じ名前の星がほかにないときだけ。「東京オリンピック」が1964年と2020年の両方にあるなど）
    count = {}
    for t in targets.values():
        if t.get("new"):
            count[t["title"]] = count.get(t["title"], 0) + 1
    known_titles = {s["title"] for s in existing}
    terms |= {t["title"] for t in targets.values() if t.get("new") and count[t["title"]] == 1 and t["title"] not in known_titles}
    linker = Linker(terms)

    new_stars = {}
    extra = {}
    year_stars = {}
    report = []
    for e in sorted(entries, key=lambda x: (x["year"] is None, x["year"] or 0, x["order"])):
        tg = targets[e["name"]]
        title, qual = split_qualifier(e["name"])
        self_names = sorted({title, tg["display"], e["name"]}, key=len, reverse=True)
        src_keys = [MEMO]
        ak = article_source(e["name"])
        y = e["year"]
        if ak:
            src_keys.append(ak)
            a = articles[e["name"]]
            if y is not None:
                marks = [f"紀元前{-y}", f"前{-y}"] if y < 0 else [str(y)]
                if not any(m in a["extract"] for m in marks):
                    report.append(f"{e['line']} {year_label(y)} {e['name']}：記事「{a['title']}」の冒頭に年がない｜{a['extract'][:80]}")
        else:
            report.append(f"{e['line']} {e['name']}：記事が見つからない（出典はメモだけ）")
        if y is None:
            text = linker.link(e["body"], self_names)
            st = {"text": text, "topic": "雑学", "sources": src_keys}
        else:
            when = year_label(y) + ("頃" if e["md"] == "頃" else e["md"])
            text = f"{when}、" + linker.link(e["body"], self_names)
            st = {"text": text, "topic": "年表", "sources": src_keys}
        if tg["new"]:
            star = new_stars.setdefault(tg["key"], {
                "key": tg["key"], "title": tg["title"], "qualifier": tg["qualifier"], "aliases": [],
                "kind": e["kind"], "category": e["cat"], "summary": e["body"], "importance": 1, "statements": [],
            })
            star["statements"].append(st)
        else:
            extra.setdefault(tg["key"], []).append(st)

        # 年の星：出来事の星へリンクする（年がない項目は作らない）
        if y is None:
            continue
        ys = year_stars.setdefault(e["year"], {
            "key": year_key(e["year"]), "title": year_label(e["year"]), "qualifier": "", "aliases": [],
            "kind": "event", "category": "歴史", "summary": f"{year_label(e['year'])}の出来事（クイズ年表より）", "importance": 1, "statements": [],
        })
        body = e["body"]
        link_name = tg["display"]
        idx = body.find(title)
        if idx >= 0:
            body = body[:idx] + f"[[{link_name}]]" + body[idx + len(title):]
        else:
            body = f"[[{link_name}]]：{body}"
        md = "頃" if e["md"] == "頃" else e["md"]
        prefix = f"{md}、" if md and md != "頃" else ""
        ytext = prefix + linker.link(body, [year_label(e["year"])], already=1)
        ys["statements"].append({"text": ytext, "topic": "年表", "sources": src_keys})

    stars = list(new_stars.values()) + [year_stars[y] for y in sorted(year_stars)]
    json.dump({"sources": sources, "stars": stars, "extra": extra}, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(report_path, "w", encoding="utf-8").write("\n".join(report) + "\n")
    print(f"項目 {len(entries)}：新しい星 {len(new_stars)}・既存の星に足す {len(extra)}（記述 {sum(len(v) for v in extra.values())}）・年の星 {len(year_stars)}・Wikipedia出典 {len(wp_key)}・確認が必要 {len(report)}", file=sys.stderr)


if __name__ == "__main__":
    main()
