// 毎日のつながりパズル（アイデア⑩）。スタートの星から、つながりをたどってゴールの星へ。
import { useEffect, useMemo, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { buildStarterGraph, dailyPuzzle, dateKey, shareText, shortestPath, type PuzzleProgress } from '../lib/puzzle';
import { categoryColor } from '../lib/util';
import { displayName } from '../lib/knowledge';
import { PanelFrame, openStar } from './Panels';

const STORE_KEY = 'cosmos-puzzle';

function loadProgress(): PuzzleProgress | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as PuzzleProgress) : null;
  } catch {
    return null;
  }
}

function saveProgress(p: PuzzleProgress) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    // 保存できなくても遊べるようにする（その日の途中経過が残らないだけ）
  }
}

export function PuzzlePanel() {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const relations = useCosmos((s) => s.relations);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const graph = useMemo(() => buildStarterGraph({ nodes, statements, relations }), [nodes, statements, relations]);
  const [today] = useState(() => dateKey(new Date()));
  const puzzle = useMemo(() => dailyPuzzle(today, graph, byId), [today, graph, byId]);

  const [progress, setProgress] = useState<PuzzleProgress | null>(() => {
    const saved = loadProgress();
    return saved && saved.date === today ? saved : null;
  });
  const [message, setMessage] = useState<string | null>(null);

  // 今日の問題と、保存されていた途中経過が合わないとき（初期セットが変わった等）は新しく始める
  const current: PuzzleProgress | null = useMemo(() => {
    if (!puzzle) return null;
    if (progress && progress.start === puzzle.start && progress.goal === puzzle.goal && progress.path.every((id) => graph.has(id))) return progress;
    return { date: puzzle.date, start: puzzle.start, goal: puzzle.goal, path: [puzzle.start], moves: 0, done: false, gaveUp: false };
  }, [puzzle, progress, graph]);

  const here = current ? current.path[current.path.length - 1] : null;

  // 宇宙の視点も、いまいる星へ動かす
  useEffect(() => {
    if (here) useCosmos.setState({ focus: { id: here, nonce: Date.now() } });
  }, [here]);

  if (!puzzle || !current || !here) {
    return (
      <PanelFrame title="つながりパズル">
        <p className="muted">今日の問題を作れませんでした。パズルは初期セットの星を使うので、「その他」→「初期セットを追加」をすると遊べます。</p>
      </PanelFrame>
    );
  }

  const update = (next: PuzzleProgress) => {
    setProgress(next);
    saveProgress(next);
  };
  const start = byId.get(puzzle.start)!;
  const goal = byId.get(puzzle.goal)!;
  const node = byId.get(here)!;
  const finished = current.done || current.gaveUp;
  const visited = new Set(current.path);
  const neighbors = [...(graph.get(here) ?? [])]
    .map((id) => byId.get(id)!)
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  const answer = current.gaveUp ? shortestPath(graph, puzzle.start, puzzle.goal) ?? [] : [];

  const move = (id: string) => {
    const path = [...current.path, id];
    update({ ...current, path, moves: current.moves + 1, done: id === puzzle.goal });
  };
  const back = () => {
    if (current.path.length < 2) return;
    update({ ...current, path: current.path.slice(0, -1), moves: current.moves + 1 });
  };
  const giveUp = () => {
    if (!window.confirm('ギブアップして答えを見ますか？（今日はもう挑戦できません）')) return;
    update({ ...current, gaveUp: true });
  };
  const share = async () => {
    const text = shareText(current, puzzle.par, start.title, goal.title);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMessage('結果をコピーしました。メッセージなどに貼り付けて送れます。');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // 共有シートを閉じただけ
      setMessage(`共有できませんでした。下の文を長押ししてコピーしてください。\n${text}`);
    }
  };

  const [y, m, d] = puzzle.date.split('-').map(Number);

  return (
    <PanelFrame title="つながりパズル">
      <p className="muted small">{y}年{m}月{d}日の問題。つながりをたどって、スタートの星からゴールの星へ。最短は{puzzle.par}手です。</p>

      <div className="puzzle-ends">
        <div className="puzzle-end">
          <span className="muted small">スタート</span>
          <strong>{displayName(start)}</strong>
        </div>
        <span className="puzzle-arrow">→</span>
        <div className="puzzle-end is-goal">
          <span className="muted small">ゴール</span>
          <strong>{displayName(goal)}</strong>
        </div>
      </div>
      {goal.summary && <p className="muted small">ゴール：{goal.summary}</p>}

      {!finished && (
        <>
          <div className="puzzle-here">
            <div className="puzzle-here-head">
              <span className="dot" style={{ background: categoryColor(node.category) }} />
              <strong>{displayName(node)}</strong>
              <span className="muted small">{current.moves}手</span>
            </div>
            {node.summary && <p className="small">{node.summary}</p>}
          </div>
          <h3>次に進む星（{neighbors.length}）</h3>
          <ul className="puzzle-next">
            {neighbors.map((n) => (
              <li key={n.id}>
                <button className="chip small" onClick={() => move(n.id)}>
                  <span className="dot" style={{ background: categoryColor(n.category) }} />
                  {displayName(n)}
                  {visited.has(n.id) && <span className="muted">（通った）</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="check-actions">
            <button className="small-btn" disabled={current.path.length < 2} onClick={back}>↩ 1手戻る</button>
            <button className="small-btn ghost" onClick={giveUp}>ギブアップ</button>
          </div>
          <p className="muted small">戻るのも1手と数えます。</p>
        </>
      )}

      {finished && (
        <div className="puzzle-result">
          {current.done ? (
            <p className="report-big">{current.moves === puzzle.par ? '最短でゴール！' : 'ゴール！'}</p>
          ) : (
            <p className="report-big">ギブアップ</p>
          )}
          <p>
            {current.done ? `${current.moves}手（最短${puzzle.par}手）` : `最短${puzzle.par}手の道のり`}
          </p>
          <ol className="puzzle-path">
            {(current.done ? current.path : answer).map((id, i) => {
              const n = byId.get(id);
              return (
                <li key={`${id}-${i}`}>
                  <button className="link-like" onClick={() => openStar(id, true)}>{n ? displayName(n) : '？'}</button>
                </li>
              );
            })}
          </ol>
          <div className="check-actions">
            <button className="primary" onClick={share}>結果をシェア</button>
          </div>
          {message && <p className="more-message puzzle-message">{message}</p>}
          <p className="muted small">道のりの星を押すと、その星のページが開きます。新しい問題は明日です。</p>
        </div>
      )}
    </PanelFrame>
  );
}
