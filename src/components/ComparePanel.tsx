// 友達の宇宙と重ねる（アイデア⑦）。宇宙カード（関わった星の名前と深さだけ）を送り合って比べる。
import { useMemo, useRef, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { DEPTH_LABELS, buildCard, compareCards, parseCard, type CompareItem, type CosmosCard } from '../lib/compare';
import { OVERLAY_COLORS } from './StarField';
import { PanelFrame, openStar } from './Panels';

const NAME_KEY = 'cosmos-my-name';
const FRIEND_KEY = 'cosmos-friend-card';
const SHOW = 30;

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 保存できなくても、この画面を開いている間は使える
  }
}

function loadFriend(): CosmosCard | null {
  const raw = readLocal(FRIEND_KEY);
  if (!raw) return null;
  try {
    return parseCard(raw);
  } catch {
    return null;
  }
}

function cardFileName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `cosmos-card-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}

type Tab = 'both' | 'friend' | 'mine';

export function ComparePanel({ onCreate }: { onCreate: (title: string) => void }) {
  const nodes = useCosmos((s) => s.nodes);
  const statements = useCosmos((s) => s.statements);
  const relations = useCosmos((s) => s.relations);
  const engagement = useCosmos((s) => s.engagement);
  const { setOverlay, openPanel } = useCosmos.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(() => readLocal(NAME_KEY) ?? '');
  const [friend, setFriend] = useState<CosmosCard | null>(loadFriend);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('both');
  const [showAll, setShowAll] = useState(false);

  const myCard = useMemo(
    () => buildCard(name, { nodes, statements, relations, engagement }),
    [name, nodes, statements, relations, engagement],
  );
  const deep = myCard.stars.filter((s) => s.depth === 2).length;
  const cmp = useMemo(() => (friend ? compareCards(myCard, friend, nodes) : null), [myCard, friend, nodes]);
  const friendName = friend?.name || '友達';

  const sendCard = async () => {
    if (myCard.stars.length === 0) {
      setMessage('まだ関わった星がありません。星を開いたり、記述を加えたりしてから送ってください。');
      return;
    }
    const json = JSON.stringify(myCard);
    const fileName = cardFileName();
    try {
      const file = new File([json], fileName, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: 'Knowledge Cosmos の宇宙カードです。アプリの「その他」→「友達の宇宙と重ねる」で読み込めます。' });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // 共有シートを閉じただけ
      // 共有できない環境では、下の書き出しに切り替える
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('宇宙カードを書き出しました。iPhoneでは「ファイル」アプリに保存されます。そこから友達に送ってください。');
  };

  const readFriend = async (file: File) => {
    try {
      const card = parseCard(await file.text());
      setFriend(card);
      writeLocal(FRIEND_KEY, JSON.stringify(card));
      setTab('both');
      setShowAll(false);
      setMessage(`${card.name || '友達'}さんのカード（星${card.stars.length}個）を読み込みました。`);
    } catch (e) {
      setMessage(`読み込めませんでした：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const showInCosmos = () => {
    if (!friend) return;
    setOverlay({ card: friend });
    openPanel(null);
  };

  const list: CompareItem[] = cmp ? (tab === 'both' ? cmp.both : tab === 'friend' ? cmp.friendOnly : cmp.mineOnly) : [];
  const tabs: { key: Tab; label: string; count: number }[] = cmp
    ? [
        { key: 'both', label: '共通', count: cmp.both.length },
        { key: 'friend', label: `${friendName}さんだけ`, count: cmp.friendOnly.length },
        { key: 'mine', label: '自分だけ', count: cmp.mineOnly.length },
      ]
    : [];
  const depthText = (d: number) => (d ? DEPTH_LABELS[d as 1 | 2] : '—');

  return (
    <PanelFrame title="友達の宇宙と重ねる">
      <p className="muted small">
        初期セットはみんな同じなので、「どの星に関わったか」で比べます。宇宙カードには、関わった星の名前・分野・深さ（開いた／深く関わった）だけが入ります。記述や出典は入りません。
      </p>

      <h3>1. 自分の宇宙カードを送る</h3>
      <label className="field">
        あなたの名前（友達に表示されます）
        <input
          value={name}
          maxLength={30}
          placeholder="例：たろう"
          onChange={(e) => {
            setName(e.target.value);
            writeLocal(NAME_KEY, e.target.value);
          }}
        />
      </label>
      <p className="small">関わった星 {myCard.stars.length}個（深く関わった {deep}個・開いた {myCard.stars.length - deep}個）</p>
      <div className="more-actions">
        <button onClick={sendCard}>📤 宇宙カードを送る</button>
      </div>

      <h3>2. 友達の宇宙カードを読み込む</h3>
      <div className="more-actions">
        <button onClick={() => fileRef.current?.click()}>📥 友達のカードを読み込む</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) readFriend(f);
          }}
        />
      </div>
      {message && <p className="more-message">{message}</p>}

      {cmp && friend && (
        <>
          <h3>{friendName}さんとの重なり</h3>
          <div className="report-growth">
            <span className="report-big">{cmp.overlap}%</span>
            <span className="muted small">重なり度（共通の星 ÷ どちらかが関わった星）</span>
          </div>
          {cmp.bothDeep > 0 && <p className="small">2人とも深く関わった星が {cmp.bothDeep}個あります。</p>}
          <div className="more-actions">
            <button className="primary" onClick={showInCosmos}>🌌 宇宙で重ねて見る</button>
          </div>
          <p className="compare-legend small">
            <span><span className="dot" style={{ background: OVERLAY_COLORS.both }} /> 共通</span>
            <span><span className="dot" style={{ background: OVERLAY_COLORS.friend }} /> {friendName}さんだけ</span>
            <span><span className="dot" style={{ background: OVERLAY_COLORS.mine }} /> 自分だけ</span>
          </p>

          <div className="tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={tab === t.key ? 'tab active' : 'tab'}
                onClick={() => {
                  setTab(t.key);
                  setShowAll(false);
                }}
              >
                {t.label} <span className="muted">{t.count}</span>
              </button>
            ))}
          </div>
          <ul className="panel-list">
            {(showAll ? list : list.slice(0, SHOW)).map((it) => (
              <li key={it.title}>
                <div className="panel-item compare-item">
                  <span className="dot" style={{ background: OVERLAY_COLORS[tab] }} />
                  <span className="panel-item-main">
                    <span className="panel-item-title">{it.title}</span>
                    <span className="panel-item-sub">
                      {it.category && `${it.category}・`}自分：{depthText(it.mine)} ／ {friendName}さん：{depthText(it.friend)}
                    </span>
                  </span>
                  {it.nodeId ? (
                    <button className="small-btn" onClick={() => openStar(it.nodeId!)}>開く</button>
                  ) : (
                    <button className="small-btn" onClick={() => onCreate(it.title)}>＋ 星にする</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!showAll && list.length > SHOW && (
            <button className="small-btn ghost" onClick={() => setShowAll(true)}>すべて見る（ほか{list.length - SHOW}個）</button>
          )}
          {list.length === 0 && <p className="muted">ありません。</p>}
          <div className="more-actions">
            <button
              className="danger"
              onClick={() => {
                setFriend(null);
                writeLocal(FRIEND_KEY, null);
                setOverlay(null);
                setMessage('友達のカードを消しました。');
              }}
            >
              友達のカードを消す
            </button>
          </div>
        </>
      )}
    </PanelFrame>
  );
}

/** 重ねて表示しているときに、宇宙の上に出す説明とやめるボタン */
export function OverlayBanner() {
  const overlay = useCosmos((s) => s.overlay);
  const setOverlay = useCosmos((s) => s.setOverlay);
  const openPanel = useCosmos((s) => s.openPanel);
  if (!overlay) return null;
  return (
    <div className="overlay-banner" role="status">
      <span className="small">
        <strong>{overlay.card.name || '友達'}さんと重ねて表示中</strong>
        <span className="compare-legend">
          <span><span className="dot" style={{ background: OVERLAY_COLORS.both }} /> 共通</span>
          <span><span className="dot" style={{ background: OVERLAY_COLORS.friend }} /> 友達だけ</span>
          <span><span className="dot" style={{ background: OVERLAY_COLORS.mine }} /> 自分だけ</span>
        </span>
      </span>
      <div className="overlay-banner-actions">
        <button className="small-btn" onClick={() => openPanel('compare')}>一覧</button>
        <button className="small-btn" onClick={() => setOverlay(null)}>やめる</button>
      </div>
    </div>
  );
}
