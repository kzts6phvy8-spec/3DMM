/**
 * 星の名前ラベル（HTML要素）の置き場。
 * 星が1万個あっても、画面に出せる名前は最大数十個なので、決まった数の要素を使い回す（3D側が毎回、どの星の名前を出すかを割り当てる）。
 */
export const LABEL_POOL_SIZE = 60;
export const labelPool: HTMLDivElement[] = [];

/** 要素ごとに、いま書いてある内容（変わったときだけ書き換えるため） */
export interface LabelSlot {
  id: string;
  text: string;
  cls: string;
  style: string;
}
export const labelSlots = new WeakMap<HTMLDivElement, LabelSlot>();

const widthCache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null = null;

/** ラベルの幅（ピクセル）。文字の幅を計算で求める（要素を測ると画面の再計算が起きて重いため） */
export function labelWidth(text: string): number {
  let w = widthCache.get(text);
  if (w !== undefined) return w;
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d');
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    if (ctx) ctx.font = `700 12px ${font}`; // 太字（選んだ星）でもはみ出さないように、太字の幅で測る
  }
  w = (ctx ? ctx.measureText(text).width : text.length * 12) + 16; // 左右の余白 8px ずつ
  widthCache.set(text, w);
  return w;
}
