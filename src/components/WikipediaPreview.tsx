// まだ知らない星を開いたときに、Wikipediaの概要をその場で表示する（要件 F9）。
// 登録する文はユーザーが選ぶ。自動では登録しない。
import { useEffect, useMemo, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { applyMarks, fetchWikiLinkTitles, fetchWikiSummary, splitSentences, type WikiResult } from '../lib/wikipedia';
import { LinkableSentence } from './LinkableSentence';
import { useTermsFor } from './useTerms';

export function WikipediaPreview({ starId, title }: { starId: string; title: string }) {
  const registerFromWikipedia = useCosmos((s) => s.registerFromWikipedia);
  const [result, setResult] = useState<WikiResult | 'loading'>('loading');
  const [picked, setPicked] = useState<boolean[]>([]);
  const [wikiLinks, setWikiLinks] = useState<string[]>([]);
  const [marks, setMarks] = useState<Map<number, Set<string>>>(new Map());

  useEffect(() => {
    const ctrl = new AbortController();
    setResult('loading');
    fetchWikiSummary(title, ctrl.signal)
      .then((r) => {
        setResult(r);
        if (r.status === 'ok') {
          setPicked(splitSentences(r.extract).map((_, i) => i < 3));
          fetchWikiLinkTitles(r.title, ctrl.signal).then(setWikiLinks).catch(() => {});
        }
      })
      .catch(() => {
        /* 画面を閉じたときの中断は無視する */
      });
    return () => ctrl.abort();
  }, [title]);

  const sentences = useMemo(() => (result !== 'loading' && result.status === 'ok' ? splitSentences(result.extract) : []), [result]);
  const { terms, blockers } = useTermsFor(sentences, wikiLinks, starId);

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

  const chosen = sentences
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => picked[i])
    .map(({ s, i }) => applyMarks(s, terms, marks.get(i) ?? new Set(), blockers));
  const toggleMark = (i: number, term: string) => {
    const next = new Map(marks);
    const set = new Set(next.get(i) ?? []);
    if (set.has(term)) set.delete(term);
    else set.add(term);
    next.set(i, set);
    setMarks(next);
    // 言葉に印を付けたら、その文も登録の対象にする
    if (set.size) setPicked(picked.map((p, j) => (j === i ? true : p)));
  };
  return (
    <div className="wiki-box">
      <div className="wiki-head">
        <strong>Wikipediaより</strong>
        {result.description && <span className="muted small">{result.description}</span>}
      </div>
      <p className="muted small">登録する文を選んでください。出典は自動で付きます（状態は「出典あり」。確認はあなたが行います）。</p>
      {terms.length > 0 && <p className="muted small">点線の言葉を押すと、その言葉も星になります（まだ知らない星として宇宙に現れます）。</p>}
      <ul className="wiki-sentences">
        {sentences.map((s, i) => (
          <li key={i}>
            <label className="wiki-sentence">
              <input
                type="checkbox"
                checked={!!picked[i]}
                onChange={(e) => setPicked(picked.map((p, j) => (j === i ? e.target.checked : p)))}
              />
              <LinkableSentence text={s} terms={terms} blockers={blockers} marked={marks.get(i) ?? new Set()} onToggle={(t) => toggleMark(i, t)} />
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
              summary: (chosen[0] ?? '').replace(/\[\[([^\]]+)\]\]/g, '$1'),
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
