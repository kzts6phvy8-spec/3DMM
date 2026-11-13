// 「🌱 広げる」：この星のWikipedia記事に出てくる言葉を、まだ知らない星として周りに生やす。
// 押すたびに次の言葉が生える。興味のあるところから、宇宙をどこまでも広げられる。
import { useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import type { KnowledgeNode } from '../types';
import { cleanTitle, fetchSeedCandidates } from '../lib/wikipedia';

const BATCH = 10;

export function SeedButton({ star }: { star: KnowledgeNode }) {
  const seedStars = useCosmos((s) => s.seedStars);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const grow = async () => {
    setState('loading');
    setMessage(null);
    const list = await fetchSeedCandidates(star.wikiTitle ?? cleanTitle(star.title)).catch(() => null);
    setState('idle');
    if (list === null) {
      setMessage('Wikipediaに接続できませんでした。');
      return;
    }
    const n = seedStars(star.id, list, BATCH);
    setMessage(n > 0 ? `${n}個の「まだ知らない星」が生まれました。もう一度押すと、さらに広がります。` : 'これ以上広げられる言葉はありません（記事が見つからない場合は、記事を選んでください）。');
  };

  return (
    <div className="wiki-suggest">
      <button className="small-btn" disabled={state === 'loading'} onClick={grow}>
        {state === 'loading' ? '🌱 広げています…' : '🌱 Wikipediaのリンクから広げる'}
      </button>
      {message && <p className="more-message">{message}</p>}
    </div>
  );
}
