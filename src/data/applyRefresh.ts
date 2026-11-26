// 初期セットの文を、Wikipediaの今の記事に合わせて作り直したとき（scripts/refresh_starter.py）、
// その差し替え一覧（src/data/refresh/<年-月>.json）を端末のデータに反映する。各版は起動時に1回だけ（useCosmos の init）。
//
// 安全のための決まり：
// - 初期セットから入った記述（IDが starter-<キー>-st<番号>）だけを見る。自分で足した記述には触れない
// - その星の初期セットの記述が、差し替え前の文と「数も中身もすべて同じ」ときだけ差し替える
//   （1つでも編集・削除していたら、その星はまるごとそのまま）。リンク先の星の違いは問わない
// - 概要は、差し替え前の概要と全く同じときだけ変える
// - リンクの名前が見つからなければ、星を新しく作らずにふつうの文字にする
import type { CosmosData, KnowledgeNode, Statement } from '../types';
import { displayName } from '../lib/knowledge';

type Data = Omit<CosmosData, 'version'>;

export interface StarterRefresh {
  /** 版の名前（例：2027-05）。ファイル名と同じ */
  version: string;
  stars: {
    /** 初期セットのキー（例：w12）。星のIDは starter-<キー> */
    star: string;
    /** 差し替え前の文（[[名前]] の形） */
    old: string[];
    /** 差し替え後の文（[[名前]] の形）。数は old と違うことがある */
    new: string[];
    oldSummary: string;
    newSummary: string;
  }[];
}

/** リンクの中身を無視した形（[[名前]] と [[@ID]] を同じ印にする） */
const shape = (text: string) => text.replace(/\[\[[^\]]*\]\]/g, '§');
const linksOf = (text: string) => [...text.matchAll(/\[\[([^\]]*)\]\]/g)].map((m) => m[1]);
const STARTER_STATEMENT = /^starter-(.+)-st(\d+)$/;

export function applyRefresh(data: Data, refresh: StarterRefresh): { data: Data; changed: number } {
  const nameToId = new Map<string, string>();
  for (const n of data.nodes) {
    for (const name of [displayName(n), n.title]) if (!nameToId.has(name)) nameToId.set(name, n.id);
  }
  // 初期セットのキー → その星の、初期セットから入った記述（並び順どおり）
  const byKey = new Map<string, Statement[]>();
  for (const st of data.statements) {
    const m = STARTER_STATEMENT.exec(st.id);
    if (!m) continue;
    if (!byKey.has(m[1])) byKey.set(m[1], []);
    byKey.get(m[1])!.push(st);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.order - b.order);

  const usedIds = new Set(data.statements.map((s) => s.id));
  const replaced = new Map<string, string>(); // 記述ID → 新しい文
  const removed = new Set<string>();
  const added: Statement[] = [];
  const summaryOf = new Map<string, { old: string; new: string }>(); // 星ID → 概要の差し替え
  const now = new Date().toISOString();

  for (const e of refresh.stars) {
    const shipped = byKey.get(e.star) ?? [];
    if (shipped.length === 0 || shipped.length !== e.old.length) continue;
    if (shipped.some((st, i) => shape(st.text) !== shape(e.old[i]))) continue;
    const starId = shipped[0].starId;
    if (shipped.some((st) => st.starId !== starId)) continue;

    // 差し替え前の文のリンク（名前）と、端末の文のリンク（ID）を順番に対応させる
    const map = new Map<string, string>();
    shipped.forEach((st, i) => {
      const ids = linksOf(st.text);
      linksOf(e.old[i]).forEach((name, k) => {
        const id = ids[k]?.startsWith('@') ? ids[k].slice(1) : undefined;
        if (id && !map.has(name)) map.set(name, id);
      });
    });
    const toApp = (text: string) =>
      text.replace(/\[\[([^\]]*)\]\]/g, (_, name: string) => {
        const id = map.get(name) ?? nameToId.get(name);
        return id ? `[[@${id}]]` : name;
      });

    e.new.forEach((text, i) => {
      const next = toApp(text);
      if (i < shipped.length) {
        if (next !== shipped[i].text) replaced.set(shipped[i].id, next);
        return;
      }
      // 文が増えたとき：同じ星の最後の記述の直後に足す（自分で足した記述より前になるよう、順番は小数で間に入れる）
      const last = shipped[shipped.length - 1];
      let n = shipped.length;
      while (usedIds.has(`starter-${e.star}-st${n}`)) n++;
      const id = `starter-${e.star}-st${n}`;
      usedIds.add(id);
      added.push({ ...last, id, text: next, order: last.order + (i - shipped.length + 1) / 100, createdAt: now, updatedAt: now });
    });
    shipped.slice(e.new.length).forEach((st) => removed.add(st.id));
    if (e.oldSummary !== e.newSummary) summaryOf.set(starId, { old: e.oldSummary, new: e.newSummary });
  }

  let summaries = 0;
  const nodes: KnowledgeNode[] = data.nodes.map((n) => {
    const s = summaryOf.get(n.id);
    if (!s || n.summary !== s.old) return n;
    summaries++;
    return { ...n, summary: s.new, updatedAt: now };
  });

  const changed = replaced.size + removed.size + added.length + summaries;
  if (changed === 0) return { data, changed };
  const statements = [
    ...data.statements
      .filter((st) => !removed.has(st.id))
      .map((st) => (replaced.has(st.id) ? { ...st, text: replaced.get(st.id)!, updatedAt: now } : st)),
    ...added,
  ];
  return { data: { ...data, nodes, statements }, changed };
}
