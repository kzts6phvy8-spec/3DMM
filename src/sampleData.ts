import type { CosmosData } from './types';
import { buildDataset } from './data/buildDataset';
import { STARTER_RELATIONS, STARTER_STARS } from './data/starterSet';

/**
 * 初回起動時のデータ＝初期セット（約100個）。
 * AIが用意した内容なので、状態は最高でも「出典あり」。確認済みにはしていない。
 * 出典のWikipedia記事は、すべて実在することを確認済み（2026-11-13）。内容の一致は利用者が確認する。
 */
export function createSampleData(): CosmosData {
  return buildDataset({
    origin: 'starter',
    createdAt: '2026-11-13T00:00:00.000Z',
    stars: STARTER_STARS,
    relations: STARTER_RELATIONS,
  });
}
