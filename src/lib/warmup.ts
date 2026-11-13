// 手が空いているときに、重い下ごしらえ（検索の索引・逆リンク・つながりの候補）を先に済ませておく。
// 星が1万個あると、これらを初めて使う瞬間に画面が固まるため（探すを開く・星を開く など）。
// 結果は各モジュールの中に覚えられ、データが変わらない限り使い回される。
import type { KnowledgeNode, Source, Statement } from '../types';
import { backlinksOf, mentionEdgesFor } from './knowledge';
import { searchIndex } from './search';
import { warmSuggest } from './suggest';

type Data = { nodes: KnowledgeNode[]; statements: Statement[]; sources: Source[] };

let timer = 0;

const idle = (fn: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 3000 });
  else window.setTimeout(fn, 50);
};

/**
 * データが変わってから少し待って、1つずつ下ごしらえする（1つ終わるごとに画面の操作を受け付ける）。
 * 途中でデータが変わったら、古いデータの下ごしらえはやめる。
 */
export function scheduleWarmup(get: () => Data, delayMs = 1200) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const start = get();
    const steps = [
      (d: Data) => mentionEdgesFor(d.statements, d.nodes),
      (d: Data) => backlinksOf('', d.statements),
      (d: Data) => searchIndex(d.nodes, d.statements, d.sources),
      (d: Data) => warmSuggest(d.nodes, d.statements),
    ];
    const run = (i: number) => {
      if (i >= steps.length) return;
      const d = get();
      if (d.nodes !== start.nodes || d.statements !== start.statements || d.sources !== start.sources) return;
      steps[i](d);
      idle(() => run(i + 1));
    };
    idle(() => run(0));
  }, delayMs);
}
