// Wikipediaで記事が見つからない・あいまいなときに、検索で記事の候補を出して選んでもらう。
// 選んだ記事は星に覚えておき、次からはその記事を使う。
import { useEffect, useMemo, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import type { KnowledgeNode } from '../types';
import { cleanTitle, searchWikiCandidates, type WikiCandidate } from '../lib/wikipedia';
import { parseLinkIds } from '../lib/knowledge';
import { OtherSources } from './OtherSources';

/** 関係する星の名前（検索の手がかり）を最大2つ選ぶ */
function useContextNames(star: KnowledgeNode): string[] {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const relations = useCosmos((s) => s.relations);
  return useMemo(() => {
    const ids: string[] = [];
    for (const r of relations) {
      if (r.sourceNodeId === star.id) ids.push(r.targetNodeId);
      if (r.targetNodeId === star.id) ids.push(r.sourceNodeId);
    }
    for (const st of statements) {
      if (st.starId === star.id) ids.push(...parseLinkIds(st.text));
      else if (parseLinkIds(st.text).includes(star.id)) ids.push(st.starId);
    }
    const names = [...new Set(ids)]
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is KnowledgeNode => !!n && n.status === 'known' && n.id !== star.id)
      .map((n) => cleanTitle(n.title));
    return names.slice(0, 2);
  }, [nodes, statements, relations, star.id]);
}

export function WikiArticlePicker({ star, reason, onPicked }: { star: KnowledgeNode; reason: string; onPicked: (title: string) => void }) {
  const setWikiTitle = useCosmos((s) => s.setWikiTitle);
  const context = useContextNames(star);
  const [list, setList] = useState<WikiCandidate[] | 'loading'>('loading');

  useEffect(() => {
    const ctrl = new AbortController();
    setList('loading');
    searchWikiCandidates(star.title, context, ctrl.signal).then(setList).catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [star.id, star.title, context.join('|')]);

  return (
    <div className="wiki-box">
      <p className="muted small">{reason}</p>
      <p className="small">
        Wikipediaで「{cleanTitle(star.title)}{context.length ? ` ${context.join(' ')}` : ''}」を検索した候補です。合う記事を選んでください。
      </p>
      {list === 'loading' && <p className="muted small">探しています…</p>}
      {list !== 'loading' && list.length === 0 && (
        <p className="muted small">日本語版Wikipediaに候補が見つかりませんでした。下の「ほかの辞書」でも探せます。</p>
      )}
      {list !== 'loading' && (
        <ul className="panel-list">
          {list.map((c) => (
            <li key={c.title}>
              <button
                className="panel-item"
                onClick={() => {
                  setWikiTitle(star.id, c.title);
                  onPicked(c.title);
                }}
              >
                <span className="panel-item-main">
                  <span className="panel-item-title">{c.title}</span>
                  <span className="panel-item-sub">{c.snippet}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <OtherSources star={star} compact />
    </div>
  );
}
