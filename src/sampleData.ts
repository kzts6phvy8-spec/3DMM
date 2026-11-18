import type { CosmosData } from './types';
import { buildDataset, type SourceSpec, type StarSpec, type StatementSpec } from './data/buildDataset';
import { STARTER_RELATIONS, STARTER_STARS, STARTER_TRIVIA } from './data/starterSet';
import { STARTER_RELATIONS_2, STARTER_STARS_2 } from './data/starterSet2';

interface VitalData {
  stars: StarSpec[];
  /** 既にある初期セットの星に足す記述（キー → 記事名と文） */
  extra: Record<string, { wp: string; statements: { text: string }[] }>;
}

/** 第5弾（クイズ年表）のデータの形 */
interface ChronoData {
  sources: SourceSpec[];
  stars: StarSpec[];
  /** 既にある初期セットの星に足す記述（キー → 記述） */
  extra: Record<string, StatementSpec[]>;
}

/**
 * 初期セット。
 * - 第1弾（約100個）・第2弾（約75個）：AIが用意。出典つき
 * - 第3弾（約900個）：Wikipedia「すべての言語版にあるべき項目の一覧」の記事の冒頭の文をそのまま使う
 *   （scripts/build_vital.py で作成。データは src/data/vital.json）
 * 出典のWikipedia記事は実在を確認済み。内容の一致は利用者が確認する。
 * - 第4弾（約8,700個）：同じ一覧の「1万の項目」版から、第1〜3弾にない項目を同じ決まりで作る
 *   （scripts/build_vital10k.py で作成。データは src/data/vital10k.json）
 * - 第5弾（約1,400個）：利用者のメモ「クイズ年表」から作った、出来事の星と年の星（例：1600年）
 * - 第6弾（約350個）：利用者の知識メモ（語源・ことわざ・化学式など）から作った星。第5弾と同じ chrono.json に入っている
 *   （scripts/build_chrono.py で作成。データは src/data/chrono.json）。既にある星には記述を足す。
 *   星のキーは c〇（出来事）・y〇／ym〇（年。ymは紀元前）。取り消すときは、このキーの星を消す。
 * 第3弾〜第5弾のデータは大きいので、必要なときだけ読み込む（ふだんの起動を軽くするため）。
 */
export async function createSampleData(): Promise<CosmosData> {
  const [vital, vital10k, chrono] = await Promise.all([
    import('./data/vital.json').then((m) => m.default as unknown as VitalData),
    import('./data/vital10k.json').then((m) => m.default as unknown as { stars: StarSpec[] }),
    import('./data/chrono.json').then((m) => m.default as unknown as ChronoData),
  ]);
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
  // 第5弾：既にある星（第1〜4弾）に、年表の記述を足す
  const withChrono = [...base, ...vital.stars, ...vital10k.stars].map((s) => {
    const add = chrono.extra[s.key];
    return add ? { ...s, statements: [...s.statements, ...add] } : s;
  });
  return buildDataset({
    origin: 'starter',
    createdAt: '2026-11-13T00:00:00.000Z',
    sources: [...extraSources, ...chrono.sources],
    stars: [...withChrono, ...chrono.stars],
    relations: [...STARTER_RELATIONS, ...STARTER_RELATIONS_2],
  });
}
