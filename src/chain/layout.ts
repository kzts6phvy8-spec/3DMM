// クリア後の全体マップの配置。
// 知識どうしの「手数の近さ」が、そのまま平面上の距離になるように並べる（ストレス最小化）。
// 木のように長くつながったネットワークでも、全体がまんべんなく広がる。毎回同じ配置になる（乱数を使わない）。
import type { ChainNetwork } from './types';

export interface Point {
  x: number;
  y: number;
}

/** 0〜1 の範囲の座標を返す */
export function layoutNetwork(net: ChainNetwork, iterations = 300): Map<string, Point> {
  const ids = net.nodes.map((n) => n.id);
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));
  const nbrs: number[][] = ids.map(() => []);
  for (const e of net.edges) {
    const a = index.get(e.from);
    const b = index.get(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    nbrs[a].push(b);
    nbrs[b].push(a);
  }
  // 全部の組の手数（つながっていない組は、いちばん遠い手数＋1として扱う）
  const dist: number[][] = ids.map((_, s) => {
    const d = new Array<number>(n).fill(-1);
    d[s] = 0;
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      for (const m of nbrs[queue[i]]) {
        if (d[m] >= 0) continue;
        d[m] = d[queue[i]] + 1;
        queue.push(m);
      }
    }
    return d;
  });
  const far = Math.max(1, ...dist.flat()) + 1;
  for (const row of dist) for (let j = 0; j < n; j++) if (row[j] < 0) row[j] = far;

  // 初期位置：らせん状
  const x = ids.map((_, i) => Math.sqrt(i + 0.5) * Math.cos(i * 2.39996));
  const y = ids.map((_, i) => Math.sqrt(i + 0.5) * Math.sin(i * 2.39996));
  // ストレス最小化（SMACOF）：各点を、ほかの点との「理想の距離」に近づける
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      let sx = 0;
      let sy = 0;
      let sw = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = dist[i][j];
        const w = 1 / (d * d);
        const dx = x[i] - x[j];
        const dy = y[i] - y[j];
        const cur = Math.hypot(dx, dy) || 1e-6;
        sx += w * (x[j] + (d * dx) / cur);
        sy += w * (y[j] + (d * dy) / cur);
        sw += w;
      }
      x[i] = sx / sw;
      y[i] = sy / sw;
    }
  }
  // 縦長の画面に合わせて、広がりがいちばん大きい向きを縦にする
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy); // 広がりがいちばん大きい向き
  const rot = Math.PI / 2 - angle;
  const rx = x.map((v, i) => (v - mx) * Math.cos(rot) - (y[i] - my) * Math.sin(rot));
  const ry = x.map((v, i) => (v - mx) * Math.sin(rot) + (y[i] - my) * Math.cos(rot));
  const [minX, maxX, minY, maxY] = [Math.min(...rx), Math.max(...rx), Math.min(...ry), Math.max(...ry)];
  const pos = new Map<string, Point>();
  ids.forEach((id, i) => {
    pos.set(id, { x: (rx[i] - minX) / Math.max(maxX - minX, 1e-9), y: (ry[i] - minY) / Math.max(maxY - minY, 1e-9) });
  });
  return pos;
}

export interface LabelBox {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/**
 * 名前の置き場所を決める（上・下・右・左のうち、ほかの名前や点と重ならないところ）。
 * 文字の幅は、日本語1文字＝fontSize、英数字＝その6割として見積もる。
 */
export function placeLabels(
  points: { id: string; x: number; y: number; text: string }[],
  fontSize: number,
  width: number,
  height: number,
  order: string[],
): Map<string, LabelBox> {
  const textWidth = (t: string) => [...t].reduce((s, c) => s + (/[ -~]/.test(c) ? fontSize * 0.6 : fontSize), 0);
  const byId = new Map(points.map((p) => [p.id, p]));
  const placed: { x1: number; x2: number; y1: number; y2: number }[] = points.map((p) => ({ x1: p.x - 7, x2: p.x + 7, y1: p.y - 7, y2: p.y + 7 }));
  const out = new Map<string, LabelBox>();
  const overlap = (b: { x1: number; x2: number; y1: number; y2: number }) =>
    placed.reduce((s, q) => s + Math.max(0, Math.min(b.x2, q.x2) - Math.max(b.x1, q.x1)) * Math.max(0, Math.min(b.y2, q.y2) - Math.max(b.y1, q.y1)), 0) +
    // 枠からはみ出す分も重なりとして数える
    (Math.max(0, -b.x1) + Math.max(0, b.x2 - width) + Math.max(0, -b.y1) + Math.max(0, b.y2 - height)) * fontSize * 4;
  for (const id of order) {
    const p = byId.get(id);
    if (!p) continue;
    // 実際に描かれる大きさは見積もりより少し大きいので、余裕をもたせる
    const w = textWidth(p.text) * 1.08 + 4;
    const h = fontSize * 1.35 + 2;
    const cands: (LabelBox & { box: { x1: number; x2: number; y1: number; y2: number } })[] = [
      { x: p.x, y: p.y - 10, anchor: 'middle', box: { x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y - 10 - h, y2: p.y - 10 } },
      { x: p.x, y: p.y + 10 + fontSize, anchor: 'middle', box: { x1: p.x - w / 2, x2: p.x + w / 2, y1: p.y + 10, y2: p.y + 10 + h } },
      { x: p.x + 10, y: p.y + fontSize / 2 - 1, anchor: 'start', box: { x1: p.x + 10, x2: p.x + 10 + w, y1: p.y - h / 2, y2: p.y + h / 2 } },
      { x: p.x - 10, y: p.y + fontSize / 2 - 1, anchor: 'end', box: { x1: p.x - 10 - w, x2: p.x - 10, y1: p.y - h / 2, y2: p.y + h / 2 } },
      // 斜め（右上・左上・右下・左下）
      { x: p.x + 6, y: p.y - 8, anchor: 'start', box: { x1: p.x + 6, x2: p.x + 6 + w, y1: p.y - 8 - h, y2: p.y - 8 } },
      { x: p.x - 6, y: p.y - 8, anchor: 'end', box: { x1: p.x - 6 - w, x2: p.x - 6, y1: p.y - 8 - h, y2: p.y - 8 } },
      { x: p.x + 6, y: p.y + 8 + fontSize, anchor: 'start', box: { x1: p.x + 6, x2: p.x + 6 + w, y1: p.y + 8, y2: p.y + 8 + h } },
      { x: p.x - 6, y: p.y + 8 + fontSize, anchor: 'end', box: { x1: p.x - 6 - w, x2: p.x - 6, y1: p.y + 8, y2: p.y + 8 + h } },
    ];
    // どこも重なるときのために、少し離れた位置も候補にする
    for (const c of cands.slice(0, 4)) {
      const dx = c.anchor === 'start' ? 10 : c.anchor === 'end' ? -10 : 0;
      const dy = c.anchor === 'middle' ? (c.y < p.y ? -12 : 12) : 0;
      cands.push({ x: c.x + dx, y: c.y + dy, anchor: c.anchor, box: { x1: c.box.x1 + dx, x2: c.box.x2 + dx, y1: c.box.y1 + dy, y2: c.box.y2 + dy } });
    }
    let best = cands[0];
    let bestScore = Infinity;
    for (const c of cands) {
      const sc = overlap(c.box);
      if (sc < bestScore) {
        bestScore = sc;
        best = c;
      }
      if (sc === 0) break;
    }
    placed.push(best.box);
    out.set(id, { x: best.x, y: best.y, anchor: best.anchor });
  }
  return out;
}
