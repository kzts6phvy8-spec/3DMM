// 記述の文の中で言葉を選ぶ（長押しで文字を選択する）と、「✦ 星にする」ボタンを出す。
// 押すと、その言葉がリンクになり、宇宙にない言葉は「まだ知らない星」として生まれる。
import { useEffect, useState } from 'react';
import { useCosmos } from '../store/useCosmos';

interface Picked {
  statementId: string;
  word: string;
  x: number;
  y: number;
}

export function SelectionToStar() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [done, setDone] = useState<{ word: string; id: string } | null>(null);

  useEffect(() => {
    const onChange = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPicked(null);
        return;
      }
      const word = sel.toString().replace(/\s+/g, ' ').trim();
      const range = sel.getRangeAt(0);
      const host = (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest('[data-statement-id]');
      if (!host || !word || word.length > 40 || word.includes('\n')) {
        setPicked(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setDone(null);
      setPicked({ statementId: host.getAttribute('data-statement-id')!, word, x: rect.left + rect.width / 2, y: rect.bottom });
    };
    document.addEventListener('selectionchange', onChange);
    return () => document.removeEventListener('selectionchange', onChange);
  }, []);

  if (done) {
    return (
      <div className="select-star done" style={{ left: '50%', bottom: 'calc(var(--safe-bottom) + 84px)' }}>
        <span>「{done.word}」を星にしました</span>
        <button
          className="small-btn primary"
          onClick={() => {
            useCosmos.getState().navigate(done.id);
            setDone(null);
          }}
        >
          開く
        </button>
        <button className="small-btn ghost" onClick={() => setDone(null)}>×</button>
      </div>
    );
  }
  if (!picked) return null;
  const top = Math.min(picked.y + 12, window.innerHeight - 140);
  return (
    <div className="select-star" style={{ left: Math.max(90, Math.min(window.innerWidth - 90, picked.x)), top }}>
      <button
        className="small-btn primary"
        // 押した瞬間に選択が外れないよう、ポインターが押された時点で処理する
        onPointerDown={(e) => {
          e.preventDefault();
          const id = useCosmos.getState().linkWordInStatement(picked.statementId, picked.word);
          document.getSelection()?.removeAllRanges();
          setPicked(null);
          if (id) setDone({ word: picked.word, id });
        }}
      >
        ✦「{picked.word.length > 12 ? picked.word.slice(0, 12) + '…' : picked.word}」を星にする
      </button>
    </div>
  );
}
