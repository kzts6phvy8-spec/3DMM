// 星をタップしたときに画面下から出る詳細パネル（ボトムシート）
import { useMemo } from 'react';
import { useCosmos } from '../store/useCosmos';
import { RELATION_TYPES } from '../types';
import { RELATION_COLORS, categoryColor, formatDate } from '../lib/util';

export function NodeSheet({ onEdit }: { onEdit: (id: string) => void }) {
  const selectedId = useCosmos((s) => s.selectedId);
  const mode = useCosmos((s) => s.mode);
  const nodes = useCosmos((s) => s.nodes);
  const relations = useCosmos((s) => s.relations);
  const { select, setMode, focusOn, deleteNode, deleteRelation } = useCosmos.getState();

  const node = nodes.find((n) => n.id === selectedId);
  const related = useMemo(() => {
    if (!node) return [];
    return relations
      .filter((r) => r.sourceNodeId === node.id || r.targetNodeId === node.id)
      .map((r) => {
        const otherId = r.sourceNodeId === node.id ? r.targetNodeId : r.sourceNodeId;
        return { relation: r, other: nodes.find((n) => n.id === otherId), outgoing: r.sourceNodeId === node.id };
      });
  }, [node, nodes, relations]);

  if (!node || mode !== 'view') return null;

  const handleDelete = () => {
    const msg = related.length
      ? `「${node.title}」を削除しますか？\nつながっている線（${related.length}本）も一緒に削除されます。`
      : `「${node.title}」を削除しますか？`;
    if (window.confirm(msg)) deleteNode(node.id);
  };

  return (
    <section className="sheet" aria-label="知識の詳細">
      <div className="sheet-handle" />
      <header className="sheet-header">
        <span className="dot" style={{ background: categoryColor(node.category) }} />
        <h2>{node.title}</h2>
        <button className="icon-btn" onClick={() => select(null)} aria-label="閉じる">×</button>
      </header>

      <div className="sheet-actions">
        <button onClick={() => focusOn(node.id)}>◎ 焦点</button>
        <button onClick={() => setMode('move')}>✥ 動かす</button>
        <button onClick={() => setMode('connect')}>⟷ つなぐ</button>
        <button onClick={() => onEdit(node.id)}>✎ 編集</button>
        <button className="danger" onClick={handleDelete}>削除</button>
      </div>

      <div className="sheet-body">
        {node.description ? <p className="description">{node.description}</p> : <p className="muted">説明はまだありません</p>}

        <dl className="meta">
          {node.category && (<><dt>カテゴリー</dt><dd>{node.category}</dd></>)}
          {node.tags.length > 0 && (
            <><dt>タグ</dt><dd>{node.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</dd></>
          )}
          {node.sourceUrl && (
            <><dt>出典</dt><dd><a href={node.sourceUrl} target="_blank" rel="noreferrer">{node.sourceUrl}</a></dd></>
          )}
          <dt>重要度</dt><dd>{'★'.repeat(node.importance)}{'☆'.repeat(5 - node.importance)}</dd>
          <dt>登録</dt><dd>{formatDate(node.createdAt)}</dd>
        </dl>

        <h3>関連する知識（{related.length}）</h3>
        {related.length === 0 && <p className="muted">まだつながりがありません。「⟷ つなぐ」で他の星と結べます。</p>}
        <ul className="related">
          {related.map(({ relation, other, outgoing }) => (
            <li key={relation.id}>
              <button
                className="related-main"
                onClick={() => {
                  if (!other) return;
                  select(other.id);
                  focusOn(other.id);
                }}
              >
                <span className="badge" style={{ borderColor: RELATION_COLORS[relation.relationType], color: RELATION_COLORS[relation.relationType] }}>
                  {RELATION_TYPES[relation.relationType]}
                </span>
                <span className="related-title">{outgoing ? '→ ' : '← '}{other?.title ?? '（不明）'}</span>
                {relation.explanation && <span className="related-expl">{relation.explanation}</span>}
              </button>
              <button
                className="icon-btn small"
                aria-label="このつながりを削除"
                onClick={() => {
                  if (window.confirm(`「${other?.title}」とのつながりを削除しますか？`)) deleteRelation(relation.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
