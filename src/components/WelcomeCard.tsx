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

/** 1枚目の絵：まん中の星と、金色の線でつながる星 */
function ConstellationArt() {
  return (
    <svg className="welcome-art" aria-hidden="true" viewBox="0 0 390 420">
      <g fill="#EEF1FA"><circle cx="173" cy="85" r="1.2" fillOpacity="0.25" /><circle cx="45" cy="282" r="0.8" fillOpacity="0.45" /><circle cx="306" cy="37" r="1.4" fillOpacity="0.35" /><circle cx="27" cy="52" r="1.2" fillOpacity="0.6" /><circle cx="43" cy="131" r="0.8" fillOpacity="0.6" /><circle cx="38" cy="297" r="0.8" fillOpacity="0.35" /><circle cx="330" cy="329" r="1.4" fillOpacity="0.25" /><circle cx="303" cy="307" r="1.2" fillOpacity="0.25" /><circle cx="121" cy="31" r="1.4" fillOpacity="0.35" /><circle cx="156" cy="222" r="1" fillOpacity="0.25" /><circle cx="300" cy="165" r="1.4" fillOpacity="0.35" /><circle cx="60" cy="305" r="1.4" fillOpacity="0.35" /><circle cx="198" cy="57" r="1.4" fillOpacity="0.25" /><circle cx="296" cy="38" r="1.4" fillOpacity="0.35" /><circle cx="262" cy="356" r="1.4" fillOpacity="0.6" /><circle cx="168" cy="246" r="1.4" fillOpacity="0.6" /><circle cx="193" cy="161" r="1" fillOpacity="0.35" /><circle cx="365" cy="407" r="1" fillOpacity="0.25" /><circle cx="302" cy="161" r="1.4" fillOpacity="0.6" /><circle cx="183" cy="381" r="1.2" fillOpacity="0.45" /><circle cx="319" cy="45" r="0.8" fillOpacity="0.6" /><circle cx="92" cy="395" r="1" fillOpacity="0.35" /><circle cx="258" cy="223" r="0.8" fillOpacity="0.25" /><circle cx="293" cy="301" r="1" fillOpacity="0.45" /><circle cx="363" cy="187" r="1.4" fillOpacity="0.6" /><circle cx="304" cy="241" r="0.8" fillOpacity="0.25" /><circle cx="146" cy="250" r="1.6" fillOpacity="0.25" /><circle cx="39" cy="382" r="1.6" fillOpacity="0.45" /><circle cx="339" cy="303" r="1.6" fillOpacity="0.6" /><circle cx="153" cy="374" r="1.2" fillOpacity="0.45" /><circle cx="19" cy="244" r="1" fillOpacity="0.35" /><circle cx="320" cy="67" r="1.2" fillOpacity="0.25" /><circle cx="119" cy="401" r="1" fillOpacity="0.35" /><circle cx="134" cy="211" r="1.2" fillOpacity="0.6" /><circle cx="49" cy="93" r="1.2" fillOpacity="0.6" /><circle cx="289" cy="150" r="1" fillOpacity="0.6" /><circle cx="289" cy="150" r="1.6" fillOpacity="0.6" /><circle cx="191" cy="357" r="1.2" fillOpacity="0.35" /><circle cx="85" cy="50" r="1" fillOpacity="0.35" /><circle cx="126" cy="345" r="1" fillOpacity="0.25" /><circle cx="256" cy="309" r="1" fillOpacity="0.45" /><circle cx="152" cy="10" r="1" fillOpacity="0.6" /><circle cx="281" cy="197" r="1.4" fillOpacity="0.45" /><circle cx="72" cy="361" r="1.4" fillOpacity="0.25" /><circle cx="241" cy="407" r="1.6" fillOpacity="0.6" /><circle cx="209" cy="61" r="1.2" fillOpacity="0.6" /><circle cx="39" cy="105" r="0.8" fillOpacity="0.35" /><circle cx="233" cy="91" r="0.8" fillOpacity="0.45" /><circle cx="315" cy="34" r="0.8" fillOpacity="0.25" /><circle cx="298" cy="85" r="1.4" fillOpacity="0.25" /><circle cx="194" cy="322" r="0.8" fillOpacity="0.25" /><circle cx="114" cy="322" r="1.2" fillOpacity="0.35" /><circle cx="332" cy="137" r="1" fillOpacity="0.45" /><circle cx="250" cy="70" r="0.8" fillOpacity="0.6" /><circle cx="246" cy="253" r="1.2" fillOpacity="0.45" /><circle cx="51" cy="81" r="0.8" fillOpacity="0.45" /><circle cx="143" cy="253" r="1.6" fillOpacity="0.35" /><circle cx="272" cy="19" r="1" fillOpacity="0.45" /><circle cx="83" cy="361" r="1.4" fillOpacity="0.25" /><circle cx="278" cy="160" r="1.6" fillOpacity="0.25" /></g>
      <g stroke="#FFD27A" strokeOpacity="0.14" strokeWidth="1"><line x1="96" y1="128" x2="40" y2="90" /><line x1="195" y1="62" x2="150" y2="60" /><line x1="300" y1="110" x2="350" y2="60" /><line x1="282" y1="320" x2="370" y2="300" /><line x1="110" y1="312" x2="30" y2="330" /><line x1="282" y1="320" x2="200" y2="380" /><line x1="195" y1="62" x2="250" y2="40" /><line x1="60" y1="215" x2="20" y2="180" /></g>
      <g fill="#FFD27A" fillOpacity="0.45"><circle cx="40" cy="90" r="2" /><circle cx="150" cy="60" r="2" /><circle cx="350" cy="60" r="2" /><circle cx="370" cy="300" r="2" /><circle cx="30" cy="330" r="2" /><circle cx="200" cy="380" r="2" /><circle cx="250" cy="40" r="2" /><circle cx="20" cy="180" r="2" /></g>
      <g stroke="#FFD27A" strokeOpacity="0.4" strokeWidth="1"><line x1="195" y1="210" x2="96" y2="128" /><line x1="195" y1="210" x2="300" y2="110" /><line x1="195" y1="210" x2="282" y2="320" /><line x1="195" y1="210" x2="110" y2="312" /><line x1="195" y1="210" x2="60" y2="215" /><line x1="195" y1="210" x2="335" y2="215" /><line x1="195" y1="210" x2="195" y2="62" /></g>
      <g fill="#FFD27A"><circle cx="96" cy="128" r="4" /><circle cx="300" cy="110" r="3" /><circle cx="282" cy="320" r="3.5" /><circle cx="110" cy="312" r="3" /><circle cx="60" cy="215" r="2.5" /><circle cx="335" cy="215" r="3" /><circle cx="195" cy="62" r="2.5" /></g>
      <circle cx="195" cy="210" r="16" fill="#9CC2FF" fillOpacity="0.15" />
      <circle cx="195" cy="210" r="7" fill="#EEF1FA" />
    </svg>
  );
}

/** 2枚目：3つの操作方法 */
function HowToArt() {
  const rows: { icon: React.ReactNode; text: string }[] = [
    {
      icon: (
        <svg viewBox="0 0 40 40" fill="none" stroke="#9CC2FF" strokeWidth="2" strokeLinecap="round">
          <path d="M8 20a12 12 0 0 1 24 0" /><path d="M28 16l4 4 4-4" /><circle cx="20" cy="28" r="4" />
        </svg>
      ),
      text: '指でなぞると宇宙が回り、2本の指で近づけます。',
    },
    {
      icon: (
        <svg viewBox="0 0 40 40" fill="none" strokeWidth="2">
          <line x1="20" y1="20" x2="6" y2="8" stroke="#FFD27A" /><line x1="20" y1="20" x2="35" y2="12" stroke="#FFD27A" /><line x1="20" y1="20" x2="30" y2="34" stroke="#FFD27A" />
          <circle cx="20" cy="20" r="5" fill="#EEF1FA" /><circle cx="6" cy="8" r="3" fill="#FFD27A" /><circle cx="35" cy="12" r="3" fill="#FFD27A" /><circle cx="30" cy="34" r="3" fill="#FFD27A" />
        </svg>
      ),
      text: '星を押すと、つながっている星だけが光ります。',
    },
    {
      icon: (
        <svg viewBox="0 0 40 40" fill="none" stroke="#9CC2FF" strokeWidth="2" strokeLinecap="round">
          <circle cx="9" cy="28" r="4" /><path d="M14 24l12-10" /><path d="M20 13h7v7" /><circle cx="31" cy="10" r="3" fill="#FFD27A" stroke="none" />
        </svg>
      ),
      text: '光っている星を押すと、そこへ移れます。',
    },
  ];
  return (
    <ul className="welcome-howto">
      {rows.map((r) => (
        <li key={r.text}>
          <span className="welcome-howto-icon" aria-hidden="true">{r.icon}</span>
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** 3枚目：AIで調べる例（身近な言葉から、ほかの言葉へ広がる） */
function AiExampleArt() {
  return (
    <div className="welcome-example" aria-hidden="true">
      <div className="welcome-example-box">
        <svg viewBox="0 0 18 18" fill="none" stroke="#9AA3C7" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="5.5" /><path d="M12.5 12.5L16 16" /></svg>
        <span>コーヒー</span>
      </div>
      <p className="welcome-example-label">ここから広がる言葉</p>
      <div className="welcome-example-chips">
        {['カフェイン', 'エチオピア', '焙煎', 'カフェ'].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
    </div>
  );
}

const PAGES: { art: React.ReactNode; title: React.ReactNode; text?: string }[] = [
  { art: <ConstellationArt />, title: <>知識の宇宙へ<br />ようこそ</>, text: 'ひとつの星が、ひとつの知識。光の線は、知識どうしのつながりです。' },
  { art: <HowToArt />, title: '操作方法' },
  {
    art: <AiExampleArt />,
    title: <>知らない言葉は、<br />AIで調べる</>,
    text: '調べた言葉と、そこから広がる言葉が星座になって残ります。登録すると月20回まで無料です。',
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
    <div className="welcome" role="dialog" aria-modal="true" aria-label="はじめての案内">
      <div className="welcome-visual">{p.art}</div>
      <div className="welcome-body">
        <p className="welcome-step">
          {page + 1} / {PAGES.length}
        </p>
        <h1 className="welcome-title">{p.title}</h1>
        {p.text && <p className="welcome-text">{p.text}</p>}
        <div className="welcome-actions">
          {last ? (
            <>
              <button className="welcome-primary" onClick={() => finish('example')}>
                例を見てみる
              </button>
              <button className="welcome-secondary" onClick={() => finish('close')}>
                宇宙を眺める
              </button>
            </>
          ) : (
            <>
              <button className="welcome-primary" onClick={() => setPage(page + 1)}>
                次へ
              </button>
              <button className="welcome-secondary" onClick={() => finish('skip')}>
                とばす
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
