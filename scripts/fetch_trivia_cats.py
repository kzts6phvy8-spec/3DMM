"""初期セット第7弾のカテゴリ表（fetch_trivia.py と build_trivia.py で共有する）"""

# カテゴリ → (アプリの分野, 星の種類, 小分類まで集めるか)
CATS = {
    "ことわざ": ("言語", "term", False), "故事成語": ("言語", "term", False), "慣用句": ("言語", "term", True),
    "和製英語": ("言語", "term", False), "日本の名数": ("言語", "term", True),
    "和菓子": ("食", "other", True), "日本の料理": ("食", "other", True), "日本の郷土料理": ("食", "other", False),
    "調味料": ("食", "other", True), "野菜": ("食", "other", True), "果物": ("食", "other", True),
    "寿司": ("食", "other", False), "麺料理": ("食", "other", True), "食材": ("食", "other", True), "日本の酒": ("食", "other", True),
    "日本の年中行事": ("暦と時間", "event", True), "日本の祭り": ("暦と時間", "event", True), "日本の記念日": ("暦と時間", "event", False),
    "日本の伝統芸能": ("芸術", "concept", True), "歌舞伎の演目": ("芸術", "work", False), "落語の演目": ("芸術", "work", True),
    "日本の伝統工芸品": ("芸術", "other", True), "茶道": ("芸術", "concept", True),
    "日本の神": ("宗教", "person", True), "日本の妖怪": ("宗教", "other", True), "日本の民話": ("言語", "work", True),
    "楽器": ("音楽", "other", True), "宝石": ("地球科学", "other", False), "恐竜": ("生物学", "other", True),
    "日本の城": ("建築", "place", True), "星座": ("天文学", "concept", True),
}
