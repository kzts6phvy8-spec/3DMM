// 初めて開いた人への案内（3枚のカード）。最初の1回だけ出す。
// 以前から使っている人（連続記録のカードを見たことがある人）には出さない。
import { useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { openStar } from './Panels';
import { track } from '../lib/analytics';

const WELCOME_KEY = 'cosmos-welcome-v1';
const STREAK_KEY = 'cosmos-streak-card';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 案内をまだ見ていない、初めての人か */
export function isFirstVisit(): boolean {
  return read(WELCOME_KEY) === null && read(STREAK_KEY) === null;
}

const PAGES = [
  {
    big: '知識の宇宙へようこそ',
    lines: ['ひとつひとつの星が、ひとつの知識です。', '光の線は、知識どうしのつながり。調べるほど、宇宙がつながって広がっていきます。'],
  },
  {
    big: 'さわり方',
    lines: ['指でなぞると宇宙が回り、2本の指で近づけます。', '星を押すと、つながっている星だけが光ります。光っている星を押すと、その星へ移れます。'],
  },
  {
    big: '🔭 AIで調べる',
    lines: ['知らない言葉は「探す」から、AIで調べられます。', 'その言葉と、そこから広がる言葉が星座になって残ります。登録すると月20回まで無料です。'],
  },
];

export function WelcomeCard() {
  const [open, setOpen] = useState(isFirstVisit);
  const [page, setPage] = useState(0);
  if (!open) return null;

  const finish = (how: 'example' | 'close' | 'skip') => {
    try {
      localStorage.setItem(WELCOME_KEY, new Date().toISOString());
      // 初めての日は、連続記録のカードを重ねて出さない
      const d = new Date();
      localStorage.setItem(STREAK_KEY, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    } catch {
      // 覚えられなくても、次に開いたときにもう一度案内が出るだけ
    }
    track(how === 'skip' ? 'onboarding_skipped' : 'onboarding_done', { page: page + 1, how });
    setOpen(false);
    if (how === 'example') {
      const star = useCosmos.getState().nodes.find((n) => n.title === 'ソクラテス' && n.status === 'known');
      if (star) openStar(star.id);
    }
  };

  const last = page === PAGES.length - 1;
  const p = PAGES[page];
  return (
    <div className="modal-backdrop streak-backdrop welcome-backdrop">
      <section className="streak-card welcome-card" role="dialog" aria-label="はじめての案内">
        <p className="welcome-step muted small">
          {page + 1} / {PAGES.length}
        </p>
        <p className="streak-big">{p.big}</p>
        {p.lines.map((l) => (
          <p key={l} className="streak-text">
            {l}
          </p>
        ))}
        <div className="streak-actions">
          {last ? (
            <>
              <button className="primary" onClick={() => finish('example')}>
                例を見てみる
              </button>
              <button onClick={() => finish('close')}>宇宙を眺める</button>
            </>
          ) : (
            <>
              <button className="primary" onClick={() => setPage(page + 1)}>
                次へ
              </button>
              <button onClick={() => finish('skip')}>とばす</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
