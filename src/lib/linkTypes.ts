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

/** 言及の線の種類（読み込み中は null）。on が false のあいだは読み込まない（起動を軽くするため） */
export function useLinkTypes(on = true): LinkTypes | null {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      if (on) load();
      return () => listeners.delete(f);
    },
    () => (on ? data : null),
  );
}

/** 線の絞り込みで使う種類。種類の分からない線（自分で書いた記述のリンクなど）は 'unknown' */
export type LineKind = RelationType | 'unknown';

/**
 * 線を種類で絞り込んでいるときに、残った線につながっている星のID（絞り込んでいないときは null）。
 * つながっていない星は宇宙で暗くし、名前も出さない（2026-11-28 あなたの指示）
 */
export function lineFilterStarIds(
  lineFilter: LineKind[] | null,
  linkTypes: LinkTypes | null,
  mentions: { a: string; b: string }[],
  relations: { sourceNodeId: string; targetNodeId: string; relationType: RelationType }[],
): Set<string> | null {
  if (!lineFilter || !linkTypes) return null;
  const want = new Set(lineFilter);
  const out = new Set<string>();
  for (const m of mentions) {
    const k = pairKey(m.a, m.b);
    if (linkTypes.mislinks.has(k)) continue;
    if (want.has(linkTypes.types.get(k) ?? 'unknown')) {
      out.add(m.a);
      out.add(m.b);
    }
  }
  for (const r of relations) {
    if (want.has(r.relationType)) {
      out.add(r.sourceNodeId);
      out.add(r.targetNodeId);
    }
  }
  return out;
}

