import type { CosmosData } from './types';
import { buildDataset } from './data/buildDataset';
import { STARTER_RELATIONS, STARTER_STARS, STARTER_TRIVIA } from './data/starterSet';

/**
 * 初回起動時のデータ＝初期セット（約100個）。
 * AIが用意した内容なので、状態は最高でも「出典あり」。確認済みにはしていない。
 * 出典のWikipedia記事は、すべて実在することを確認済み（2026-11-13）。内容の一致は利用者が確認する。
 */
export function createSampleData(): CosmosData {
  return buildDataset({
    origin: 'starter',
    createdAt: '2026-11-13T00:00:00.000Z',
    // 雑学は各星の記述の最後に足す（既存の記述のIDが変わらないように）
    stars: STARTER_STARS.map((s) => ({ ...s, statements: [...s.statements, ...(STARTER_TRIVIA[s.key] ?? [])] })),
    relations: STARTER_RELATIONS,
  });
}
