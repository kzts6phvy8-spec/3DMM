// 言葉クイズ：難しいけれど面白い言葉の意味を4択で当てて、気に入ったら星にする。
// 無料は1日10問まで。有料プランでは続けて解ける（課金の仕組みはまだない。src/lib/plan.ts）。
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCosmos } from '../store/useCosmos';
import { DAILY_COUNT, makeQuestion, progressForToday, quizOrder, type QuizProgress, type QuizWord } from '../lib/quiz';
import { dateKey } from '../lib/puzzle';
import { normalize } from '../lib/search';
import { spawnPosition } from '../lib/sceneApi';
import { hasUnlimitedQuiz } from '../lib/plan';
import { PanelFrame, openStar } from './Panels';

const STORE_KEY = 'cosmos-quiz';

function loadProgress(): QuizProgress | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const p = raw ? (JSON.parse(raw) as QuizProgress) : null;
    return p && typeof p.date === 'string' && Array.isArray(p.today) && p.answered && typeof p.answered === 'object' ? p : null;
  } catch {
    return null;
  }
}

function saveProgress(p: QuizProgress) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    // 保存できなくても遊べる（答えた記録が残らないだけ）
  }
}

export function QuizPanel() {
  const nodes = useCosmos((s) => s.nodes);
  const [words, setWords] = useState<QuizWord[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [today] = useState(() => dateKey(new Date()));
  const [progress, setProgress] = useState<QuizProgress | null>(null);
  const [extra, setExtra] = useState(false);
  /** 答えたばかりの問題（結果を見せている間） */
  const [result, setResult] = useState<{ title: string; picked: number } | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLParagraphElement>(null);

  // 答えたら結果（正解・星にするボタン）が見えるところまで、次の問題では問題の先頭まで動かす
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    else topRef.current?.scrollIntoView({ block: 'nearest' });
  }, [result]);

  useEffect(() => {
    import('../data/quizWords.json')
      .then((m) => setWords((m.default as { words: QuizWord[] }).words))
      .catch(() => setLoadError(true));
  }, []);

  // 開いたときに宇宙にあった登録済みの星（出題から外す）。答えた後に星にしても、問題が入れ替わらないように最初に決める
  const [knownAtOpen] = useState(
    () => new Set(useCosmos.getState().nodes.filter((n) => n.status === 'known').map((n) => normalize(n.title))),
  );

  useEffect(() => {
    if (!words) return;
    const p = progressForToday(loadProgress(), today, words, knownAtOpen);
    setProgress(p);
    saveProgress(p);
  }, [words, today, knownAtOpen]);

  const byTitle = useMemo(() => new Map((words ?? []).map((w) => [w.title, w])), [words]);

  // 次に出す言葉：今日の問題のうち、まだ答えていないもの → 「もっと解く」なら残りから
  const nextWord = useMemo(() => {
    if (!words || !progress) return null;
    const todayLeft = progress.today.find((t) => !(t in progress.answered) && byTitle.has(t));
    if (todayLeft) return byTitle.get(todayLeft)!;
    if (!extra || !hasUnlimitedQuiz()) return null;
    return quizOrder(today, words, new Set(Object.keys(progress.answered)), knownAtOpen)[0] ?? null;
  }, [words, progress, byTitle, extra, today, knownAtOpen]);

  const shownWord = result ? byTitle.get(result.title) ?? null : nextWord;
  const question = useMemo(
    () => (shownWord && words ? makeQuestion(shownWord, words, today) : null),
    [shownWord, words, today],
  );

  if (loadError) {
    return (
      <PanelFrame title="言葉クイズ">
        <p className="muted">問題を読み込めませんでした。ネットにつながっているか確かめて、もう一度開いてください。</p>
      </PanelFrame>
    );
  }
  if (!words || !progress) {
    return (
      <PanelFrame title="言葉クイズ">
        <p className="muted">読み込んでいます…</p>
      </PanelFrame>
    );
  }

  const todayDone = progress.today.filter((t) => t in progress.answered).length;
  const todayCorrect = progress.today.filter((t) => progress.answered[t]).length;
  const remaining = quizOrder(today, words, new Set(Object.keys(progress.answered)), knownAtOpen).length;

  const answer = (i: number) => {
    if (!question || result) return;
    const next = { ...progress, answered: { ...progress.answered, [question.word.title]: i === question.answer } };
    setProgress(next);
    saveProgress(next);
    setResult({ title: question.word.title, picked: i });
    setMade(null);
    // 1問答えたら、今日の連続記録をつける
    useCosmos.getState().recordActivity();
  };

  const existing = (title: string) => nodes.find((n) => normalize(n.title) === normalize(title));

  const makeStar = (w: QuizWord) => {
    const { addNode, registerFromWikipedia } = useCosmos.getState();
    const found = existing(w.title);
    if (found && found.status === 'known') {
      setMade(found.id);
      return;
    }
    const id =
      found?.id ??
      addNode(
        { title: w.title, qualifier: '', aliases: [], kind: 'concept', category: w.category, tags: [], summary: w.summary, importance: 2 },
        spawnPosition(),
      ).id;
    registerFromWikipedia(id, { summary: w.summary, sentences: w.sentences, articleTitle: w.articleTitle, url: w.url });
    setMade(id);
  };

  return (
    <PanelFrame title="言葉クイズ">
      <p className="muted small">
        今日の問題：{todayDone}/{progress.today.length}問（正解 {todayCorrect}）。気になった言葉は、そのまま星にできます。
      </p>

      {question && (
        <div className="quiz">
          <p className="quiz-q" ref={topRef}>
            「<strong>{question.word.title}</strong>」とは？
          </p>
          <ol className="quiz-choices">
            {question.choices.map((c, i) => {
              const state = !result ? '' : i === question.answer ? ' is-correct' : i === result.picked ? ' is-wrong' : ' is-other';
              return (
                <li key={c.title}>
                  <button className={`quiz-choice${state}`} disabled={!!result} onClick={() => answer(i)}>
                    <span>{c.definition}</span>
                    {result && i !== question.answer && <span className="quiz-owner">→ これは「{c.title}」</span>}
                  </button>
                </li>
              );
            })}
          </ol>

          {result && (
            <div className="quiz-result" ref={resultRef}>
              <p className="report-big">{result.picked === question.answer ? '正解！' : '残念…'}</p>
              <p>{question.word.summary}</p>
              <p className="small">
                出典：<a href={question.word.url} target="_blank" rel="noreferrer">Wikipedia「{question.word.articleTitle}」</a>
              </p>
              <div className="check-actions">
                {made ? (
                  <button className="primary" onClick={() => openStar(made, true)}>✦ 星を開く</button>
                ) : existing(question.word.title)?.status === 'known' ? (
                  <button className="primary" onClick={() => openStar(existing(question.word.title)!.id, true)}>✦ もう星にあります（開く）</button>
                ) : (
                  <button className="primary" onClick={() => makeStar(question.word)}>✦ 星にする</button>
                )}
                <button onClick={() => { setResult(null); setMade(null); }}>次へ</button>
              </div>
              {made && <p className="more-message">「{question.word.title}」を星にしました。</p>}
            </div>
          )}
        </div>
      )}

      {!question && (
        <div className="quiz-done">
          {progress.today.length > 0 && <p className="report-big">今日の{progress.today.length}問、おしまい！</p>}
          <p className="muted">
            {remaining === 0
              ? '用意した言葉は、ぜんぶ解きました。'
              : hasUnlimitedQuiz()
                ? `まだ解いていない言葉が${remaining}個あります。`
                : `また明日、新しい問題が出ます（1日${DAILY_COUNT}問まで）。`}
          </p>
          {remaining > 0 && hasUnlimitedQuiz() && (
            <div className="more-actions">
              <button onClick={() => setExtra(true)}>もっと解く</button>
            </div>
          )}
        </div>
      )}
      <p className="muted small license">説明文：Wikipedia（CC BY-SA 4.0）。選択肢はすべて、ほかの言葉の本当の説明です。</p>
    </PanelFrame>
  );
}
