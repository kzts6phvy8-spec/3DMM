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
const isStarter = (st: Statement) => st.id.startsWith('starter-');
const linksOf = (text: string) => [...text.matchAll(/\[\[([^\]]*)\]\]/g)].map((m) => m[1]);

export function applyCorrections(data: Data, corrections: Corrections): { data: Data; changed: number } {
  const nameToId = new Map<string, string>();
  for (const n of data.nodes) {
    for (const name of [displayName(n), n.title]) if (!nameToId.has(name)) nameToId.set(name, n.id);
  }
  // 星ごとの記述（並び順どおり）と、形から記述を引く表
  const byStar = new Map<string, Statement[]>();
  for (const st of data.statements) {
    if (!byStar.has(st.starId)) byStar.set(st.starId, []);
    byStar.get(st.starId)!.push(st);
  }
  for (const list of byStar.values()) list.sort((a, b) => a.order - b.order);
  const byShape = new Map<string, Statement[]>();
  for (const st of data.statements) {
    if (!isStarter(st)) continue;
    const k = shape(st.text);
    if (!byShape.has(k)) byShape.set(k, []);
    byShape.get(k)!.push(st);
  }

  const replaced = new Map<string, string>(); // 記述ID → 新しい文
  const removed = new Set<string>();
  const now = new Date().toISOString();

  for (const c of corrections.statements) {
    for (const first of byShape.get(shape(c.old[0])) ?? []) {
      if (removed.has(first.id) || replaced.has(first.id)) continue;
      const list = byStar.get(first.starId)!;
      const at = list.indexOf(first);
      const run = list.slice(at, at + c.old.length);
      if (run.length !== c.old.length || run.some((st, i) => !isStarter(st) || shape(st.text) !== shape(c.old[i]))) continue;
      // 直す前の文のリンク（名前）と、端末の文のリンク（ID）を順番に対応させる
      const map = new Map<string, string>();
      run.forEach((st, i) => {
        const ids = linksOf(st.text);
        linksOf(c.old[i]).forEach((name, k) => {
          const id = ids[k]?.startsWith('@') ? ids[k].slice(1) : undefined;
          if (id && !map.has(name)) map.set(name, id);
        });
      });
      run.slice(1).forEach((st) => removed.add(st.id));
      if (c.new === null) {
        removed.add(first.id);
      } else {
        const text = c.new.replace(/\[\[([^\]]*)\]\]/g, (_, name: string) => {
          const id = map.get(name) ?? nameToId.get(name);
          return id ? `[[@${id}]]` : name; // 見つからない名前は、星を新しく作らずにふつうの文字にする
        });
        replaced.set(first.id, text);
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
