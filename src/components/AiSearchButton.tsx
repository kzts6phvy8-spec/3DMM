// 「🔭 AIで調べる」：言葉をAIにWeb検索してもらい、その星と、そこから枝分かれする言葉の星をつなぐ。
// 枝の言葉がすでに宇宙にあればその星につなぎ、なければ「まだ知らない星」として置く。
// 枝の星を開いて、もう一度押すと、そこからまた枝が伸びる。
import { useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { aiSearch, searchEntryPoints } from '../ai/search';
import { spawnPosition, viewBasis } from '../lib/sceneApi';
import { openStar } from './Panels';

export function AiSearchButton({ query, targetId, primary }: { query: string; targetId: string | null; primary?: boolean }) {
  const applyAiSearch = useCosmos((s) => s.applyAiSearch);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const run = async () => {
    setLoading(true);
    setMessage(null);
    const outcome = await aiSearch(query).catch(() => ({ ok: false as const, code: 'network', message: 'AIにつながりませんでした。' }));
    setLoading(false);
    if (!outcome.ok) {
      setMessage({ text: outcome.message, error: true });
      return;
    }
    const { id, added, linked } = applyAiSearch(outcome.result, targetId, spawnPosition(), viewBasis());
    if (outcome.searchEntryPoint) searchEntryPoints.set(id, outcome.searchEntryPoint);
    const parts = [added && `新しい言葉${added}個`, linked && `宇宙にある星${linked}個`].filter(Boolean).join('・');
    // 開いている星の画面なら、そのまま枝が見えるように視点を合わせ直す。検索画面からなら、できた星を開く
    if (targetId) useCosmos.getState().focusOn(id);
    else openStar(id);
    setMessage({ text: parts ? `${parts}とつながりました。光っている星を押すと、そこへ移れます。` : '新しくつながる言葉はありませんでした。', error: false });
  };

  return (
    <div className="wiki-suggest">
      <button className={primary ? 'primary' : 'small-btn'} disabled={loading} onClick={run}>
        {loading ? '🔭 調べています…（30秒ほどかかります）' : `🔭「${query.length > 14 ? query.slice(0, 14) + '…' : query}」をAIで調べる`}
      </button>
      {message && <p className={`more-message${message.error ? ' is-error' : ''}`}>{message.text}</p>}
    </div>
  );
}

/** Google検索の候補（Geminiで調べたときだけ）。Googleの決まりで表示が必要とされている。アプリを開いている間だけ出す */
export function SearchEntry({ starId }: { starId: string }) {
  const entry = searchEntryPoints.get(starId);
  if (!entry) return null;
  // Googleから届いた表示用の部品。アプリの中身に触れられないよう、別の枠（sandbox）に閉じ込めて出す
  return <iframe className="search-entry" title="Google検索の候補" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={`<base target="_blank">${entry}`} />;
}
