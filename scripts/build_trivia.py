"""初期セット第7弾（クイズ・雑学向けの分野）を作る。2026-11-26、利用者が「B：クイズ・雑学向けの分野だけ足す」を選んだ。

使い方：
  python3 scripts/build_trivia.py <作業用フォルダ> src/data/trivia.json [1カテゴリの上限（既定200）]
  （作業用フォルダには scripts/fetch_trivia.py が作った members.json・articles.json と、existing-names.json・starter-specs.json がある）

作るもの（第3・4弾と同じ決まり）：
  - 星：記事名（区別の括弧は「補足」にする）・分野と種類（カテゴリから。fetch_trivia.py の CATS）
  - 記述：記事の冒頭の文を、Wikipediaの文のまま最大3文
  - 出典：その記事（アプリ側で自動で付く）
  - リンク：文の中に出てくる、ほかの星の名前を [[名前]] にする（1文に最大3つ。第4弾と同じ Linker）
    ひらがなだけの名前が言葉の途中に付くリンクは、アプリの src/lib/kanaLinks.ts と同じ決まりで、ここでは作らない
  - 既にある星と同じ名前の項目は作らない。記事がない項目・曖昧さ回避・一覧の記事は外す
  - 会社のマスコット・登録商標の商品・テレビやゲームなどの作品の記事は外す（雑学の星として弱いため。冒頭の文で判断）
  - 分野が偏らないように、1つのカテゴリから選ぶのは最大 CAP 個（記事の冒頭が長いものから。よく書かれた記事ほど知られていると考える）
"""
import json
import re
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from build_vital import sentences, split_qualifier  # noqa: E402
from build_vital10k import Linker  # noqa: E402
from fetch_trivia_cats import CATS  # noqa: E402

HIRA = re.compile(r"^[ぁ-ゟ]+$")
H1 = re.compile(r"[ぁ-ゟ]")
KANJI = re.compile(r"[一-鿿々]")
PARTICLES = set("のはがをにとでやもへか")
NOT_TRIVIA = re.compile(r"マスコットキャラクター|登録商標|写真集|ゲーム|ドラマ|放送|アニメ|漫画|アイドル")
CAP = int(sys.argv[3]) if len(sys.argv) > 3 else 200


def broken_kana(name, before, after):
    """src/lib/kanaLinks.ts の isBrokenKanaLink と同じ決まり"""
    if not HIRA.match(name):
        if not H1.search(name) or not KANJI.match(before or " "):
            return False
        return bool(H1.match(name[0]) or H1.match(name[-1]))
    if KANJI.match(before or " "):
        return True
    if before == "を":
        return True
    if after and H1.match(after) and after not in PARTICLES:
        return True
    return False


def unlink_broken(text):
    def rep(m):
        name = m.group(1)
        before = text[m.start() - 1] if m.start() > 0 else ""
        after = text[m.end()] if m.end() < len(text) else ""
        return name if broken_kana(name, before, after) else m.group(0)
    return re.sub(r"\[\[([^\]]+)\]\]", rep, text)


def main():
    work, out_path = sys.argv[1:3]
    members = json.load(open(f"{work}/members.json", encoding="utf-8"))
    articles = json.load(open(f"{work}/articles.json", encoding="utf-8"))
    existing = set(json.load(open(f"{work}/existing-names.json", encoding="utf-8")))

    skipped = {"既にある星": 0, "記事なし": 0, "曖昧さ回避": 0, "未取得": 0, "文が取れない": 0, "同じ記事": 0, "一覧": 0, "作品・商品": 0}
    chosen, used_articles, seen = [], set(), set()
    per_cat = {}
    for cat, pages in members.items():
        field, kind, _ = CATS[cat]
        pages = sorted(pages, key=lambda t: -len((articles.get(t) or {}).get("extract", "")))
        for t in pages:
            if per_cat.get(cat, 0) >= CAP:
                break
            if t in seen:
                continue
            seen.add(t)
            if ":" in t or "一覧" in t:
                skipped["一覧"] += 1
                continue
            if t in existing:
                skipped["既にある星"] += 1
                continue
            a = articles.get(t)
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
            if art in existing or split_qualifier(art)[0] in existing or "一覧" in art:
                skipped["既にある星"] += 1
                continue
            if art in used_articles:
                skipped["同じ記事"] += 1
                continue
            sents = sentences(a["extract"])[:3]
            if not sents:
                skipped["文が取れない"] += 1
                continue
            if NOT_TRIVIA.search(sents[0]):
                skipped["作品・商品"] += 1
                continue
            used_articles.add(art)
            chosen.append((t, art, field, kind, sents))
            per_cat[cat] = per_cat.get(cat, 0) + 1

    terms = set(existing)
    for t, art, *_ in chosen:
        terms.add(split_qualifier(art)[0])
    linker = Linker(terms)

    stars = []
    for n, (t, art, field, kind, sents) in enumerate(chosen):
        title, qualifier = split_qualifier(art)
        names = {title, art, t, split_qualifier(t)[0]}
        self_names = sorted(names, key=len, reverse=True)
        stars.append({
            "key": f"t{n}",
            "title": title,
            "qualifier": qualifier,
            "aliases": sorted({x for x in names if x not in (title, art)}),
            "kind": kind,
            "category": field,
            "summary": sents[0],
            "importance": 1,
            "wp": art,
            "statements": [{"text": unlink_broken(linker.link(s, self_names))} for s in sents],
        })
    json.dump({"stars": stars}, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"星 {len(stars)}", file=sys.stderr)
    for k, v in per_cat.items():
        print(f"  {k}：{v}", file=sys.stderr)
    for k, v in skipped.items():
        print(f"  外した（{k}）：{v}", file=sys.stderr)


if __name__ == "__main__":
    main()
