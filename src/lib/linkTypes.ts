// 言及の線（記述の中のリンクから自動でできる線）の種類。Claude Code が初期セットの文を読んで分類した「AIの推測」（2026-11-27〜）。
// データは src/data/linkTypes.json（星IDの組 → 種類の記号）。大きいので、必要になったときだけ読み込む。
// 推測は自動で確定しない（基本方針5）。星の画面で「確定」「変える」を押すと、意味のつながり（Relation）になる。
import { useSyncExternalStore } from 'react';
import type { RelationType } from '../types';

/** 種類の記号（データを小さくするため1文字） */
const CODE: Record<string, RelationType> = {
  C: 'causal',
  S: 'similarity',
  H: 'historical',
  O: 'opposition',
  A: 'application',
  P: 'partWhole',
  K: 'category',
  L: 'place',
  X: 'other',
};

/** 2つの星の組を表すキー（向きは問わない） */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export interface LinkTypes {
  /** 星IDの組 → 推測した種類 */
  types: Map<string, RelationType>;
  /** 言葉の途中に付くなどして、違う意味の星を指しているリンク（星IDの組） */
  mislinks: Set<string>;
}

let data: LinkTypes | null = null;
let loading = false;
const listeners = new Set<() => void>();

function load() {
  if (data || loading) return;
  loading = true;
  import('../data/linkTypes.json')
    .then((m) => {
      const raw = m.default as { types: Record<string, string>; mislinks: string[] };
      const types = new Map<string, RelationType>();
      for (const [k, c] of Object.entries(raw.types)) if (CODE[c]) types.set(k, CODE[c]);
      data = { types, mislinks: new Set(raw.mislinks) };
      listeners.forEach((f) => f());
    })
    .catch(() => {
      loading = false; // 読み込めなくても、推測が出ないだけで他は動く
    });
}

/** 言及の線の種類（読み込み中は null） */
export function useLinkTypes(): LinkTypes | null {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      load();
      return () => listeners.delete(f);
    },
    () => data,
  );
}
