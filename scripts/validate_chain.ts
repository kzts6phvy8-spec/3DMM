// Knowledge Chain のステージを検証する（仕様 6）。
// 使い方：node scripts/validate_chain.ts
// - すべてのネットワークとステージについて、経路・最短手数・経路の数・行き止まり・接続の重複や矛盾を調べる
// - 問題があれば一覧を出して、終了コード1で終わる
import { network1, stages1 } from '../src/chain/data/network1.ts';
import { validateNetwork, validateStage } from '../src/chain/engine.ts';
import type { ChainNetwork, ChainStage } from '../src/chain/types.ts';

const sets: { network: ChainNetwork; stages: ChainStage[] }[] = [{ network: network1, stages: stages1 }];
let failed = false;
for (const { network, stages } of sets) {
  const net = validateNetwork(network);
  console.log(`## ${network.title}（知識${network.nodes.length}・接続${network.edges.length}・${network.reviewed ? '確認済み' : '未確認'}）`);
  for (const e of net.errors) console.log('  ✗', e);
  for (const w of net.warnings) console.log('  △', w);
  if (net.errors.length) failed = true;
  for (const s of stages) {
    const r = validateStage(s, network);
    const name = (id: string) => network.nodes.find((n) => n.id === id)?.name ?? id;
    console.log(`  ${r.errors.length ? '✗' : '✓'} ${s.title}：${name(s.start)} → ${name(s.goal)}｜最短${r.shortest ?? '-'}手・最短経路${r.shortestRoutes}本・経路${r.routes}本`);
    for (const e of r.errors.filter((x) => !net.errors.includes(x))) console.log('     ✗', e);
    if (r.errors.length) failed = true;
  }
}
process.exit(failed ? 1 : 0);
