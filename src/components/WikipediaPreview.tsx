// まだ知らない星を開いたときに、Wikipediaの概要をその場で表示する（要件 F9）。
// 登録する文はユーザーが選ぶ。自動では登録しない。
import { useEffect, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { fetchWikiSummary, splitSentences, type WikiResult } from '../lib/wikipedia';

export function WikipediaPreview({ starId, title }: { starId: string; title: string }) {
  const registerFromWikipedia = useCosmos((s) => s.registerFromWikipedia);
  const [result, setResult] = useState<WikiResult | 'loading'>('loading');
  const [picked, setPicked] = useState<boolean[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    setResult('loading');
    fetchWikiSummary(title, ctrl.signal)
      .then((r) => {
        setResult(r);
        if (r.status === 'ok') setPicked(splitSentences(r.extract).map((_, i) => i < 3));
      })
      .catch(() => {
        /* 画面を閉じたときの中断は無視する */
      });
    return () => ctrl.abort();
  }, [title]);

  if (result === 'loading') return <div className="wiki-box muted">Wikipediaを読み込み中…</div>;
  if (result.status === 'notfound') return <div className="wiki-box muted">Wikipediaに「{title}」の記事は見つかりませんでした。</div>;
  if (result.status === 'error') return <div className="wiki-box muted">{result.message}。下の「調べる」から探せます。</div>;
  if (result.status === 'disambiguation') {
    return (
      <div className="wiki-box">
        <p className="muted">「{title}」は複数の意味を持つ言葉です（曖昧さ回避ページ）。</p>
        <a href={result.url} target="_blank" rel="noreferrer">Wikipediaで意味の一覧を見る</a>
      </div>
    );
  }

  const sentences = splitSentences(result.extract);
  const chosen = sentences.filter((_, i) => picked[i]);
  return (
    <div className="wiki-box">
      <div className="wiki-head">
        <strong>Wikipediaより</strong>
        {result.description && <span className="muted small">{result.description}</span>}
      </div>
      <p className="muted small">登録する文を選んでください。出典は自動で付きます（状態は「出典あり」。確認はあなたが行います）。</p>
      <ul className="wiki-sentences">
        {sentences.map((s, i) => (
          <li key={i}>
            <label className="wiki-sentence">
              <input
                type="checkbox"
                checked={!!picked[i]}
                onChange={(e) => setPicked(picked.map((p, j) => (j === i ? e.target.checked : p)))}
              />
              <span>{s}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="check-actions">
        <button
          className="primary"
          disabled={chosen.length === 0}
          onClick={() =>
            registerFromWikipedia(starId, {
              summary: chosen[0] ?? '',
              sentences: chosen,
              articleTitle: result.title,
              url: result.url,
            })
          }
        >
          選んだ{chosen.length}文で登録
        </button>
        <a className="small" href={result.url} target="_blank" rel="noreferrer">記事を開く</a>
      </div>
      <p className="muted small license">文章：Wikipedia（CC BY-SA 4.0）。読み仮名などの（ ）は省いています。</p>
    </div>
  );
}
