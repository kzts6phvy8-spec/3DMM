"""Wikipedia「すべての言語版にあるべき項目の一覧/1万の項目」から、初期セット第4弾を作る。

使い方：
  python3 scripts/build_vital10k.py <一覧のwikitext.json> <記事の冒頭.json> <既存の星の名前.json> src/data/vital10k.json

入力：
  - 一覧のwikitext.json：{ 分野ページ名: wikitext }（1万の項目の各ページ）
  - 記事の冒頭.json：{ 一覧の項目名: {title, missing, disambig, extract} }（scripts/fetch_vital10k.py で取得）
  - 既存の星の名前.json：初期セット第1〜3弾の星の名前・別名・記事名の一覧

作るもの（第3弾と同じ決まり）：
  - 星：記事名（区別の括弧は「補足」にする）・分野（一覧の見出しから）・種類
  - 記述：記事の冒頭の文を、Wikipediaの文のまま最大3文（読み仮名などの（ ）は省く）
  - 出典：その記事（アプリ側で自動で付く）
  - リンク：文の中に出てくる、ほかの星の名前を [[名前]] にする（1文に最大3つ）
  - 既にある星と同じ名前の項目は作らない（重複させない）。記事がない項目・曖昧さ回避は外す
"""
import json
import re
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from build_vital import KATA, sentences, split_qualifier  # noqa: E402

# 分野ページ → 既定の分野・種類
PAGE_DEFAULT = {
    "テクノロジー": ("技術", "concept"),
    "人物": ("歴史", "person"),
    "人類学、心理学と日常生活": ("社会", "concept"),
    "哲学と宗教": ("哲学", "concept"),
    "地理": ("地理", "place"),
    "数学": ("数学", "concept"),
    "歴史": ("歴史", "event"),
    "物理科学": ("科学", "concept"),
    "生物学と保健学": ("生物学", "concept"),
    "社会と社会科学": ("社会", "concept"),
    "美術": ("芸術", "concept"),
}

# 見出しの英語部分（先頭一致）→ 分野・種類。いちばん深い見出しで当たったものを使う
HEADING = [
    # 人物
    ("Entertainers", "映画", "person"), ("Visual artists", "芸術", "person"), ("Writers", "言語", "person"),
    ("Musicians", "音楽", "person"), ("Criminals", "歴史", "person"), ("Directors", "映画", "person"),
    ("Businesspeople", "経済学", "person"), ("Explorers", "歴史", "person"), ("Philosophers", "哲学", "person"),
    ("Religious figures", "宗教", "person"), ("Politicians", "歴史", "person"), ("Rebels", "歴史", "person"),
    ("Scientists", "科学", "person"), ("Journalists", "社会", "person"), ("Sports figures", "娯楽", "person"),
    ("Mythical", "宗教", "person"), ("Fictional characters", "芸術", "other"),
    # 人類学・日常生活
    ("Cooking", "食", "other"), ("Psychology", "心理学", "concept"), ("Language", "言語", "concept"),
    ("Recreation", "娯楽", "concept"), ("Timekeeping", "暦と時間", "concept"), ("Colors", "芸術", "concept"),
    # 哲学と宗教
    ("Religion", "宗教", "concept"), ("Deity", "宗教", "concept"), ("Beliefs", "宗教", "concept"),
    ("Practices", "宗教", "concept"), ("Death and afterlife", "宗教", "concept"), ("Institutions", "宗教", "other"),
    ("Theistic", "宗教", "concept"), ("Non-theistic", "宗教", "concept"), ("Specific religions", "宗教", "concept"),
    ("Abrahamic", "宗教", "concept"), ("Eastern religions", "宗教", "concept"), ("Traditional religion", "宗教", "concept"),
    ("Esoteric", "宗教", "concept"),
    # 歴史
    ("Historical cities", "歴史", "place"),
    # 物理科学
    ("Astronomy", "天文学", "concept"), ("Chemistry", "化学", "concept"), ("Earth science", "地球科学", "concept"),
    ("Physics", "物理学", "concept"), ("Measurement", "物理学", "concept"),
    # 生物学と保健学
    ("Organisms", "生物学", "other"), ("Health", "医学", "concept"), ("Medicine", "医学", "concept"),
    ("Disease", "医学", "concept"),
    # 社会
    ("Business", "経済学", "concept"), ("Law", "法", "concept"), ("Politics", "政治", "concept"),
    ("War and military", "歴史", "event"), ("Organizations", "政治", "other"),
    # 美術
    ("Architecture", "建築", "concept"), ("Specific structures", "建築", "place"), ("Literature", "言語", "concept"),
    ("Specific works of literature", "言語", "other"), ("Fictional worlds", "言語", "other"), ("Music", "音楽", "concept"),
    ("Specific musical works", "音楽", "other"), ("Musical instruments", "音楽", "other"), ("Performing arts", "芸術", "concept"),
    ("Visual arts", "芸術", "concept"), ("Film", "映画", "concept"),
]


def heading_category(text: str):
    best = None
    for key, cat, kind in HEADING:
        if text.startswith(key) and (best is None or len(key) > len(best[0])):
            best = (key, cat, kind)
    return (best[1], best[2]) if best else None


def parse_lists(lists):
    """各ページの項目を、見出しから決まる分野・種類と一緒に取り出す"""
    items, seen = [], set()
    for page, wikitext in lists.items():
        default = PAGE_DEFAULT.get(page, ("科学", "concept"))
        stack = {}  # 見出しの深さ → 分野・種類
        for line in wikitext.split("\n"):
            h = re.match(r"^(=+)\s*(.+?)\s*=+\s*$", line)
            if h:
                level = len(h.group(1))
                for k in [k for k in stack if k >= level]:
                    del stack[k]
                hc = heading_category(h.group(2))
                if hc:
                    stack[level] = hc
                continue
            if not line.startswith(("*", "#")):
                continue
            cur = stack[max(stack)] if stack else default
            for m in re.finditer(r"\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]", line):
                t = m.group(1).strip()
                if ":" in t or t in seen:
                    continue
                seen.add(t)
                items.append((t, cur[0], cur[1]))
    return items


class Linker:
    """文の中の星の名前を [[名前]] にする（第3弾の link_terms と同じ決まり。星が多くても速いように、先頭2文字で候補を絞る）"""

    def __init__(self, terms):
        self.index = {}
        for t in terms:
            if len(t) < 2 or t.isdigit():
                continue
            self.index.setdefault(t[:2], []).append(t)
        for v in self.index.values():
            v.sort(key=len, reverse=True)

    def link(self, text, self_names, limit=3):
        taken = []
        for b in self_names:
            if len(b) >= 2:
                for m in re.finditer(re.escape(b), text):
                    taken.append((m.start(), m.end()))
        # 長い名前を優先するため、まず候補を全部集めてから長い順に置く
        cands = []
        for i in range(len(text) - 1):
            for t in self.index.get(text[i:i + 2], ()):
                if t in self_names or not text.startswith(t, i):
                    continue
                j = i + len(t)
                if KATA.match(t[0]) and i > 0 and KATA.match(text[i - 1]):
                    continue
                if KATA.match(t[-1]) and j < len(text) and KATA.match(text[j]):
                    continue
                cands.append((i, j, t))
        cands.sort(key=lambda c: (-(c[1] - c[0]), c[0]))
        used, hits = set(), []
        for i, j, t in cands:
            if t in used or any(i < e and j > s for s, e in taken):
                continue
            taken.append((i, j))
            used.add(t)
            hits.append((i, j, t))
        hits = sorted(hits)[:limit]
        out, pos = [], 0
        for s, e, t in hits:
            out.append(text[pos:s])
            out.append(f"[[{t}]]")
            pos = e
        out.append(text[pos:])
        return "".join(out)


def main():
    lists_path, articles_path, existing_path, out_path = sys.argv[1:5]
    lists = json.load(open(lists_path, encoding="utf-8"))
    articles = json.load(open(articles_path, encoding="utf-8"))
    existing = set(json.load(open(existing_path, encoding="utf-8")))
    items = parse_lists(lists)

    skipped = {"既にある星": 0, "記事なし": 0, "曖昧さ回避": 0, "未取得": 0, "文が取れない": 0, "同じ記事": 0}
    chosen, used_articles = [], set()
    for t, cat, kind in items:
        a = articles.get(t)
        if t in existing:
            skipped["既にある星"] += 1
            continue
        if not a:
            skipped["未取得"] += 1
            continue
        if a["missing"] or not a["extract"]:
            skipped["記事なし"] += 1
            continue
        if a["disambig"]:
            skipped["曖昧さ回避"] += 1
            continue
        art = a["title"]
        if art in existing or split_qualifier(art)[0] in existing:
            skipped["既にある星"] += 1
            continue
        if art in used_articles:
            skipped["同じ記事"] += 1
            continue
        sents = sentences(a["extract"])[:3]
        if not sents:
            skipped["文が取れない"] += 1
            continue
        used_articles.add(art)
        chosen.append((t, art, cat, kind, sents))

    terms = set(existing)
    for t, art, *_ in chosen:
        terms.add(split_qualifier(art)[0])
    linker = Linker(terms)

    stars = []
    for n, (t, art, cat, kind, sents) in enumerate(chosen):
        title, qualifier = split_qualifier(art)
        names = {title, art, t, split_qualifier(t)[0]}
        self_names = sorted(names, key=len, reverse=True)
        stars.append({
            "key": f"w{n}",
            "title": title,
            "qualifier": qualifier,
            "aliases": sorted({x for x in names if x not in (title, art)}),
            "kind": kind,
            "category": cat,
            "summary": sents[0],
            "importance": 1,
            "wp": art,
            "statements": [{"text": linker.link(s, self_names)} for s in sents],
        })
    json.dump({"stars": stars}, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"項目 {len(items)} → 星 {len(stars)}", file=sys.stderr)
    for k, v in skipped.items():
        print(f"  外した（{k}）：{v}", file=sys.stderr)


if __name__ == "__main__":
    main()
