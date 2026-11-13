// Wikipedia（日本語版）の公開APIから、記事の概要を取ってくる。
// サーバーやAPIキーは不要。取ってきた内容は「出典：Wikipedia」として記録する。

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

// ---------------- 記事の中のリンク（ほかの記事になっている言葉） ----------------

/** 記事の中でリンクされている言葉（別の記事のタイトル）を取ってくる。失敗したら空にする */
export async function fetchWikiLinkTitles(title: string, signal?: AbortSignal): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query', prop: 'links', titles: title, plnamespace: '0', pllimit: 'max',
    redirects: '1', format: 'json', origin: '*',
  });
  try {
    const res = await fetch(`https://ja.wikipedia.org/w/api.php?${params}`, { signal });
    if (!res.ok) return [];
    const d = await res.json();
    const pages = Object.values(d?.query?.pages ?? {}) as { links?: { title: string }[] }[];
    // 「マーキュリー (惑星)」のような区別の括弧は外す
    return pages.flatMap((p) => p.links ?? []).map((l) => l.title.replace(/\s*\(.+\)$/, ''));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return [];
  }
}

export type Segment = { text: string; term?: string };

const KATAKANA_LATIN = /[\u30A0-\u30FFー・A-Za-z0-9]/;

/**
 * カタカナや英字の言葉が、もっと長い言葉の一部になっていないかを確かめる。
 * 例：「インド・ヨーロッパ語族」の中の「インド」は、言葉の切れ目ではないので選ばない。
 */
function isWordBoundary(text: string, start: number, end: number, term: string): boolean {
  const before = text[start - 1] ?? '';
  const after = text[end] ?? '';
  if (KATAKANA_LATIN.test(term[0]) && before && KATAKANA_LATIN.test(before)) return false;
  if (KATAKANA_LATIN.test(term[term.length - 1]) && after && KATAKANA_LATIN.test(after)) return false;
  return true;
}

/**
 * 文を「ふつうの文字」と「星にできる言葉」に分ける。
 * 長い言葉を優先し、重ならないように選ぶ（例：「ロマンス諸語」を「ロマンス」より優先）。
 */
export function segmentByTerms(text: string, terms: string[], blockers: string[] = []): Segment[] {
  const hits: { start: number; end: number; term: string }[] = [];
  // 星自身の名前（例：フランス語）の部分は、中の言葉（フランス）を押せないようにする
  for (const b of blockers) {
    if (b.length < 2) continue;
    let from = 0;
    for (;;) {
      const i = text.indexOf(b, from);
      if (i < 0) break;
      hits.push({ start: i, end: i + b.length, term: '' });
      from = i + b.length;
    }
  }
  for (const term of [...terms].sort((a, b) => b.length - a.length)) {
    if (term.length < 2) continue;
    let from = 0;
    for (;;) {
      const i = text.indexOf(term, from);
      if (i < 0) break;
      const end = i + term.length;
      if (!hits.some((h) => i < h.end && end > h.start) && isWordBoundary(text, i, end, term)) hits.push({ start: i, end, term });
      from = end;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start > pos) out.push({ text: text.slice(pos, h.start) });
    out.push(h.term ? { text: h.term, term: h.term } : { text: text.slice(h.start, h.end) });
    pos = h.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** 印を付けた言葉を [[言葉]] にした文を作る（各言葉の最初の1か所だけ） */
export function applyMarks(text: string, terms: string[], marked: Set<string>, blockers: string[] = []): string {
  const done = new Set<string>();
  return segmentByTerms(text, terms, blockers)
    .map((s) => {
      if (s.term && marked.has(s.term) && !done.has(s.term)) {
        done.add(s.term);
        return `[[${s.term}]]`;
      }
      return s.text;
    })
    .join('');
}

// ---------------- 記事が見つからないときの候補探し ----------------

/** 『』「」などの括弧を外す（例：『国家』→ 国家） */
export function cleanTitle(title: string): string {
  return title.replace(/[『』「」【】〈〉《》"“”]/g, '').trim();
}

export interface WikiCandidate {
  title: string;
  snippet: string;
}

/**
 * Wikipediaの検索で、記事の候補を探す。
 * 関係する星の名前（例：プラトン）を手がかりに加えて、同じ名前の別の記事（例：国家 (対話篇)）を見つけやすくする。
 */
export async function searchWikiCandidates(title: string, context: string[], signal?: AbortSignal): Promise<WikiCandidate[]> {
  const base = cleanTitle(title);
  const run = async (q: string) => {
    const params = new URLSearchParams({ action: 'query', list: 'search', srsearch: q, srlimit: '8', format: 'json', origin: '*' });
    const res = await fetch(`https://ja.wikipedia.org/w/api.php?${params}`, { signal });
    if (!res.ok) return [];
    const d = await res.json();
    return ((d?.query?.search ?? []) as { title: string; snippet: string }[]).map((r) => ({
      title: r.title,
      snippet: r.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
    }));
  };
  try {
    const first = await run(`intitle:${base} ${context.join(' ')}`.trim());
    const rest = first.length < 3 ? await run(base) : [];
    const seen = new Set<string>();
    return [...first, ...rest]
      .filter((c) => !seen.has(c.title) && seen.add(c.title))
      .filter((c) => !context.includes(c.title))
      // 名前を含む記事（例：国家 (対話篇)）を先に並べる
      .sort((a, b) => Number(b.title.includes(base)) - Number(a.title.includes(base)))
      .slice(0, 6);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return [];
  }
}

/**
 * 「🌱 広げる」の候補：記事の中でリンクされている言葉。
 * 冒頭の文に出てくる言葉を先に、そのあとは記事の中の順に並べる。
 */
export async function fetchSeedCandidates(title: string, signal?: AbortSignal): Promise<string[] | null> {
  const [summary, links] = await Promise.all([fetchWikiSummary(title, signal), fetchWikiLinkTitles(title, signal)]);
  if (!links.length) return summary.status === 'error' ? null : [];
  const intro = summary.status === 'ok' ? summary.extract : '';
  // 年や日付だけの項目（例：1789年、7月14日）は除く
  const useful = links.filter(
    (t) => !/^[0-9０-９]+(年|月|日|世紀)/.test(t) && !/^[0-9０-９.,]+$/.test(t) && !/^[0-9]+月[0-9]+日$/.test(t) && !t.includes('一覧'),
  );
  const inIntro = useful.filter((t) => intro.includes(t));
  const rest = useful.filter((t) => !intro.includes(t));
  return [...inIntro, ...rest];
}
