// Wikipedia（日本語版）の公開APIから、記事の概要を取ってくる。
// サーバーやAPIキーは不要。取ってきた内容は「出典：Wikipedia」として扱い、確認済みにはしない。

export type WikiResult =
  | { status: 'ok'; title: string; description: string; extract: string; url: string }
  | { status: 'disambiguation'; title: string; url: string }
  | { status: 'notfound' }
  | { status: 'error'; message: string };

const API = 'https://ja.wikipedia.org/api/rest_v1/page/summary/';

export function wikipediaUrl(title: string): string {
  return `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`;
}

export async function fetchWikiSummary(title: string, signal?: AbortSignal): Promise<WikiResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'error', message: 'ネットにつながっていません' };
  }
  try {
    const res = await fetch(API + encodeURIComponent(title.replace(/ /g, '_')), {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (res.status === 404) return { status: 'notfound' };
    if (!res.ok) return { status: 'error', message: `Wikipediaから読み込めませんでした（${res.status}）` };
    const d = await res.json();
    const url: string = d?.content_urls?.mobile?.page ?? d?.content_urls?.desktop?.page ?? wikipediaUrl(d?.title ?? title);
    if (d.type === 'disambiguation') return { status: 'disambiguation', title: d.title, url };
    if (!d.extract) return { status: 'notfound' };
    return { status: 'ok', title: d.title, description: d.description ?? '', extract: d.extract, url };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return { status: 'error', message: 'Wikipediaに接続できませんでした' };
  }
}

/** 読み仮名や外国語表記などの（ ）を取り除く。入れ子の括弧にも対応する */
export function stripParentheses(text: string): string {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '（' || ch === '(') depth++;
    else if ((ch === '）' || ch === ')') && depth > 0) depth--;
    else if (depth === 0) out += ch;
  }
  // 括弧を消した跡に残る空白のうち、日本語の文字に接するものは取り除く（英単語どうしの空白は残す）
  return out.replace(/\s+/g, ' ').replace(/(?<=[^\x00-\x7F])\s+|\s+(?=[^\x00-\x7F])/g, '').trim();
}

/** 概要の文章を「。」で1文ずつに分ける */
export function splitSentences(text: string): string[] {
  return stripParentheses(text)
    .split(/(?<=。)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

// ---------------- 記事の本文から、記述の候補を作る ----------------

export interface WikiSection {
  /** 節の名前（冒頭は「概要」） */
  title: string;
  /** 記述にするときの話題 */
  topic: string;
  sentences: string[];
}

export type WikiArticleResult =
  | { status: 'ok'; title: string; url: string; sections: WikiSection[] }
  | { status: 'notfound' }
  | { status: 'error'; message: string };

/** 記述の候補にしない節（出典の一覧など） */
const SKIP_SECTIONS = /脚注|注釈|出典|参考文献|関連項目|外部リンク|関連文献|注記|参照|ギャラリー|作品一覧|年表|系譜|登場作品|一覧/;

/** 節の名前から、記述の話題を決める */
export function topicForSection(title: string): string {
  if (title === '概要') return '';
  if (/逸話|エピソード|人物|雑学|トリビア|画号|癖|名前について|人柄/.test(title)) return '雑学';
  if (/語源|名称|由来|呼称/.test(title)) return '語源';
  if (/歴史|生涯|経歴|沿革|来歴/.test(title)) return '歴史';
  return title.length <= 10 ? title : '';
}

/** 本文（== 見出し == を含む文字列）を節ごとの文の候補に分ける */
export function parseArticle(extract: string): WikiSection[] {
  const sections: WikiSection[] = [];
  let current: WikiSection = { title: '概要', topic: '', sentences: [] };
  let skipping = false;
  const flush = () => {
    if (!skipping && current.sentences.length) sections.push(current);
  };
  for (const line of extract.split('\n')) {
    const h = line.match(/^(=+)\s*(.+?)\s*=+\s*$/);
    if (h) {
      flush();
      const title = h[2];
      skipping = SKIP_SECTIONS.test(title);
      current = { title, topic: topicForSection(title), sentences: [] };
      continue;
    }
    if (skipping || !line.trim()) continue;
    for (const s of splitSentences(line)) {
      // 短すぎる・長すぎる・文として終わっていないものは候補にしない
      if (s.length < 12 || s.length > 160 || !s.endsWith('。')) continue;
      if (!current.sentences.includes(s)) current.sentences.push(s);
    }
  }
  flush();
  return sections;
}

export async function fetchWikiArticle(title: string, signal?: AbortSignal): Promise<WikiArticleResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'error', message: 'ネットにつながっていません' };
  }
  const params = new URLSearchParams({
    action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'wiki', redirects: '1',
    titles: title, format: 'json', origin: '*',
  });
  try {
    const res = await fetch(`https://ja.wikipedia.org/w/api.php?${params}`, { signal });
    if (!res.ok) return { status: 'error', message: `Wikipediaから読み込めませんでした（${res.status}）` };
    const d = await res.json();
    const page = Object.values(d?.query?.pages ?? {})[0] as { title?: string; extract?: string; missing?: string } | undefined;
    if (!page || 'missing' in page || !page.extract) return { status: 'notfound' };
    return { status: 'ok', title: page.title ?? title, url: wikipediaUrl(page.title ?? title), sections: parseArticle(page.extract) };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return { status: 'error', message: 'Wikipediaに接続できませんでした' };
  }
}
