// 日本語版Wikipediaに載っていない言葉のための、ほかの情報源（AIを使わない）。
// - 英語版Wikipedia：冒頭の文
// - ウィクショナリー（日本語版・英語版）：語源・意味などの節
// どれも出典として記録し、状態は「出典あり」まで（確認済みにはしない）。

export type OtherSite = 'enwiki' | 'jawikt' | 'enwikt';

export const OTHER_SITES: Record<OtherSite, { host: string; label: string; short: string }> = {
  enwiki: { host: 'en.wikipedia.org', label: 'Wikipedia（英語版）', short: '英語版Wikipedia' },
  jawikt: { host: 'ja.wiktionary.org', label: 'ウィクショナリー', short: 'ウィクショナリー' },
  enwikt: { host: 'en.wiktionary.org', label: 'ウィクショナリー（英語版）', short: '英語版ウィクショナリー' },
};

export interface OtherSection {
  title: string;
  topic: string;
  items: string[];
}

export type OtherResult =
  | { status: 'ok'; site: OtherSite; title: string; url: string; sections: OtherSection[] }
  | { status: 'notfound' }
  | { status: 'error'; message: string };

/** 記述の候補にしない節（発音・翻訳・参考文献など） */
const SKIP =
  /発音|翻訳|脚注|参照|参考|出典|外部リンク|関連項目|派生語|関連語|類義語|対義語|上位語|下位語|成句|Pronunciation|Translations|Anagrams|References|Further reading|See also|Derived terms|Related terms|Descendants|Synonyms|Antonyms|Hyponyms|Hypernyms|Coordinate terms|Usage notes|Alternative forms|Collocations|Quotations|External links|Notes|Gallery/;

function topicFor(title: string): string {
  if (/語源|Etymology/.test(title)) return '語源';
  if (/歴史|History/.test(title)) return '歴史';
  return '';
}

/** 英語の文章を1文ずつに分ける */
function splitEnglish(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'(“])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 260);
}

/** 本文（== 見出し == を含む）を、節ごとの候補に分ける */
function parseSections(extract: string, site: OtherSite, word: string): OtherSection[] {
  const sections: OtherSection[] = [];
  let lang = '';
  let current: OtherSection = { title: '概要', topic: '', items: [] };
  let skipping = false;
  const flush = () => {
    if (!skipping && current.items.length) sections.push(current);
  };
  for (const raw of extract.split('\n')) {
    const h = raw.match(/^(=+)\s*(.+?)\s*=+\s*$/);
    if (h) {
      flush();
      const level = h[1].length;
      const title = h[2];
      if (level === 2 && site !== 'enwiki') lang = title; // ウィクショナリーは「== 日本語 ==」などの言語ごと
      skipping = SKIP.test(title);
      current = { title: level === 2 || !lang ? title : `${lang}：${title}`, topic: topicFor(title), items: [] };
      continue;
    }
    const line = raw.trim();
    if (skipping || !line || line === word) continue;
    // 「〇〇 も参照」や、見出し語だけの行（例：nought (plural noughts)）は候補にしない
    if (/も参照。?$|^See also/i.test(line)) continue;
    if (site !== 'enwiki' && line.toLowerCase().startsWith(`${word.toLowerCase()} (`)) continue;
    const items = site === 'enwiki' ? splitEnglish(line) : line.length >= 3 && line.length <= 260 ? [line] : [];
    for (const it of items) if (!current.items.includes(it)) current.items.push(it);
  }
  flush();
  return sections;
}

export async function fetchOtherSource(site: OtherSite, title: string, signal?: AbortSignal): Promise<OtherResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'error', message: 'ネットにつながっていません' };
  const host = OTHER_SITES[site].host;
  // 英語版ウィクショナリーの見出し語は小文字が基本なので、そのままの形と小文字の両方を試す
  const candidates = site === 'enwikt' && title !== title.toLowerCase() ? [title, title.toLowerCase()] : [title];
  try {
    for (const t of candidates) {
      const params = new URLSearchParams({
        action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'wiki', redirects: '1',
        titles: t, format: 'json', formatversion: '2', origin: '*',
      });
      if (site === 'enwiki') params.set('exintro', '1');
      const res = await fetch(`https://${host}/w/api.php?${params}`, { signal });
      if (!res.ok) return { status: 'error', message: `${OTHER_SITES[site].short}から読み込めませんでした（${res.status}）` };
      const d = await res.json();
      const page = d?.query?.pages?.[0] as { title?: string; extract?: string; missing?: boolean } | undefined;
      if (!page || page.missing || !page.extract) continue;
      const pageTitle = page.title ?? t;
      const sections = parseSections(page.extract, site, pageTitle);
      if (!sections.length) continue;
      return { status: 'ok', site, title: pageTitle, url: `https://${host}/wiki/${encodeURIComponent(pageTitle)}`, sections };
    }
    return { status: 'notfound' };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return { status: 'error', message: `${OTHER_SITES[site].short}に接続できませんでした` };
  }
}
