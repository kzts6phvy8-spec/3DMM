// 毎日の連続記録（Duolingoのように、続けた日数を数える）。
// 「その日やった」と数えるのは、言葉クイズに1問答えた日、またはつながりパズルでゴールした日。
// 記録は「やった日の一覧」で持つ（端末をまたいで合わせるときは、一覧を足し合わせるだけで済むように）。
import { dateKey } from './puzzle';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 読み込んだ値を、日付（YYYY-MM-DD）の一覧として正しい形にする */
export function sanitizeDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((d): d is string => typeof d === 'string' && DAY_RE.test(d)))].sort();
}

/** やった日を足す（同じ日は1回だけ） */
export function addDay(days: string[], day: string): string[] {
  return days.includes(day) ? days : [...days, day].sort();
}

/** 2つの記録を合わせる（バックアップの復元・端末の同期用） */
export function mergeDays(a: string[], b: string[]): string[] {
  return sanitizeDays([...a, ...b]);
}

function shift(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + delta));
}

export interface StreakInfo {
  /** 今続いている日数（今日まだやっていなくても、昨日まで続いていれば数える） */
  current: number;
  /** いちばん長く続いた日数 */
  best: number;
  /** 今日の分はもうやったか */
  todayDone: boolean;
  /** 前は続いていたが、途切れてしまった（昨日も今日もやっていない） */
  broken: boolean;
}

export function streakInfo(days: string[], today: string): StreakInfo {
  const set = new Set(days);
  const todayDone = set.has(today);
  let current = 0;
  let cur = todayDone ? today : shift(today, -1);
  while (set.has(cur)) {
    current++;
    cur = shift(cur, -1);
  }
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of [...set].sort()) {
    run = prev && shift(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best, todayDone, broken: current === 0 && days.length > 0 };
}
