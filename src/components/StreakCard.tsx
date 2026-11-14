// 起動したときに、毎日の連続記録を知らせるカード（1日に1回だけ出す）。
// 連続記録は、言葉クイズに1問答えるか、つながりパズルでゴールすると、その日の分がつく（src/lib/streak.ts）。
import { useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { streakInfo } from '../lib/streak';
import { dateKey } from '../lib/puzzle';

const SHOWN_KEY = 'cosmos-streak-card';

function shownToday(today: string): boolean {
  try {
    return localStorage.getItem(SHOWN_KEY) === today;
  } catch {
    return false;
  }
}

function markShown(today: string) {
  try {
    localStorage.setItem(SHOWN_KEY, today);
  } catch {
    // 覚えられなくても、カードが次に開いたときにもう一度出るだけ
  }
}

export function StreakCard() {
  const [today] = useState(() => dateKey(new Date()));
  const [open, setOpen] = useState(() => !shownToday(today));
  // カードを出した瞬間の記録で文を決める（カードを出している間に記録がついても、文が変わらないように）
  const [info] = useState(() => streakInfo(useCosmos.getState().activityDays, today));
  if (!open) return null;

  const close = () => {
    markShown(today);
    setOpen(false);
  };
  const go = (panel: 'quiz' | 'puzzle') => {
    close();
    useCosmos.getState().openPanel(panel);
  };

  let big: string;
  let text: string;
  if (info.current > 0) {
    big = `🔥 ${info.current}日連続`;
    text = info.todayDone
      ? '今日の分はもう達成しています。'
      : `今日もクイズかパズルを1つ解くと、${info.current + 1}日になります。`;
  } else if (info.broken) {
    big = '記録が途切れました';
    text = `これまでの最高は${info.best}日です。今日解けば、また1日目から始まります。`;
  } else {
    big = '🔥 毎日の連続記録';
    text = '言葉クイズに答えるか、つながりパズルでゴールすると、その日の記録がつきます。';
  }

  return (
    <div className="modal-backdrop streak-backdrop" onClick={close}>
      <section className="streak-card" role="dialog" aria-label="連続記録" onClick={(e) => e.stopPropagation()}>
        <p className="streak-big">{big}</p>
        <p className="streak-text">{text}</p>
        {info.current > 0 && info.best > info.current && <p className="muted small">最高記録：{info.best}日</p>}
        <div className="streak-actions">
          {!info.todayDone && (
            <>
              <button className="primary" onClick={() => go('quiz')}>言葉クイズ</button>
              <button className="primary" onClick={() => go('puzzle')}>つながりパズル</button>
            </>
          )}
          <button onClick={close}>閉じる</button>
        </div>
      </section>
    </div>
  );
}
