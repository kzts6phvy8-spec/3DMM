// 星のページで、Wikipediaの記事本文から「記述の候補」を出す。
// 押したときだけ読み込む（Wikipediaに負担をかけないため）。追加する文は利用者が選ぶ。
import { useEffect, useMemo, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import type { KnowledgeNode } from '../types';
import { applyMarks, fetchWikiArticle, fetchWikiLinkTitles, type WikiArticleResult } from '../lib/wikipedia';
import { LinkableSentence } from './LinkableSentence';
import { useTermsFor } from './useTerms';
import { plainText } from '../lib/knowledge';
import { normalize } from '../lib/search';

export function WikiStatementSuggestions({ star }: { star: KnowledgeNode }) {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const registerFromWikipedia = useCosmos((s) => s.registerFromWikipedia);
  const [result, setResult] = useState<WikiArticleResult | 'idle' | 'loading'>('idle');
  const [openSection, setOpenSection] = useState<number>(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<string | null>(null);
  const [wikiLinks, setWikiLinks] = useState<string[]>([]);
  const [marks, setMarks] = useState<Map<string, Set<string>>>(new Map());

  // 別の星に移ったら、候補の表示をはじめに戻す
  useEffect(() => {
    setResult('idle');
    setPicked(new Set());
    setMarks(new Map());
    setDone(null);
  }, [star.id]);

  const allSentences = useMemo(
    () => (typeof result === 'object' && result.status === 'ok' ? result.sections.flatMap((s) => s.sentences) : []),
    [result],
  );
  const { terms, blockers } = useTermsFor(allSentences, wikiLinks, star.id);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  // すでにこの星にある文は候補から外す
  const existing = useMemo(
    () => new Set(statements.filter((s) => s.starId === star.id).map((s) => normalize(plainText(s.text, byId)))),
    [statements, star.id, byId],
  );

  const load = async () => {
    setResult('loading');
    setDone(null);
    const [r, links] = await Promise.all([fetchWikiArticle(star.title), fetchWikiLinkTitles(star.title)]);
    setWikiLinks(links);
    setMarks(new Map());
    setResult(r);
    setOpenSection(0);
  };

  if (result === 'idle') {
    return (
      <div className="wiki-suggest">
        <button className="small-btn" onClick={load}>📖 Wikipediaから記述の候補を探す</button>
        {done && <p className="more-message">{done}</p>}
      </div>
    );
  }
  if (result === 'loading') return <div className="wiki-box muted">Wikipediaの記事を読み込み中…</div>;
  if (result.status !== 'ok') {
    return (
      <div className="wiki-box">
        <p className="muted">{result.status === 'notfound' ? `Wikipediaに「${star.title}」の記事は見つかりませんでした。` : result.message}</p>
        <button className="small-btn" onClick={() => setResult('idle')}>閉じる</button>
      </div>
    );
  }

  const sections = result.sections
    .map((sec) => ({ ...sec, sentences: sec.sentences.filter((t) => !existing.has(normalize(t))) }))
    .filter((sec) => sec.sentences.length > 0);
  const key = (si: number, t: string) => `${si}|${t}`;
  const chosen = sections.flatMap((sec, si) =>
    sec.sentences
      .filter((t) => picked.has(key(si, t)))
      .map((t) => ({ text: applyMarks(t, terms, marks.get(key(si, t)) ?? new Set(), blockers), topic: sec.topic })),
  );
  const toggleMark = (k: string, term: string) => {
    const next = new Map(marks);
    const set = new Set(next.get(k) ?? []);
    if (set.has(term)) set.delete(term);
    else set.add(term);
    next.set(k, set);
    setMarks(next);
    if (set.size && !picked.has(k)) setPicked(new Set([...picked, k]));
  };

  return (
    <div className="wiki-box">
      <div className="wiki-head">
        <strong>Wikipedia「{result.title}」より</strong>
        <a className="small" href={result.url} target="_blank" rel="noreferrer">記事を開く</a>
      </div>
      <p className="muted small">追加したい文を選んでください。出典は自動で付きます（状態は「出典あり」。確認はあなたが行います）。</p>
      {terms.length > 0 && <p className="muted small">点線の言葉を押すと、その言葉も星になります（まだ知らない星として宇宙に現れます）。</p>}
      {sections.length === 0 && <p className="muted">新しい候補はありません。</p>}
      <ul className="wiki-sections">
        {sections.map((sec, si) => (
          <li key={sec.title + si}>
            <button className="wiki-section-head" aria-expanded={openSection === si} onClick={() => setOpenSection(openSection === si ? -1 : si)}>
              <span>{sec.title}</span>
              {sec.topic && sec.topic !== sec.title && <span className="badge topic">{sec.topic === '雑学' ? '✦ 雑学' : sec.topic}</span>}
              <span className="muted small">{sec.sentences.length}文 {openSection === si ? '▴' : '▾'}</span>
            </button>
            {openSection === si && (
              <ul className="wiki-sentences">
                {sec.sentences.map((t) => (
                  <li key={t}>
                    <label className="wiki-sentence">
                      <input
                        type="checkbox"
                        checked={picked.has(key(si, t))}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(key(si, t));
                          else next.delete(key(si, t));
                          setPicked(next);
                        }}
                      />
                      <LinkableSentence text={t} terms={terms} blockers={blockers} marked={marks.get(key(si, t)) ?? new Set()} onToggle={(term) => toggleMark(key(si, t), term)} />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <div className="check-actions wiki-actions">
        <button
          className="primary"
          disabled={chosen.length === 0}
          onClick={() => {
            registerFromWikipedia(star.id, { summary: '', sentences: chosen, articleTitle: result.title, url: result.url });
            setPicked(new Set());
            setResult('idle');
            setDone(`${chosen.length}文を記述に追加しました。`);
          }}
        >
          選んだ{chosen.length}文を追加
        </button>
        <button className="small-btn" onClick={() => setResult('idle')}>閉じる</button>
      </div>
      <p className="muted small license">文章：Wikipedia（CC BY-SA 4.0）。読み仮名などの（ ）は省いています。</p>
    </div>
  );
}
