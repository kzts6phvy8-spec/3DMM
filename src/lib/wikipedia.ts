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
