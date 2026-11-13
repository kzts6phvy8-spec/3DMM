import type { CosmosData } from './types';
import { buildDataset, type SourceSpec, type StarSpec } from './data/buildDataset';
import { STARTER_RELATIONS, STARTER_STARS, STARTER_TRIVIA } from './data/starterSet';
import { STARTER_RELATIONS_2, STARTER_STARS_2 } from './data/starterSet2';

interface VitalData {
  stars: StarSpec[];
  /** 既にある初期セットの星に足す記述（キー → 記事名と文） */
  extra: Record<string, { wp: string; statements: { text: string }[] }>;
}

/**
 * 初期セット。
 * - 第1弾（約100個）・第2弾（約75個）：AIが用意。状態は最高でも「出典あり」
 * - 第3弾（約900個）：Wikipedia「すべての言語版にあるべき項目の一覧」の記事の冒頭の文をそのまま使う
 *   （scripts/build_vital.py で作成。データは src/data/vital.json）
 * 出典のWikipedia記事は実在を確認済み。内容の一致は利用者が確認する。
 * 第3弾のデータは大きいので、必要なときだけ読み込む（ふだんの起動を軽くするため）。
 */
export async function createSampleData(): Promise<CosmosData> {
  const vital = (await import('./data/vital.json')).default as unknown as VitalData;
  const extraSources: SourceSpec[] = [];
  const base = [
    ...STARTER_STARS.map((s) => ({ ...s, statements: [...s.statements, ...(STARTER_TRIVIA[s.key] ?? [])] })),
    ...STARTER_STARS_2,
  ].map((s) => {
    const extra = vital.extra[s.key];
    if (!extra) return s;
    // 星の出典と別の記事なら、その記事を出典として登録する
    const sourceKey = extra.wp === s.wp ? `wp-${s.key}` : `wpx-${s.key}`;
    if (extra.wp !== s.wp) {
      extraSources.push({ key: sourceKey, type: 'web', title: `Wikipedia：${extra.wp}`, url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(extra.wp)}` });
    }
    const have = new Set(s.statements.map((x) => x.text));
    const add = extra.statements.filter((x) => !have.has(x.text)).map((x) => ({ text: x.text, sources: [sourceKey] }));
    return { ...s, statements: [...s.statements, ...add] };
  });
  return buildDataset({
    origin: 'starter',
    createdAt: '2026-11-13T00:00:00.000Z',
    sources: extraSources,
    stars: [...base, ...vital.stars],
    relations: [...STARTER_RELATIONS, ...STARTER_RELATIONS_2],
  });
}
