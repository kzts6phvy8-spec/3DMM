// 初期セット第1〜4弾の星の「キー・名前・補足・別名」を書き出す（第5弾を作るときに、同じ星を二重に作らないため）。
// 使い方：node scripts/dump_starter_names.ts > 出力.json
import { readFileSync } from 'node:fs';
import { STARTER_STARS } from '../src/data/starterSet.ts';
import { STARTER_STARS_2 } from '../src/data/starterSet2.ts';

type Spec = { key: string; title: string; qualifier?: string; aliases?: string[]; kind?: string };
const load = (p: string) => (JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8')) as { stars: Spec[] }).stars;
const all: Spec[] = [...STARTER_STARS, ...STARTER_STARS_2, ...load('../src/data/vital.json'), ...load('../src/data/vital10k.json')];
console.log(JSON.stringify(all.map((s) => ({ key: s.key, title: s.title, qualifier: s.qualifier ?? '', aliases: s.aliases ?? [], kind: s.kind ?? '' }))));
