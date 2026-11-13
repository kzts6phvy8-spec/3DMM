import type { RelationType } from '../types';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** カテゴリー名から毎回同じ色を作る（同じカテゴリー＝同じ色の星） */
export function categoryColor(category: string): string {
  if (!category) return '#c9d6ff';
  let h = 0;
  for (const ch of category) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 85%, 70%)`;
}

export const RELATION_COLORS: Record<RelationType, string> = {
  causal: '#ff9f6b',
  similarity: '#7fd8ff',
  historical: '#d9b8ff',
  opposition: '#ff6b8b',
  application: '#8dffb0',
  partWhole: '#ffe27a',
  other: '#9aa7c7',
};

/** 重要度(1〜5)から星の半径を決める */
export function starRadius(importance: number): number {
  return 0.16 + Math.min(Math.max(importance, 1), 5) * 0.07;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
}
