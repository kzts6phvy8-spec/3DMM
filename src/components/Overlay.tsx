// 画面上部のバー、モード説明、エラー表示、3Dが使えないときの一覧表示
import { Component, type ReactNode } from 'react';
import { clearError, useCosmos } from '../store/useCosmos';
import { categoryColor } from '../lib/util';

export function TopBar({ onAdd }: { onAdd: () => void }) {
  const nodeCount = useCosmos((s) => s.nodes.length);
  const relCount = useCosmos((s) => s.relations.length);
  return (
    <header className="topbar">
      <div>
        <h1>Knowledge Cosmos</h1>
        <p className="muted">{nodeCount}個の星・{relCount}本のつながり</p>
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
  if (mode === 'view') return null;
  const text =
    mode === 'move'
      ? '移動モード：星を指でドラッグして動かせます'
      : connectFrom
        ? `「${connectFrom.title}」とつなぐ星をタップしてください`
        : 'つなぐ1つ目の星をタップしてください';
  return (
    <div className="mode-banner">
      <div className="mode-banner-row">
        <span>{text}</span>
        <button className="primary" onClick={() => setMode('view')}>{mode === 'move' ? '完了' : 'やめる'}</button>
      </div>
      {mode === 'connect' && (
        // 画面外の星も選べるように、一覧からも選択できるようにする
        <select
          className="node-picker"
          value=""
          onChange={(e) => e.target.value && tapNode(e.target.value)}
          aria-label="一覧から星を選ぶ"
        >
          <option value="">一覧から選ぶ…</option>
          {nodes
            .filter((n) => n.id !== connectFromId)
            .map((n) => (
              <option key={n.id} value={n.id}>{n.title}</option>
            ))}
        </select>
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
              {n.title}
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
