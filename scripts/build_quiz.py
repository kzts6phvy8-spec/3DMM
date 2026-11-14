"""言葉クイズの問題（src/data/quizWords.json）を作る。

使い方：
  python3 scripts/build_quiz.py <取得したWikipediaの要約.json> src/data/quizWords.json

入力は、次の形の一覧（言葉ごとに Wikipedia の冒頭の文を取ったもの）：
  [{"q": 調べた言葉, "cat": 分野, "title": 記事名, "missing": bool, "disambig": bool, "extract": 冒頭の文章}]

- 記事がない言葉・曖昧さ回避のページは外す。
- 選択肢に使う「短い説明」は、冒頭の1文から主語（「〇〇は、」）を取り、言葉そのものを「〇〇」に伏せて作る。
- 説明はWikipediaの文のまま使う（言い換えや創作はしない）。
"""
import json
import re
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from build_vital import sentences, strip_parentheses  # noqa: E402

SUBJECT = re.compile(r"^(.{1,45}?)(?:とは|は)、")
KATAKANA_TOKEN = re.compile(r"[ァ-ヴー]{3,}")
# 生き物の分類だけを述べた文（例：「〇〇科〇〇属に分類される」）。クイズの手がかりにならない
TAXONOMY = re.compile(r"(綱|目|科|属|門|類)[A-Za-z]*(に属|に分類|の属の|の一グループ)|〇〇(科|属|目|綱|門|類)")
# 名前の一部でも、伏せると意味が通らなくなる一般的な言葉
GENERIC = {"パラドックス", "シンドローム", "ネットワーク"}
KANJI_TOKEN = re.compile(r"[一-龥々]{2,}")
# 名前に含まれる漢字のうち、ありふれていてヒントにならない言葉（これ以外の漢字の部分は「〇〇」に伏せる）
GENERIC_KANJI = {
    "効果", "現象", "事件", "法則", "問題", "実験", "錯視", "錯覚", "症候群", "限界", "戦争", "計画", "運動", "放射",
    "誤謬", "予想", "定理", "仮説", "原理", "理論", "年問題", "植民地", "立方体", "反応", "料理", "文字", "言葉",
    "音楽", "建築", "時計", "人形", "機関", "効果的", "地形", "現象的", "主義", "伝播", "分類群", "の法則",
}

# 外す言葉（理由）：よく知られていて「難しい言葉」にならない、または説明が前後の文脈なしでは読めない
EXCLUDE = {
    "回文": "よく知られている",
    "アナグラム": "よく知られている",
    "共鳴": "よく知られている",
    "点描": "よく知られている",
    "いろは歌": "よく知られている",
    "擬声語": "よく知られている",
    "ミーム": "よく知られている",
    "ソニックブーム": "よく知られている",
    "ハンロンの剃刀": "説明が「次の文で…」と文脈に頼っている",
    "公案": "記事が別の意味（中国の役所の文書）",
    "蔀": "文の区切りが崩れている",
    "文楽": "選ばれる文が説明になっていない",
    "明暦の大火": "選ばれる文が説明になっていない（前の文に頼る）",
    "超越数": "選ばれる文が説明になっていない",
    "承平天慶の乱": "説明に答え（天慶の乱）が出る",
    "フィリバスター": "記事が別の意味（軍事行為）",
    "ガルム": "記事が別の意味（神話の番犬）",
    "声明": "読み（せいめい）と記事の意味が食い違う",
    "単為生殖": "文の始まりが欠けている",
    "友愛数": "文が欠けている",
    "ゴールドバッハの予想": "前の文に頼る",
    "アローの不可能性定理": "前の文に頼る",
    "凝固点降下": "前の文に頼る",
    "コノハムシ": "文の始まりが崩れている",
    "箏": "前の文に頼る",
    "ヘイフリック限界": "前の文に頼る",
    "ヤルダン": "説明になっていない",
    "熱水噴出孔": "説明になっていない",
    "ベニクラゲ": "説明になっていない（分布だけ）",
    "キソウテンガイ": "説明になっていない（分布だけ）",
    "ダイオウイカ": "説明になっていない（分布だけ）",
    "ミツクリザメ": "説明になっていない（分布だけ）",
    "ムジナモ": "説明になっていない（分布だけ）",
    "モウセンゴケ": "説明になっていない（別名だけ）",
    "スローロリス": "説明になっていない（別名だけ）",
    "島嶼化": "説明になっていない",
    "米騒動": "説明になっていない",
    "クレオール言語": "説明になっていない",
    "ケチャ": "説明になっていない",
    "ブルームーン": "説明になっていない",
    "ハエトリグサ": "説明に別名（ハエトリソウ）が出る",
}


def variants(title: str):
    base = re.sub(r"\s*\(.*?\)\s*$", "", title)
    out = {title, base, base.replace("・", ""), base.replace("＝", "・")}
    return sorted((v for v in out if v), key=len, reverse=True)


def mask(text: str, names):
    for v in names:
        text = text.replace(v, "〇〇")
    return text


def name_tokens(title: str):
    """名前に含まれるカタカナの部分（例：テセウスの船 → テセウス）と、特徴的な漢字の部分（例：鳴門の渦潮 → 鳴門・渦潮）。
    説明に出ると答えのヒントになるので伏せる"""
    base = re.sub(r"\s*\(.*?\)\s*$", "", title)
    kata = {t for t in KATAKANA_TOKEN.findall(base) if t not in GENERIC}
    kanji = {t for t in KANJI_TOKEN.findall(base) if t not in GENERIC_KANJI and t != base}
    return kata | kanji


def definition(sents, title: str, query: str):
    """冒頭の文から主語を取り、言葉を伏せる。1文目が短すぎる（例：「心理現象の一種。」）ときは2文目もつなげる"""
    names = sorted(set(variants(title)) | set(variants(query)) | name_tokens(title) | name_tokens(query), key=len, reverse=True)

    def clean(sentence: str) -> str:
        # 主語（「〇〇は、」）を取るのは、そこに言葉の名前が入っているときだけ（文の途中の「…には、」を消さないように）
        m = SUBJECT.match(sentence)
        if m and any(v in m.group(1) for v in names):
            sentence = sentence[m.end():]
        sentence = mask(sentence, names)
        # 学名（例：Rafflesia arnoldii）は答えのヒントになるので取り除く
        sentence = re.sub(r"\s?[A-Z][a-z]+ [a-z]+", "", sentence)
        return re.sub(r"^〇〇(?:とは|は)、?", "", sentence).strip()

    def standalone(t: str) -> bool:
        # 前の文に頼る文（「また、」「以下に述べる」など）・分類だけの文は使わない
        return (
            not TAXONOMY.search(t)
            and not re.match(r"^(また|なお|ただし|しかし|これ|それ|この|その(?!名))", t)
            # 文の始まりが欠けたもの（「の解にもならない…」など）
            and not re.match(r"^[のにをがでとへもやは、）)]", t)
            and not re.match(r"^次の", t)
            and "ここでは" not in t
            and "以下" not in t
            and "本稿" not in t
            and "本項" not in t
        )

    cleaned = [clean(t) for t in sents]
    d = ""
    for i, t in enumerate(cleaned):
        if not standalone(t):
            continue
        cand = t
        # 1文目が短い（例：「心理現象の一種。」）ときは、次の文もつなげる
        if len(cand) < 25 and i + 1 < len(cleaned) and standalone(cleaned[i + 1]):
            cand = cand + cleaned[i + 1]
        if len(cand) >= 22 and cand.count("〇〇") <= 1:
            d = cand
            break
    return d.strip()


def main():
    src, dst = sys.argv[1], sys.argv[2]
    raw = json.load(open(src, encoding="utf-8"))
    words, skipped = [], []
    for x in raw:
        if x.get("missing") or x.get("disambig") or not x.get("extract"):
            skipped.append((x["q"], "記事なし" if x.get("missing") else "曖昧さ回避" if x.get("disambig") else "本文なし"))
            continue
        sents = sentences(x["extract"])
        if not sents:
            skipped.append((x["q"], "文が取れない"))
            continue
        if x["q"] in EXCLUDE or x["title"] in EXCLUDE:
            skipped.append((x["q"], EXCLUDE.get(x["q"]) or EXCLUDE[x["title"]]))
            continue
        # 別の話題の記事に転送されたもの（例：プルースト効果 → 失われた時を求めて）は外す
        if x["title"] != x["q"] and x["q"] not in x["extract"]:
            skipped.append((x["q"], f"転送先が別の話題（{x['title']}）"))
            continue
        d = definition(sents, x["title"], x["q"])
        if len(d) < 15 or len(d) > 130:
            skipped.append((x["q"], f"説明の長さ {len(d)}"))
            continue
        title = re.sub(r"\s*\(.*?\)\s*$", "", x["title"])
        words.append({
            "title": title,
            "category": x["cat"],
            "definition": d,
            "summary": sents[0],
            "sentences": sents[:3],
            "articleTitle": x["title"],
            "url": "https://ja.wikipedia.org/wiki/" + x["title"].replace(" ", "_"),
        })
    # 同じ記事に転送された言葉は1つにまとめる
    seen, uniq = set(), []
    for w in words:
        if w["articleTitle"] in seen:
            skipped.append((w["title"], "重複"))
            continue
        seen.add(w["articleTitle"])
        uniq.append(w)
    json.dump({"words": uniq}, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(uniq)}語を書き出しました。外したもの：", file=sys.stderr)
    for q, why in skipped:
        print(f"  {q}：{why}", file=sys.stderr)


if __name__ == "__main__":
    main()
