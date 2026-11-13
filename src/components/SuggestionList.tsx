// 星のページに出す「つながりの候補」。押すと関係の種類と理由を入力する画面になる（確定は利用者）。
import { useEffect, useMemo, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import type { KnowledgeNode } from '../types';
import { displayName } from '../lib/knowledge';
import { suggestConnections, suggestFromWikipedia, type Suggestion } from '../lib/suggest';
import { categoryColor } from '../lib/util';

export function SuggestionList({ star }: { star: KnowledgeNode }) {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const relations = useCosmos((s) => s.relations);
  const navigate = useCosmos((s) => s.navigate);
  const [wiki, setWiki] = useState<Suggestion[] | 'loading' | 'error'>('loading');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const local = useMemo(() => suggestConnections(star, nodes, statements, relations), [star, nodes, statements, relations]);

  useEffect(() => {
    const ctrl = new AbortController();
    setWiki('loading');
    suggestFromWikipedia(star, nodes, statements, relations, ctrl.signal)
      .then(setWiki)
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setWiki('error');
      });
    return () => ctrl.abort();
    // 記事の取り直しは星が変わったときだけ（毎回の編集では取り直さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [star.id, star.wikiTitle]);

  // 2つの手がかりをまとめる（同じ星は理由を合わせる）
  const merged = useMemo(() => {
    const map = new Map<string, Suggestion>();
    for (const s of [...(Array.isArray(wiki) ? wiki : []), ...local]) {
      const prev = map.get(s.starId);
      if (prev) map.set(s.starId, { ...prev, score: prev.score + s.score, reasons: [...prev.reasons, ...s.reasons].slice(0, 3) });
      else map.set(s.starId, { ...s, reasons: [...s.reasons] });
    }
    return [...map.values()].filter((s) => !dismissed.has(s.starId)).sort((a, b) => b.score - a.score).slice(0, 6);
  }, [wiki, local, dismissed]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className="suggestions">
      <h3>つながりの候補</h3>
      <p className="muted small">登録した知識とWikipediaから見つけた候補です。つなぐかどうかは、あなたが決めます。</p>
      {merged.length === 0 && (
        <p className="muted small">
          {wiki === 'loading' ? '候補を探しています…' : '今のところ候補はありません。記述を書き足すと見つかりやすくなります。'}
        </p>
      )}
      <ul className="suggestion-list">
        {merged.map((s) => {
          const n = byId.get(s.starId);
          if (!n) return null;
          return (
            <li key={s.starId}>
              <button className="link-like suggestion-name" onClick={() => navigate(n.id)}>
                <span className="dot" style={{ background: categoryColor(n.category) }} />
                {displayName(n)}
              </button>
              <ul className="reasons">
                {s.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <div className="check-actions">
                <button
                  className="small-btn primary"
                  onClick={() => useCosmos.setState({ pendingConnection: { sourceId: star.id, targetId: n.id } })}
                >
                  ⟷ つなぐ
                </button>
                <button className="small-btn" onClick={() => setDismissed(new Set([...dismissed, s.starId]))}>今はいい</button>
              </div>
            </li>
          );
        })}
      </ul>
      {wiki === 'error' && <p className="muted small">Wikipediaからの候補は取れませんでした（オフラインなど）。</p>}
    </div>
  );
}
