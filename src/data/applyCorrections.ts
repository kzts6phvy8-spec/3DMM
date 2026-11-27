// 初期セットの壊れた記述（Wikipediaから取り出したときに崩れた文）を、端末のデータでも直す。
// 直し方の一覧は corrections.json（元データ vital.json・vital10k.json は直し済み）。
// 「壊れた文と全く同じ文」だけを置き換える。利用者が自分で編集した記述には触れない。
// 直す対象は、初期セットから入った記述（IDが starter- で始まる）だけ。自分で書いた文が、たまたま同じ形でも変えない。
import type { CosmosData, KnowledgeNode, Statement } from '../types';
import { displayName } from '../lib/knowledge';

type Data = Omit<CosmosData, 'version'>;

export interface Corrections {
  /** old：直す前の文（[[名前]] の形。続けて並んだ複数の文を1つにまとめるときは2つ以上）。new：直した文。null なら消す */
  statements: { star: string; old: string[]; new: string | null }[];
  summaries: { star: string; old: string; new: string }[];
}

/** リンクの中身を無視した形（[[名前]] と [[@ID]] を同じ印にする）。リンク以外の文字が全く同じかを比べるため */
const shape = (text: string) => text.replace(/\[\[[^\]]*\]\]/g, '§');
const linksOf = (text: string) => [...text.matchAll(/\[\[([^\]]*)\]\]/g)].map((m) => m[1]);

export function applyCorrections(data: Data, corrections: Corrections): { data: Data; changed: number } {
  const nameToId = new Map<string, string>();
  for (const n of data.nodes) {
    for (const name of [displayName(n), n.title]) if (!nameToId.has(name)) nameToId.set(name, n.id);
  }
  const replaced = new Map<string, string>(); // 記述ID → 新しい文
  const removed = new Set<string>();
  const now = new Date().toISOString();

  // 初期セットのキー → その星の、初期セットから入った記述（並び順どおり）。直しは一覧に書かれた星の文にだけ当てる
  // （「首都は〇〇。」のような短い文は、ほかの星にも同じ形がある。2026-11-27）
  const byKey = new Map<string, Statement[]>();
  for (const st of data.statements) {
    const m = /^starter-(.+)-st\d+$/.exec(st.id);
    if (!m) continue;
    if (!byKey.has(m[1])) byKey.set(m[1], []);
    byKey.get(m[1])!.push(st);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.order - b.order);
  // 同じ文に直しが何回分かあるときは、直したあとの文に次の直しを当てる
  const textOf = (st: Statement) => replaced.get(st.id) ?? st.text;

  for (const c of corrections.statements) {
    const list = (byKey.get(c.star) ?? []).filter((st) => !removed.has(st.id));
    for (let at = 0; at < list.length; at++) {
      const run = list.slice(at, at + c.old.length);
      if (run.length !== c.old.length || run.some((st, i) => shape(textOf(st)) !== shape(c.old[i]))) continue;
      const first = run[0];
      // 直す前の文のリンク（名前）と、端末の文のリンク（ID）を順番に対応させる
      const map = new Map<string, string>();
      run.forEach((st, i) => {
        const ids = linksOf(textOf(st));
        linksOf(c.old[i]).forEach((name, k) => {
          const id = ids[k]?.startsWith('@') ? ids[k].slice(1) : undefined;
          if (id && !map.has(name)) map.set(name, id);
        });
      });
      run.slice(1).forEach((st) => {
        removed.add(st.id);
        replaced.delete(st.id);
      });
      if (c.new === null) {
        removed.add(first.id);
        replaced.delete(first.id);
      } else {
        const text = c.new.replace(/\[\[([^\]]*)\]\]/g, (_, name: string) => {
          const id = map.get(name) ?? nameToId.get(name);
          return id ? `[[@${id}]]` : name; // 見つからない名前は、星を新しく作らずにふつうの文字にする
        });
        if (text !== first.text) replaced.set(first.id, text);
        else replaced.delete(first.id);
      }
      break;
    }
  }

  const summaryFix = new Map(corrections.summaries.map((s) => [s.old, s.new]));
  let summaries = 0;
  const nodes: KnowledgeNode[] = data.nodes.map((n) => {
    const next = n.id.startsWith('starter-') ? summaryFix.get(n.summary) : undefined;
    if (next === undefined) return n;
    summaries++;
    return { ...n, summary: next, updatedAt: now };
  });

  const changed = replaced.size + removed.size + summaries;
  if (changed === 0) return { data, changed };
  const statements = data.statements
    .filter((st) => !removed.has(st.id))
    .map((st) => (replaced.has(st.id) ? { ...st, text: replaced.get(st.id)!, updatedAt: now } : st));
  return { data: { ...data, nodes, statements }, changed };
}
