// 「🔭 AIで調べる」：言葉をAIにWeb検索してもらい、その星と、そこから枝分かれする言葉の星をつなぐ。
// 枝の言葉がすでに宇宙にあればその星につなぎ、なければ「まだ知らない星」として置く。
// 枝の星を開いて、もう一度押すと、そこからまた枝が伸びる。
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useCosmos } from '../store/useCosmos';
import { aiQuota, aiSearch, searchEntryPoints, type AiQuota, type AiSearchOutcome } from '../ai/search';
import { spawnPosition, viewBasis } from '../lib/sceneApi';
import { openStar } from './Panels';
import { track } from '../lib/analytics';

// 今月の回数（どのボタンからも同じものを見る）。アプリを開いて最初に1回だけ読み、調べるたびに更新する
let quotaNow: AiQuota | null = null;
let quotaLoaded = false;
const listeners = new Set<() => void>();
function setQuota(q: AiQuota | null) {
  quotaNow = q;
  listeners.forEach((l) => l());
}
function useQuota() {
  const q = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => quotaNow,
  );
  useEffect(() => {
    if (quotaLoaded) return;
    quotaLoaded = true;
    void aiQuota().then((x) => x && setQuota(x));
  }, []);
  return q;
}

export function AiSearchButton({ query, targetId, primary }: { query: string; targetId: string | null; primary?: boolean }) {
  const applyAiSearch = useCosmos((s) => s.applyAiSearch);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const quota = useQuota();
  const left = quota ? Math.max(0, quota.limit - quota.used) : null;

  const run = async () => {
    setLoading(true);
    setMessage(null);
    const outcome = await aiSearch(query).catch((): AiSearchOutcome => ({ ok: false, code: 'network', message: 'AIにつながりませんでした。' }));
    setLoading(false);
    if (outcome.quota) setQuota(outcome.quota);
    track(outcome.ok ? 'ai_search_done' : 'ai_search_failed', outcome.ok ? { from: targetId ? 'star' : 'search' } : { code: outcome.code });
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
      {left !== null && <p className="muted small">今月あと{left}回（{quota!.limit === 300 ? '有料プラン' : '無料'}：月{quota!.limit}回まで）</p>}
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
