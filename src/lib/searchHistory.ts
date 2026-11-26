// 検索履歴：「探す」の結果から開いた星を、新しい順に10個まで覚える（2026-11-26、利用者の要望）。
// 端末の中（localStorage）だけに保存する。知識のデータとは別で、バックアップ・同期には含めない。
// 保存できない環境（プライベートブラウズなど）でも、エラーにせず動く（覚えられないだけ）。
import { useSyncExternalStore } from 'react';

const KEY = 'search-history-v1';
const MAX = 10;
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    cache = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list: string[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 保存できなくても、この画面の間は使える */
  }
  listeners.forEach((f) => f());
}

/** 開いた星を、履歴のいちばん上に入れる（同じ星は1つにまとめる） */
export const addSearchHistory = (id: string) => write([id, ...read().filter((x) => x !== id)].slice(0, MAX));
export const removeSearchHistory = (id: string) => write(read().filter((x) => x !== id));
export const clearSearchHistory = () => write([]);

export function useSearchHistory(): string[] {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    read,
  );
}
