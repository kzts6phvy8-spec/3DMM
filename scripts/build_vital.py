"""Wikipedia「すべての言語版にあるべき項目の一覧」（約1000項目）から、初期セット第3弾を作る。

使い方：
  python3 scripts/build_vital.py <既存の星の名前一覧.json> src/data/vital.json

作るもの：
  - 星：記事名（区別の括弧は「補足」にする）・分野（一覧の見出しから）・種類
  - 記述：記事の冒頭の文を、Wikipediaの文のまま最大3文（読み仮名などの（ ）は省く）
  - 出典：その記事（アプリ側で自動で付く）
  - リンク：文の中に出てくる、ほかの星の名前を [[名前]] にする
  - 既にある星と同じ名前の項目は、新しい星を作らず、その星に足す記述（extra）にする
"""
import json
import re
import sys

from wiki_fetch import api

LIST_PAGE = "Wikipedia:すべての言語版にあるべき項目の一覧"

# 一覧の見出し（日本語部分）→ 分野・種類
CATEGORY = [
    ("芸術家と建築家", "芸術", "person"),
    ("作家・劇作家・詩人", "言語", "person"),
    ("作曲家と音楽家", "音楽", "person"),
    ("冒険者・探検家", "歴史", "person"),
    ("映画監督・脚本家・俳優", "映画", "person"),
    ("発明家・科学者・数学者", "科学", "person"),
    ("哲学者・人文科学者", "哲学", "person"),
    ("政治的指導者", "歴史", "person"),
    ("宗教家と神学者", "宗教", "person"),
    ("哲学、原理", "哲学", "concept"),
    ("心理学", "心理学", "concept"),
    ("宗教", "宗教", "concept"),
    ("家族・人間関係", "社会", "concept"),
    ("政治", "政治", "concept"),
    ("ビジネス・経済", "経済学", "concept"),
    ("法", "法", "concept"),
    ("国際組織", "政治", "other"),
    ("戦争と軍事", "歴史", "event"),
    ("社会問題", "社会", "concept"),
    ("言語と文学", "言語", "concept"),
    ("天文学", "天文学", "other"),
    ("生物学的プロセス", "生物学", "concept"),
    ("解剖学", "生物学", "concept"),
    ("健康・医学", "医学", "concept"),
    ("生命体", "生物学", "other"),
    ("生物学", "生物学", "concept"),
    ("化学", "化学", "concept"),
    ("気象・地質学", "地球科学", "concept"),
    ("物理学", "物理学", "concept"),
    ("測定・単位", "物理学", "concept"),
    ("時法", "暦と時間", "concept"),
    ("飲み物", "食", "other"),
    ("食料品", "食", "other"),
    ("数学", "数学", "concept"),
    ("コンピュータとインターネット", "技術", "concept"),
    ("コミュニケーション", "技術", "concept"),
    ("電子工学", "技術", "concept"),
    ("エネルギーと燃料", "技術", "concept"),
    ("材料", "技術", "concept"),
    ("輸送", "技術", "concept"),
    ("武器、兵器", "技術", "other"),
    ("技術", "技術", "concept"),
    ("建築・土木技術", "建築", "concept"),
    ("映画・ラジオ・テレビ", "映画", "concept"),
    ("音楽", "音楽", "concept"),
    ("レクリエーション", "娯楽", "concept"),
    ("先史時代と古代", "歴史", "event"),
    ("中世から近世", "歴史", "event"),
    ("近代", "歴史", "event"),
    ("歴史", "歴史", "event"),
    ("大陸と主要地域", "地理", "place"),
    ("国家", "地理", "place"),
    ("都市", "地理", "place"),
    ("海洋・湖・河川", "地理", "place"),
    ("山、谷、砂漠", "地理", "place"),
    ("地理", "地理", "place"),
    ("社会科学", "社会", "concept"),
    ("科学", "科学", "concept"),
    ("芸術と娯楽", "芸術", "concept"),
    ("人物記", "歴史", "person"),
]


def section_category(heading: str):
    for key, cat, kind in CATEGORY:
        if key in heading:
            return cat, kind
    return None


def parse_list(wikitext: str):
    """見出しごとに、項目（記事名）を取り出す"""
    items = []
    current = None
    for line in wikitext.split("\n"):
        h = re.match(r"^(=+)\s*(.+?)\s*=+\s*$", line)
        if h:
            title = h.group(2)
            if "差し替えられた" in title or "関連項目" in title:
                break
            current = section_category(title)
            continue
        if not current or not line.startswith(("*", "#", ":")):
            continue
        for m in re.finditer(r"\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]", line):
            t = m.group(1).strip()
            if ":" in t:  # Wikipedia: や meta: などは除く
                continue
            items.append((t, current[0], current[1]))
    seen = set()
    out = []
    for t, c, k in items:
        if t not in seen:
            seen.add(t)
            out.append((t, c, k))
    return out


def strip_parentheses(text: str) -> str:
    out, depth = [], 0
    for ch in text:
        if ch in "（(":
            depth += 1
        elif ch in "）)" and depth > 0:
            depth -= 1
        elif depth == 0:
            out.append(ch)
    s = re.sub(r"\s+", " ", "".join(out))
    s = re.sub(r"(?<=[^\x00-\x7F])\s+|\s+(?=[^\x00-\x7F])", "", s)
    return s.strip()


def sentences(text: str):
    out = []
    for para in text.split("\n"):
        for s in re.split(r"(?<=。)", strip_parentheses(para)):
            s = s.strip()
            if 8 <= len(s) <= 200 and s.endswith("。") and s not in out:
                out.append(s)
    return out


KATA = re.compile(r"[゠-ヿー・A-Za-z0-9]")


def link_terms(text: str, terms, self_names, limit=3):
    """文の中に出てくる星の名前を [[名前]] にする（長い名前を優先、各名前は1回、1文に最大limit個）"""
    hits = []
    for b in self_names:
        if len(b) >= 2:
            for m in re.finditer(re.escape(b), text):
                hits.append((m.start(), m.end(), None))
    for term in terms:
        if len(term) < 2 or term in self_names:
            continue
        i = text.find(term)
        while i >= 0:
            j = i + len(term)
            ok = not any(i < e and j > s for s, e, _ in hits)
            if ok and KATA.match(term[0]) and i > 0 and KATA.match(text[i - 1]):
                ok = False
            if ok and KATA.match(term[-1]) and j < len(text) and KATA.match(text[j]):
                ok = False
            if ok:
                hits.append((i, j, term))
                break
            i = text.find(term, j)
    linked = sorted([h for h in hits if h[2]], key=lambda h: h[0])[:limit]
    out, pos = [], 0
    for s, e, t in linked:
        out.append(text[pos:s])
        out.append(f"[[{t}]]")
        pos = e
    out.append(text[pos:])
    return "".join(out)


def split_qualifier(title: str):
    m = re.match(r"^(.*?)\s*\((.+)\)$", title)
    return (m.group(1), m.group(2)) if m else (title, "")


def main():
    existing_path, out_path = sys.argv[1], sys.argv[2]
    existing = json.load(open(existing_path, encoding="utf-8"))
    existing_names = {}
    for e in existing:
        for n in [e["title"], *e["aliases"], e["wp"]]:
            if n:
                existing_names.setdefault(n, e["key"])

    wikitext = api({"action": "parse", "prop": "wikitext", "page": LIST_PAGE})["parse"]["wikitext"]
    items = parse_list(wikitext)
    print("items:", len(items), file=sys.stderr)

    # 冒頭の文をまとめて取る（20件ずつ）
    articles = {}
    for i in range(0, len(items), 20):
        chunk = [t for t, _, _ in items[i : i + 20]]
        d = api({"action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1, "exlimit": 20, "redirects": 1, "titles": "|".join(chunk)})
        q = d["query"]
        redir = {r["from"]: r["to"] for r in q.get("redirects", []) + q.get("normalized", [])}
        pages = {p["title"]: p for p in q["pages"]}
        for t in chunk:
            tgt = redir.get(t, t)
            tgt = redir.get(tgt, tgt)
            p = pages.get(tgt)
            if p and not p.get("missing") and p.get("extract"):
                articles[t] = (p["title"], p["extract"])
        print(f"  {min(i + 20, len(items))}/{len(items)}", file=sys.stderr)

    # 星の名前の一覧（リンク用）
    stars, extra = [], {}
    all_terms = set(existing_names.keys())
    for t, cat, kind in items:
        if t not in articles:
            continue
        title, _ = split_qualifier(articles[t][0])
        all_terms.add(title)
        if t != articles[t][0]:
            all_terms.add(split_qualifier(t)[0])
    terms = sorted(all_terms, key=len, reverse=True)

    used_keys = set()
    for idx, (t, cat, kind) in enumerate(items):
        if t not in articles:
            continue
        art_title, extract = articles[t]
        title, qualifier = split_qualifier(art_title)
        names = {title, art_title, t, split_qualifier(t)[0]}
        sents = sentences(extract)[:3]
        if not sents:
            continue
        self_names = sorted(names, key=len, reverse=True)
        linked = [link_terms(s, terms, self_names) for s in sents]
        hit = next((existing_names[n] for n in names if n in existing_names), None)
        if hit:
            # 既にある星には、記述を足すだけにする
            extra.setdefault(hit, {"wp": art_title, "statements": []})
            extra[hit]["statements"].extend({"text": s} for s in linked)
            continue
        key = f"v{idx}"
        if key in used_keys:
            continue
        used_keys.add(key)
        aliases = sorted({n for n in names if n not in (title, art_title)})
        stars.append(
            {
                "key": key,
                "title": title,
                "qualifier": qualifier,
                "aliases": aliases,
                "kind": kind,
                "category": cat,
                "summary": sents[0],
                "importance": 2,
                "wp": art_title,
                "statements": [{"text": s} for s in linked],
            }
        )
        for n in names:
            existing_names.setdefault(n, key)

    json.dump({"stars": stars, "extra": extra}, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("stars:", len(stars), "extra for existing:", len(extra), file=sys.stderr)


if __name__ == "__main__":
    main()
