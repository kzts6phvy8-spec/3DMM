// ファクトチェック用の外部検索。アプリは検索ページを開くだけで、検索エンジンは組み込まない。
export const SEARCH_SITES = [
  { key: 'google', label: 'Google', url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { key: 'wikipedia', label: 'Wikipedia', url: (q: string) => `https://ja.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
  { key: 'scholar', label: '論文', url: (q: string) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}` },
] as const;

export function openSearch(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
