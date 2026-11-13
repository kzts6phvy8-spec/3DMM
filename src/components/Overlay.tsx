// 画面上部のバー、モード説明、エラー表示、3Dが使えないときの一覧表示
import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearError, useCosmos } from '../store/useCosmos';
import { categoryColor } from '../lib/util';
import { searchNodes } from '../lib/search';
import { displayName } from '../lib/knowledge';

export function TopBar({ onAdd }: { onAdd: () => void }) {
  const nodeCount = useCosmos((s) => s.nodes.filter((n) => n.status === 'known').length);
  const relCount = useCosmos((s) => s.relations.length);
  const unknownCount = useCosmos((s) => s.nodes.filter((n) => n.status === 'unknown').length);
  return (
    <header className="topbar">
      <div>
        <h1>Knowledge Cosmos</h1>
        <p className="muted">{nodeCount}個の星・{relCount}本のつながり{unknownCount > 0 && `・まだ知らない星${unknownCount}`}</p>
      </div>
      <button className="primary add-btn" onClick={onAdd}>＋ 追加</button>
    </header>
  );
}

export function ModeBanner() {
  const mode = useCosmos((s) => s.mode);
  const nodes = useCosmos((s) => s.nodes);
  const connectFromId = useCosmos((s) => s.connectFromId);
  const connectFrom = nodes.find((n) => n.id === connectFromId);
  const setMode = useCosmos((s) => s.setMode);
  const tapNode = useCosmos((s) => s.tapNode);
  const [query, setQuery] = useState('');

  // モードが変わったら検索語を空に戻す
  useEffect(() => setQuery(''), [mode, connectFromId]);

  const candidates = useMemo(
    () => searchNodes(nodes.filter((n) => n.id !== connectFromId), query),
    [nodes, connectFromId, query],
  );

  if (mode === 'view') return null;
  const text =
    mode === 'move'
      ? '移動モード：星を指でドラッグして動かせます'
      : connectFrom
        ? `「${displayName(connectFrom)}」とつなぐ星を、タップか検索で選んでください`
        : 'つなぐ1つ目の星を、タップか検索で選んでください';
  return (
    <div className={`mode-banner${mode === 'connect' ? ' is-top' : ''}`}>
      <div className="mode-banner-row">
        <span>{text}</span>
        <button className="primary" onClick={() => setMode('view')}>{mode === 'move' ? '完了' : 'やめる'}</button>
      </div>
      {mode === 'connect' && (
        // 星が増えても選べるように、名前で検索できるようにする（画面外の星も選べる）
        <div className="connect-search">
          <input
            type="search"
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="星を検索（名前・タグ・説明）"
            aria-label="つなぐ星を検索"
            enterKeyHint="search"
          />
          {query && (
            <ul className="search-results">
              {candidates.length === 0 && <li className="muted empty">見つかりませんでした</li>}
              {candidates.map((n) => (
                <li key={n.id}>
                  <button onClick={() => tapNode(n.id)}>
                    <span className="dot" style={{ background: categoryColor(n.category) }} />
                    <span className="result-title">{displayName(n)}{n.status === 'unknown' && <span className="muted">（まだ知らない星）</span>}</span>
                    {n.category && <span className="muted result-cat">{n.category}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ErrorToast() {
  const error = useCosmos((s) => s.error);
  if (!error) return null;
  return (
    <div className="toast" role="alert">
      <span>{error}</span>
      <button className="icon-btn small" onClick={clearError} aria-label="閉じる">×</button>
    </div>
  );
}

/** 削除の直後に数秒だけ出る「元に戻す」 */
export function UndoToast() {
  const undo = useCosmos((s) => s.undo);
  const undoLast = useCosmos((s) => s.undoLast);
  const [, force] = useState(0);
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => {
      useCosmos.setState((s) => (s.undo === undo ? { undo: null } : {}));
      force((x) => x + 1);
    }, Math.max(0, undo.expiresAt - Date.now()));
    return () => window.clearTimeout(t);
  }, [undo]);
  if (!undo) return null;
  return (
    <div className="undo-toast" role="status">
      <span>{undo.label}</span>
      <button className="primary" onClick={undoLast}>元に戻す</button>
    </div>
  );
}

/** 3D描画が使えない場合でも知識を見られるようにする一覧 */
export function NodeList() {
  const nodes = useCosmos((s) => s.nodes);
  const select = useCosmos((s) => s.select);
  return (
    <div className="fallback-list">
      <p className="muted">3D表示を開始できなかったため、一覧で表示しています。</p>
      <ul>
        {nodes.map((n) => (
          <li key={n.id}>
            <button onClick={() => select(n.id)}>
              <span className="dot" style={{ background: categoryColor(n.category) }} />
              {displayName(n)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('3D表示でエラーが発生しました', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
