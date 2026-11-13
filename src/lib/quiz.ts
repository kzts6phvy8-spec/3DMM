// 言葉クイズ：難しいけれど面白い言葉の意味を4択で当てて、気に入ったら星にする。
// 画面から独立した純粋な処理だけを置く。
// - 選択肢はすべて、問題の言葉リストにある言葉のWikipediaの説明（本物の説明）から作る。うその説明は作らない。
import { seededRandom } from './puzzle';
import { normalize } from './search';
import { FREE_QUIZ_PER_DAY } from './plan';

export interface QuizWord {
  /** 星の名前 */
  title: string;
  category: string;
  /** 選択肢に使う短い説明（言葉そのものは伏せてある） */
  definition: string;
  /** 星にするときの概要 */
  summary: string;
  /** 星にするときの記述（Wikipediaの冒頭の文） */
  sentences: string[];
  /** 出典 */
  articleTitle: string;
  url: string;
}

export interface QuizChoice {
  /** この説明がどの言葉のものか */
  title: string;
  definition: string;
}

export interface QuizQuestion {
  word: QuizWord;
  choices: QuizChoice[];
  /** 正解の位置 */
  answer: number;
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** その日の出題の順番（日付で決まる）。答えた言葉と、すでに宇宙で登録済みの言葉は出さない */
export function quizOrder(date: string, words: QuizWord[], answered: Set<string>, knownTitles: Set<string>): QuizWord[] {
  const rand = seededRandom(`cosmos-quiz:${date}`);
  const ok = words.filter((w) => !answered.has(w.title) && !knownTitles.has(normalize(w.title)));
  return shuffle(ok, rand);
}

/** 4択の問題を作る。ほかの選択肢は、できるだけ同じ分野の言葉の説明から選ぶ（当てずっぽうで当たりにくく） */
export function makeQuestion(word: QuizWord, words: QuizWord[], seed: string, size = 4): QuizQuestion {
  const rand = seededRandom(`cosmos-quiz-choice:${seed}:${word.title}`);
  const others = words.filter((w) => w.title !== word.title && w.definition !== word.definition);
  const same = shuffle(others.filter((w) => w.category === word.category), rand);
  const rest = shuffle(others.filter((w) => w.category !== word.category), rand);
  const picked = [...same, ...rest].slice(0, size - 1);
  const choices = shuffle([word, ...picked], rand).map((w) => ({ title: w.title, definition: w.definition }));
  return { word, choices, answer: choices.findIndex((c) => c.title === word.title) };
}

/** 遊んだ記録 */
export interface QuizProgress {
  /** 今日の日付と、今日の3問（最初に開いたときに決める） */
  date: string;
  today: string[];
  /** 答えた言葉 → 正解したか */
  answered: Record<string, boolean>;
}

/** 1日に解ける問題の数（無料）。有料プランでは「もっと解く」で続けられる（src/lib/plan.ts） */
export const DAILY_COUNT = FREE_QUIZ_PER_DAY;

/**
 * 今日の問題を決める。日付が変わっていたら決め直す。
 * 同じ日でも、今日の問題が上限より少なければ足す（以前の版で「1日3問」だった日の続きなど）。
 */
export function progressForToday(prev: QuizProgress | null, date: string, words: QuizWord[], knownTitles: Set<string>): QuizProgress {
  const answered = prev?.answered ?? {};
  const kept = prev && prev.date === date ? prev.today : [];
  if (kept.length >= DAILY_COUNT) return prev!;
  const skip = new Set([...Object.keys(answered), ...kept]);
  const more = quizOrder(date, words, skip, knownTitles)
    .slice(0, DAILY_COUNT - kept.length)
    .map((w) => w.title);
  return { date, today: [...kept, ...more], answered };
}
