// ひらがなだけの名前の星（えら・もつ・いとこ など）へのリンクが、ほかの言葉の一部に誤って付いたものを見分けて外す。
// 例：「植[[えら]]れて」「機能を[[もつ]]」「深[[いとこ]]ろ」。初期セットを作るとき、文字が同じだけでリンクにしていたため（2026-11-22に発見）。

const ONLY_HIRAGANA = /^[ぁ-ゟ]+$/;
const HIRAGANA = /[ぁ-ゟ]/;
const KANJI = /[一-鿿々]/;
/** 名前のすぐ後に続いてもよいひらがな（助詞） */
const PARTICLES = new Set([...'のはがをにとでやもへか']);

/** 前後の1文字から、言葉の途中に入ったリンクかを判断する */
export function isBrokenKanaLink(name: string, before: string, after: string): boolean {
  if (!ONLY_HIRAGANA.test(name)) return false;
  if (KANJI.test(before)) return true; // 送り仮名の一部（植えら・多いとこ）
  if (before === 'を') return true; // 動詞として使われている（機能をもつ）
  if (HIRAGANA.test(after) && !PARTICLES.has(after)) return true; // 言葉が続いている（いところ・てこう）
  return false;
}

/**
 * 文の中のリンク [[…]] のうち、言葉の途中に入ったものをふつうの文字に戻す。
 * nameOf：リンクの中身（[[名前]] の「名前」、または [[@ID]] の「@ID」）から、表示する名前を返す
 */
export function unlinkBrokenKana(text: string, nameOf: (inner: string) => string | undefined): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, (token, inner: string, offset: number) => {
    const name = nameOf(inner);
    if (!name) return token;
    const before = text[offset - 1] ?? '';
    const after = text[offset + token.length] ?? '';
    return isBrokenKanaLink(name, before, after) ? name : token;
  });
}

/** 端末のデータの、初期セットの記述（IDが starter- で始まる）だけを直す。自分で書いた記述には触れない */
export function fixKanaLinksInData<D extends { nodes: { id: string; title: string }[]; statements: { id: string; text: string; updatedAt: string }[] }>(
  data: D,
): { data: D; changed: number } {
  const titleOf = new Map(data.nodes.map((n) => [n.id, n.title]));
  const nameOf = (inner: string) => (inner.startsWith('@') ? titleOf.get(inner.slice(1)) : undefined);
  let changed = 0;
  const now = new Date().toISOString();
  const statements = data.statements.map((st) => {
    if (!st.id.startsWith('starter-')) return st;
    const text = unlinkBrokenKana(st.text, nameOf);
    if (text === st.text) return st;
    changed++;
    return { ...st, text, updatedAt: now };
  });
  return { data: changed ? { ...data, statements } : data, changed };
}
