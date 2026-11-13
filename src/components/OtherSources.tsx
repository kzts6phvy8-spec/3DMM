// 「ほかの辞書で探す」：英語版Wikipedia・ウィクショナリーから、記述の候補を選んで追加する。
// 日本語版Wikipediaに載っていない言葉や、語源を知りたいときに使う（AIは使わない）。
import { useMemo, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import type { KnowledgeNode } from '../types';
import { cleanTitle } from '../lib/wikipedia';
import { OTHER_SITES, fetchOtherSource, type OtherResult, type OtherSite } from '../lib/otherSources';
import { plainText } from '../lib/knowledge';
import { normalize } from '../lib/search';

export function OtherSources({ star, compact = false }: { star: KnowledgeNode; compact?: boolean }) {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const registerFromWikipedia = useCosmos((s) => s.registerFromWikipedia);
  // 英字の別名があれば、それを最初の検索語にする（例：ノート → nought）
  const latinAlias = star.aliases.find((a) => /^[A-Za-z][A-Za-z\s'-]*$/.test(a));
  const [open, setOpen] = useState(!compact);
  const [query, setQuery] = useState(latinAlias ?? cleanTitle(star.title));
  const [result, setResult] = useState<OtherResult | 'loading' | null>(null);
  const [openSection, setOpenSection] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<string | null>(null);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const existing = useMemo(
    () => new Set(statements.filter((s) => s.starId === star.id).map((s) => normalize(plainText(s.text, byId)))),
    [statements, star.id, byId],
  );

  const search = async (site: OtherSite) => {
    if (!query.trim()) return;
    setResult('loading');
    setPicked(new Set());
    setDone(null);
    setResult(await fetchOtherSource(site, query.trim()));
    setOpenSection(0);
  };

  if (!open) {
    return (
      <div className="wiki-suggest">
        <button className="small-btn" onClick={() => setOpen(true)}>📚 ほかの辞書で探す（英語版Wikipedia・ウィクショナリー）</button>
      </div>
    );
  }

  const sections =
    result && result !== 'loading' && result.status === 'ok'
      ? result.sections.map((sec) => ({ ...sec, items: sec.items.filter((t) => !existing.has(normalize(t))) })).filter((sec) => sec.items.length)
      : [];
  const key = (si: number, t: string) => `${si}|${t}`;
  const chosen = sections.flatMap((sec, si) => sec.items.filter((t) => picked.has(key(si, t))).map((t) => ({ text: t, topic: sec.topic })));

  return (
    <div className="wiki-box">
      <div className="wiki-head">
        <strong>📚 ほかの辞書で探す</strong>
        {compact && <button className="small-btn ghost" onClick={() => setOpen(false)}>閉じる</button>}
      </div>
      <p className="muted small">英語の言葉は英語で入れると見つかりやすくなります（例：ノート → nought）。</p>
      <input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="探す言葉" aria-label="ほかの辞書で探す言葉" />
      <div className="check-actions">
        {(Object.keys(OTHER_SITES) as OtherSite[]).map((site) => (
          <button key={site} className="small-btn" disabled={result === 'loading'} onClick={() => search(site)}>
            {OTHER_SITES[site].short}
          </button>
        ))}
      </div>
      {result === 'loading' && <p className="muted small">探しています…</p>}
      {result && result !== 'loading' && result.status === 'notfound' && <p className="muted small">見つかりませんでした。別の言葉や、別の辞書で試してください。</p>}
      {result && result !== 'loading' && result.status === 'error' && <p className="muted small">{result.message}</p>}
      {done && <p className="more-message">{done}</p>}
      {result && result !== 'loading' && result.status === 'ok' && (
        <>
          <div className="wiki-head">
            <span className="small">{OTHER_SITES[result.site].label}「{result.title}」</span>
            <a className="small" href={result.url} target="_blank" rel="noreferrer">ページを開く</a>
          </div>
          {sections.length === 0 && <p className="muted small">新しい候補はありません。</p>}
          <ul className="wiki-sections">
            {sections.map((sec, si) => (
              <li key={sec.title + si}>
                <button className="wiki-section-head" aria-expanded={openSection === si} onClick={() => setOpenSection(openSection === si ? -1 : si)}>
                  <span>{sec.title}</span>
                  {sec.topic && <span className="badge topic">{sec.topic}</span>}
                  <span className="muted small">{sec.items.length}件 {openSection === si ? '▴' : '▾'}</span>
                </button>
                {openSection === si && (
                  <ul className="wiki-sentences">
                    {sec.items.map((t) => (
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
                          <span>{t}</span>
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
                registerFromWikipedia(star.id, {
                  summary: star.summary ? '' : chosen[0]?.text ?? '',
                  sentences: chosen,
                  articleTitle: result.title,
                  url: result.url,
                  sourceTitle: `${OTHER_SITES[result.site].label}：${result.title}`,
                });
                setPicked(new Set());
                setDone(`${chosen.length}件を記述に追加しました。`);
              }}
            >
              選んだ{chosen.length}件を追加
            </button>
          </div>
          <p className="muted small license">文章：{OTHER_SITES[result.site].label}（CC BY-SA 4.0）。出典は自動で付きます。</p>
        </>
      )}
    </div>
  );
}
