// 今月の発見レポート（アイデア⑪）。宇宙がその月にどう育ったかを振り返る。
import { useMemo, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { availableMonths, buildMonthlyReport, monthLabel } from '../lib/report';
import { categoryColor } from '../lib/util';
import { displayName } from '../lib/knowledge';
import { PanelFrame, openStar } from './Panels';

const SHOW = 12;

export function ReportPanel() {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const relations = useCosmos((s) => s.relations);
  const engagement = useCosmos((s) => s.engagement);
  const data = useMemo(() => ({ nodes, statements, relations, engagement }), [nodes, statements, relations, engagement]);
  const months = useMemo(() => availableMonths(data), [data]);
  const [index, setIndex] = useState(0);
  const month = months[Math.min(index, months.length - 1)];
  const r = useMemo(() => buildMonthlyReport(month, data), [month, data]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [showAllStars, setShowAllStars] = useState(false);

  const grown = r.starsAfter - r.starsBefore;
  const nothing = r.newStars.length === 0 && r.newStatements === 0 && r.newRelations.length === 0 && r.viewedStars === 0;

  return (
    <PanelFrame title="今月の発見">
      <div className="report-month">
        <button className="small-btn" aria-label="前の月" disabled={index >= months.length - 1} onClick={() => { setIndex(index + 1); setShowAllStars(false); }}>◀</button>
        <strong>{monthLabel(month)}</strong>
        <button className="small-btn" aria-label="次の月" disabled={index === 0} onClick={() => { setIndex(index - 1); setShowAllStars(false); }}>▶</button>
      </div>

      <div className="report-growth" aria-label="宇宙の成長">
        <span className="report-big">{r.starsBefore.toLocaleString()} → {r.starsAfter.toLocaleString()}</span>
        <span className="muted small">星の数{grown > 0 ? `（+${grown.toLocaleString()}）` : ''}</span>
      </div>

      <dl className="report-stats">
        <div><dt>加えた星</dt><dd>{r.newStars.length}</dd></div>
        <div><dt>加えた記述</dt><dd>{r.newStatements}</dd></div>
        <div><dt>結んだつながり</dt><dd>{r.newRelations.length}</dd></div>
        <div><dt>開いた星</dt><dd>{r.viewedStars}</dd></div>
      </dl>
      {r.viewedCategories > 0 && <p className="muted small">開いた星は {r.viewedCategories}つの分野にまたがっています。</p>}

      {nothing && <p className="muted">この月の記録はまだありません。星を開いたり、記述を加えたりすると、ここに表れます。</p>}

      {r.newCategoryPairs.length > 0 && (
        <>
          <h3>新しくつながった分野（{r.newCategoryPairs.length}）</h3>
          <ul className="report-pairs">
            {r.newCategoryPairs.map((p) => (
              <li key={`${p.a}|${p.b}`}>
                <span className="report-cat" style={{ color: categoryColor(p.a) }}>{p.a}</span>
                <span className="muted"> × </span>
                <span className="report-cat" style={{ color: categoryColor(p.b) }}>{p.b}</span>
                <span className="muted small">　{p.via[0]} — {p.via[1]}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {r.newStars.length > 0 && (
        <>
          <h3>加えた星（{r.newStars.length}）</h3>
          <ul className="report-chips">
            {(showAllStars ? r.newStars : r.newStars.slice(0, SHOW)).map((n) => (
              <li key={n.id}>
                <button className="chip small" onClick={() => openStar(n.id)}>
                  <span className="dot" style={{ background: categoryColor(n.category) }} />
                  {displayName(n)}
                </button>
              </li>
            ))}
          </ul>
          {!showAllStars && r.newStars.length > SHOW && (
            <button className="small-btn ghost" onClick={() => setShowAllStars(true)}>すべて見る（ほか{r.newStars.length - SHOW}個）</button>
          )}
        </>
      )}

      {r.newRelations.length > 0 && (
        <>
          <h3>結んだつながり</h3>
          <ul className="panel-list">
            {r.newRelations.slice(0, SHOW).map((rel) => {
              const a = byId.get(rel.sourceNodeId);
              const b = byId.get(rel.targetNodeId);
              return (
                <li key={rel.id}>
                  <button className="panel-item" onClick={() => a && openStar(a.id, true)}>
                    <span className="panel-item-main">
                      <span className="panel-item-title">{a ? displayName(a) : '？'} ⟷ {b ? displayName(b) : '？'}</span>
                      {rel.explanation && <span className="panel-item-sub">{rel.explanation}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {r.newRelations.length > SHOW && <p className="muted small">ほか{r.newRelations.length - SHOW}本</p>}
        </>
      )}

      {r.topViewed.length > 0 && (
        <>
          <h3>よく開いた星</h3>
          <ol className="report-top">
            {r.topViewed.map(({ node, count }) => (
              <li key={node.id}>
                <button className="link-like" onClick={() => openStar(node.id)}>{displayName(node)}</button>
                <span className="muted small">　{count}回</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="muted small report-note">今あるデータから数えています（消した星や記述は含みません）。初期セットは、最初からあったものとして数えます。</p>
    </PanelFrame>
  );
}
