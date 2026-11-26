// src/data/applyRefresh.ts（初期セットの文の差し替え）を、小さなデータで確かめる。
// 使い方：npx rolldown scripts/test_apply_refresh.ts --platform node --format esm --file <作業フォルダ>/t.mjs && node <作業フォルダ>/t.mjs
import { buildDataset } from '../src/data/buildDataset';
import { applyRefresh, type StarterRefresh } from '../src/data/applyRefresh';

let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? 'OK ' : 'NG '} ${name}`);
  if (!ok) {
    failed++;
    if (detail !== undefined) console.log('   ', JSON.stringify(detail));
  }
};

const base = buildDataset({
  origin: 'starter',
  createdAt: '2026-01-01T00:00:00.000Z',
  stars: [
    { key: 'a', title: '数学', kind: 'concept', category: '数学', summary: '数学は学問である。', wp: '数学', statements: [{ text: '数学は[[論理]]を使う学問である。' }, { text: '古代から続く。' }, { text: '三つ目の文。' }] },
    { key: 'b', title: '論理', kind: 'concept', category: '哲学', summary: '論理の概要。', wp: '論理', statements: [{ text: '論理は考え方の筋道である。' }, { text: '二つ目。' }, { text: '三つ目。' }] },
    { key: 'c', title: '関数', qualifier: '数学', kind: 'concept', category: '数学', summary: '関数の概要。', wp: '関数 (数学)', statements: [{ text: '関数は対応である。' }] },
    { key: 'd', title: '集合', kind: 'concept', category: '数学', summary: '集合の概要。', wp: '集合', statements: [{ text: '集合はものの集まりである。' }, { text: '[[数学]]の基礎。' }] },
    { key: 'e', title: '幾何学', kind: 'concept', category: '数学', summary: '幾何学の概要。', wp: '幾何学', statements: [{ text: '幾何学は図形の学問。' }] },
  ],
});
// 利用者の操作をまねる：集合（d）の2文目を自分で編集、幾何学（e）に自分で記述を足す
const userEdited = {
  ...base,
  statements: [
    ...base.statements.map((s) => (s.id === 'starter-d-st1' ? { ...s, text: s.text + '（自分のメモ）' } : s)),
    { ...base.statements.find((s) => s.id === 'starter-e-st0')!, id: 'mine-1', text: '自分で足した文。', order: 1 },
  ],
};
const { version: _v, ...data } = userEdited;

const refresh: StarterRefresh = {
  version: '2027-05',
  stars: [
    // a：1文目が変わる・リンク先を保つ／新しいリンク（関数（数学））が付く
    { star: 'a', old: ['数学は[[論理]]を使う学問である。', '古代から続く。', '三つ目の文。'], new: ['数学は[[論理]]と[[関数（数学）]]を使う学問である。', '古代から続く。', '三つ目の文。'], oldSummary: '数学は学問である。', newSummary: '数学は論理を使う学問である。' },
    // b：3文 → 2文
    { star: 'b', old: ['論理は考え方の筋道である。', '二つ目。', '三つ目。'], new: ['論理は考え方の筋道である。', '二つ目（新）。'], oldSummary: '論理の概要。', newSummary: '論理の概要。' },
    // c：1文 → 3文。見つからない名前のリンクはふつうの文字になる
    { star: 'c', old: ['関数は対応である。'], new: ['関数は対応である。', '[[存在しない星]]と比べる。', '三つ目。'], oldSummary: '関数の概要。', newSummary: '関数の新しい概要。' },
    // d：利用者が編集した星 → 何も変えない
    { star: 'd', old: ['集合はものの集まりである。', '[[数学]]の基礎。'], new: ['集合は変わった。', '[[数学]]の基礎。'], oldSummary: '集合の概要。', newSummary: '集合の新しい概要。' },
    // e：自分で足した記述はそのまま、初期セットの文だけ変わる
    { star: 'e', old: ['幾何学は図形の学問。'], new: ['幾何学は図形と空間の学問。'], oldSummary: '幾何学の概要。', newSummary: '幾何学の概要。' },
    // 端末にない星 → 何もしない
    { star: 'zz', old: ['ない。'], new: ['ない2。'], oldSummary: '', newSummary: '' },
  ],
};

const { data: out, changed } = applyRefresh(data, refresh);
const st = (starId: string) => out.statements.filter((s) => s.starId === starId).sort((x, y) => x.order - y.order).map((s) => s.text);
const node = (id: string) => out.nodes.find((n) => n.id === id)!;

check('a：1文目が新しくなり、論理と関数（数学）へのリンクがIDになる', st('starter-a')[0] === '数学は[[@starter-b]]と[[@starter-c]]を使う学問である。', st('starter-a'));
check('a：2・3文目はそのまま', st('starter-a').slice(1).join('|') === '古代から続く。|三つ目の文。');
check('a：概要が変わる', node('starter-a').summary === '数学は論理を使う学問である。');
check('b：3文 → 2文', st('starter-b').join('|') === '論理は考え方の筋道である。|二つ目（新）。', st('starter-b'));
check('c：1文 → 3文（見つからない名前はふつうの文字）', st('starter-c').join('|') === '関数は対応である。|存在しない星と比べる。|三つ目。', st('starter-c'));
check('c：足した記述のIDが重ならない', new Set(out.statements.map((s) => s.id)).size === out.statements.length);
check('c：概要が変わる', node('starter-c').summary === '関数の新しい概要。');
check('d：編集した星の記述はそのまま', st('starter-d')[0] === '集合はものの集まりである。' && st('starter-d')[1].endsWith('（自分のメモ）'), st('starter-d'));
check('d：編集した星の概要もそのまま', node('starter-d').summary === '集合の概要。');
check('e：初期セットの文だけ変わり、自分の記述は残る（順番も後ろのまま）', st('starter-e').join('|') === '幾何学は図形と空間の学問。|自分で足した文。', st('starter-e'));
check('変わった数', changed === 1 + 1 + 1 + 2 + 1 + 1 + 1, changed);

// 2回目は何も変わらない（同じ版を2回反映しても安全）
const again = applyRefresh(out, refresh);
check('同じ一覧をもう一度反映しても変わらない', again.changed === 0, again.changed);

console.log(failed ? `\n${failed}個 失敗` : '\nすべて成功');
process.exit(failed ? 1 : 0);
