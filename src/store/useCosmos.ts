// アプリ全体の状態と操作。3D表示やフォームはここを経由してデータを変更する。
// データを変えるときの決まり：docs/ux/03-structure.md「3-3. 変更したときの決まり」
import { create } from 'zustand';
import type {
  CosmosData,
  KnowledgeNode,
  Relation,
  RelationType,
  Source,
  Statement,
  Vec3,
} from '../types';
import { indexedDbRepository, type CosmosRepository } from '../storage/repository';
import { createSampleData } from '../sampleData';
import { mergeDataset, removeStarter } from '../data/mergeDataset';
import { newId, nowIso } from '../lib/util';
import { addView, mergeEngagement, type EngagementMap } from '../lib/engagement';
import type { CosmosCard } from '../lib/compare';
import { displayName, linkToken, parseLinkIds } from '../lib/knowledge';

/** view: 通常 / connect: 星をつなぐ（星を動かすのは長押しで行う） */
export type Mode = 'view' | 'connect';
/** 宇宙の上に重ねて開く画面 */
export type Panel = 'search' | 'list' | 'more' | 'report' | 'puzzle' | 'compare' | null;
/** 星の名前の表示量 */
export type LabelDensity = 'few' | 'normal' | 'many';

function loadDensity(): LabelDensity {
  try {
    const v = localStorage.getItem('cosmos-label-density');
    return v === 'few' || v === 'many' ? v : 'normal';
  } catch {
    return 'normal';
  }
}

export type NodeInput = Pick<
  KnowledgeNode,
  'title' | 'qualifier' | 'aliases' | 'kind' | 'category' | 'tags' | 'summary' | 'importance'
>;
export type StatementInput = Pick<Statement, 'text' | 'kind' | 'topic' | 'sourceIds'>;
export type SourceInput = Pick<Source, 'type' | 'title' | 'url' | 'author' | 'page'>;

type Data = Omit<CosmosData, 'version'>;

interface CosmosState extends Data {
  loaded: boolean;
  error: string | null;
  selectedId: string | null;
  /** たどった道のり（「戻る」用） */
  trail: string[];
  mode: Mode;
  connectFromId: string | null;
  pendingConnection: { sourceId: string; targetId: string } | null;
  focus: { id: string; nonce: number } | null;
  /** 星のプレビュー（false）か、星のページ全体（true）か */
  expanded: boolean;
  panel: Panel;
  labelDensity: LabelDensity;
  /** 長押しで動かしている星 */
  draggingId: string | null;
  /** 関わり方の記録（星を開いた回数など）。知識のデータとは別に保存する */
  engagement: EngagementMap;
  /** 友達の宇宙と重ねて表示しているとき：友達の宇宙カード */
  overlay: { card: CosmosCard } | null;
  /** 直前の削除を「元に戻す」ための控え */
  undo: { label: string; snapshot: Data; expiresAt: number } | null;

  init(): Promise<void>;
  /** 星を開いたことを記録する */
  recordView(id: string): void;
  setOverlay(overlay: { card: CosmosCard } | null): void;
  /** バックアップにあった関わり方の記録を、今の記録に合わせる（減らさない） */
  mergeEngagementFrom(map: EngagementMap): void;
  select(id: string | null): void;
  setExpanded(v: boolean): void;
  /** リンクなどで別の星へ移動する（道のりに記録し、視点も動かす） */
  navigate(id: string): void;
  goBack(): void;
  /** 道のりの途中の星まで戻る */
  goToTrail(index: number): void;
  openPanel(panel: Panel): void;
  setLabelDensity(v: LabelDensity): void;
  /** バックアップから復元する（今のデータを置き換える。直後は元に戻せる） */
  replaceAll(data: CosmosData): void;
  setMode(mode: Mode): void;
  focusOn(id: string): void;
  tapNode(id: string): void;

  addNode(input: NodeInput, position: Vec3): KnowledgeNode;
  updateNode(id: string, input: NodeInput): void;
  deleteNode(id: string): void;
  moveNode(id: string, position: Vec3, persist: boolean): void;
  /** まだ知らない星を作る（リンクの挿入用）。同じ名前があればそれを返す */
  ensureStar(title: string, nearId: string | null): KnowledgeNode;

  addStatement(starId: string, input: StatementInput): Statement;
  updateStatement(id: string, input: StatementInput): void;
  deleteStatement(id: string): void;

  addSource(input: SourceInput): Source;
  deleteSource(id: string): void;

  addRelation(sourceId: string, targetId: string, type: RelationType, explanation: string, explanationKind?: Relation['explanationKind']): void;
  deleteRelation(id: string): void;
  cancelConnection(): void;

  undoLast(): void;
  /** Wikipediaの概要から選んだ文で星を登録する（出典は自動で付く） */
  registerFromWikipedia(
    starId: string,
    input: {
      summary: string;
      sentences: (string | { text: string; topic: string })[];
      articleTitle: string;
      url: string;
      /** 出典の名前（省略時は「Wikipedia：記事名」） */
      sourceTitle?: string;
    },
  ): void;
  /** 名前の一覧のうち、宇宙にまだない言葉を最大limit個、「まだ知らない星」としてもとの星の周りに生やす。生えた数を返す */
  seedStars(starId: string, names: string[], limit: number): number;
  /** 記述の中の言葉をリンクにする（宇宙にない言葉は「まだ知らない星」を作る）。リンク先の星IDを返す */
  linkWordInStatement(statementId: string, word: string): string | null;
  /** この星に使うWikipediaの記事を覚える */
  setWikiTitle(starId: string, title: string | undefined): void;
  /** 初期セットを今のデータに追加する。追加した星の数を返す */
  addStarterSet(): Promise<number>;
  /** 初期セットをまとめて削除する（自分で記述を足した星は残す）。削除した星の数を返す */
  removeStarterSet(): number;
}

const repo: CosmosRepository = indexedDbRepository;

function snapshotOf(s: Data): Data {
  return { nodes: s.nodes, statements: s.statements, sources: s.sources, relations: s.relations };
}

/**
 * どこからもリンクされず、つながりもない「まだ知らない星」を消す。
 * 中身のない星が宇宙に取り残されないようにするため。
 */
function collectUnknown(d: Data): Data {
  const referenced = new Set<string>();
  for (const st of d.statements) for (const id of parseLinkIds(st.text)) referenced.add(id);
  for (const r of d.relations) {
    referenced.add(r.sourceNodeId);
    referenced.add(r.targetNodeId);
  }
  // 「広げる」で生まれた星は、もとの星が（登録済みのまま）残っている間は残す
  const known = new Set(d.nodes.filter((n) => n.status === 'known').map((n) => n.id));
  const nodes = d.nodes.filter((n) => n.status === 'known' || referenced.has(n.id) || (n.seedOf && known.has(n.seedOf)));
  return nodes.length === d.nodes.length ? d : { ...d, nodes };
}

export const useCosmos = create<CosmosState>((set, get) => {
  const persist = () => {
    const s = get();
    repo.save({ version: 2, ...snapshotOf(s) }).catch((e: unknown) => {
      set({ error: `保存に失敗しました: ${e instanceof Error ? e.message : String(e)}` });
    });
  };

  /** データを変更して保存する共通の入口 */
  const commit = (fn: (d: Data) => Partial<Data>) => {
    set((s) => fn(snapshotOf(s)));
    persist();
  };

  return {
    nodes: [],
    statements: [],
    sources: [],
    relations: [],
    loaded: false,
    error: null,
    selectedId: null,
    trail: [],
    mode: 'view',
    connectFromId: null,
    pendingConnection: null,
    focus: null,
    expanded: false,
    panel: null,
    labelDensity: loadDensity(),
    draggingId: null,
    engagement: {},
    overlay: null,
    undo: null,

    async init() {
      try {
        set({ engagement: await repo.loadEngagement() });
      } catch {
        // 関わり方の記録が読めなくても、知識のデータは使えるようにする
      }
      try {
        let data = await repo.load();
        // 初期セットの版。中身（雑学など）を増やしたら上げる。上げると、足りない記述だけが1回補われる
        const STARTER_FLAG = 'starter-v4-added';
        const SPREAD_FLAG = 'layout-spread-v1';
        if (!data) {
          data = await createSampleData();
          await repo.save(data);
          await repo.setFlag(STARTER_FLAG);
          await repo.setFlag(SPREAD_FLAG);
          set({ ...snapshotOf(data), loaded: true });
          return;
        }
        // 既存データのある端末にも、初期セットを最初の1回だけ自動で追加する。
        // 一度入れたら（その後まとめて削除しても）二度と自動では入れない
        // 星が詰まりすぎていたので、既存の配置を1回だけ全体に広げる（並びの形はそのまま、間隔だけ1.6倍）
        if (!(await repo.getFlag(SPREAD_FLAG)) && data.nodes.length > 1) {
          const c = [0, 1, 2].map((k) => data!.nodes.reduce((sum, n) => sum + n.position[k], 0) / data!.nodes.length);
          data = {
            ...data,
            nodes: data.nodes.map((n) => ({ ...n, position: n.position.map((v, k) => c[k] + (v - c[k]) * 1.6) as typeof n.position })),
          };
          await repo.save(data);
          await repo.setFlag(SPREAD_FLAG);
        }
        // 以前の版を入れた後に、初期セットをまとめて削除していた人には入れない
        const removedBefore = (await repo.getFlag('starter-v1-added')) && !data.nodes.some((n) => n.origin === 'starter' && n.status === 'known');
        if (removedBefore) await repo.setFlag(STARTER_FLAG);
        else if (!(await repo.getFlag(STARTER_FLAG))) {
          const before = snapshotOf(data);
          const { data: merged, added } = mergeDataset(before, await createSampleData());
          await repo.save({ version: 2, ...merged });
          await repo.setFlag(STARTER_FLAG);
          set({
            ...merged,
            loaded: true,
            undo: {
              label: added > 0 ? `初期セット（${added}個）を追加しました` : '初期セットの内容（雑学など）を補いました',
              snapshot: before,
              expiresAt: Date.now() + 10000,
            },
          });
          return;
        }
        set({ ...snapshotOf(data), loaded: true });
      } catch (e) {
        const data = await createSampleData();
        set({
          ...snapshotOf(data),
          loaded: true,
          error: `端末内のデータを読み込めませんでした。変更は保存されない可能性があります（${e instanceof Error ? e.message : String(e)}）`,
        });
      }
    },

    recordView(id) {
      const engagement = addView(get().engagement, id);
      set({ engagement });
      repo.saveEngagement(engagement).catch((e: unknown) => {
        set({ error: `関わり方の記録を保存できませんでした: ${e instanceof Error ? e.message : String(e)}` });
      });
    },

    setOverlay(overlay) {
      set({ overlay });
    },

    mergeEngagementFrom(map) {
      const engagement = mergeEngagement(get().engagement, map);
      set({ engagement });
      repo.saveEngagement(engagement).catch(() => undefined);
    },

    select(id) {
      set({ selectedId: id, trail: id ? get().trail : [], expanded: id ? get().expanded : false });
    },

    setExpanded(v) {
      set({ expanded: v });
    },

    navigate(id) {
      const { selectedId, trail } = get();
      if (id === selectedId) return;
      set({
        selectedId: id,
        trail: selectedId ? [...trail, selectedId].slice(-50) : trail,
        focus: { id, nonce: Date.now() },
      });
    },

    goBack() {
      const { trail } = get();
      const prev = trail[trail.length - 1];
      if (!prev) return;
      set({ selectedId: prev, trail: trail.slice(0, -1), focus: { id: prev, nonce: Date.now() } });
    },

    goToTrail(index) {
      const { trail } = get();
      const target = trail[index];
      if (!target) return;
      set({ selectedId: target, trail: trail.slice(0, index), focus: { id: target, nonce: Date.now() } });
    },

    openPanel(panel) {
      set({ panel });
    },

    setLabelDensity(v) {
      try {
        localStorage.setItem('cosmos-label-density', v);
      } catch {
        /* 保存できなくても表示は切り替える */
      }
      set({ labelDensity: v });
    },

    replaceAll(data) {
      const before = snapshotOf(get());
      set({
        ...snapshotOf(data),
        selectedId: null,
        trail: [],
        undo: { label: 'バックアップから復元しました', snapshot: before, expiresAt: Date.now() + 10000 },
      });
      persist();
    },

    setMode(mode) {
      const { selectedId } = get();
      set({ mode, connectFromId: mode === 'connect' ? selectedId : null, pendingConnection: null });
    },

    focusOn(id) {
      set({ focus: { id, nonce: Date.now() } });
    },

    tapNode(id) {
      const { mode, connectFromId } = get();
      if (mode === 'connect') {
        if (!connectFromId) set({ connectFromId: id, selectedId: id });
        else if (connectFromId !== id) set({ pendingConnection: { sourceId: connectFromId, targetId: id } });
        return;
      }
      set({ selectedId: id, trail: [], expanded: false });
    },

    addNode(input, position) {
      const t = nowIso();
      const node: KnowledgeNode = {
        ...input, id: newId(), status: 'known', position, origin: 'user', createdAt: t, updatedAt: t,
      };
      commit((d) => ({ nodes: [...d.nodes, node] }));
      set({ selectedId: node.id });
      return node;
    },

    updateNode(id, input) {
      // まだ知らない星も、編集して保存したら「登録済み」になる
      commit((d) => ({
        // 自分で編集した初期セットの星は「自分の星」として扱う（まとめて削除の対象から外す）
        nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...input, status: 'known', origin: n.origin === 'starter' ? 'user' : n.origin, updatedAt: nowIso() } : n)),
      }));
    },

    deleteNode(id) {
      const before = snapshotOf(get());
      const node = before.nodes.find((n) => n.id === id);
      if (!node) return;
      const linkedFromOthers = before.statements.some((st) => st.starId !== id && parseLinkIds(st.text).includes(id));
      let next: Data = {
        // 他の星からリンクされていれば「まだ知らない星」に戻す（リンクは残る）
        nodes: linkedFromOthers
          ? before.nodes.map((n) =>
              n.id === id ? { ...n, status: 'unknown', summary: '', aliases: [], tags: [], updatedAt: nowIso() } : n,
            )
          : before.nodes.filter((n) => n.id !== id),
        statements: before.statements.filter((st) => st.starId !== id),
        sources: before.sources, // 出典は残す
        relations: before.relations.filter((r) => r.sourceNodeId !== id && r.targetNodeId !== id),
      };
      next = collectUnknown(next);
      set((s) => ({
        ...next,
        selectedId: s.selectedId === id && !linkedFromOthers ? null : s.selectedId,
        connectFromId: s.connectFromId === id ? null : s.connectFromId,
        trail: s.trail.filter((x) => next.nodes.some((n) => n.id === x)),
        undo: { label: `「${node.title}」を削除しました`, snapshot: before, expiresAt: Date.now() + 8000 },
      }));
      persist();
    },

    moveNode(id, position, shouldPersist) {
      set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, position } : n)) }));
      if (shouldPersist) persist();
    },

    ensureStar(title, nearId) {
      const name = title.trim();
      const existing = get().nodes.find((n) => n.title === name && !n.qualifier);
      if (existing) return existing;
      const near = get().nodes.find((n) => n.id === nearId);
      const base = near?.position ?? [0, 0, 0];
      const a = Math.random() * Math.PI * 2;
      const t = nowIso();
      const node: KnowledgeNode = {
        id: newId(), status: 'unknown', title: name, qualifier: '', aliases: [], kind: 'other', category: '',
        tags: [], summary: '', importance: 1,
        position: [base[0] + Math.cos(a) * 2.2, base[1] + (Math.random() - 0.5) * 2, base[2] + Math.sin(a) * 2.2],
        origin: 'user', createdAt: t, updatedAt: t,
      };
      commit((d) => ({ nodes: [...d.nodes, node] }));
      return node;
    },

    addStatement(starId, input) {
      const t = nowIso();
      const order = Math.max(-1, ...get().statements.filter((s) => s.starId === starId).map((s) => s.order)) + 1;
      const st: Statement = {
        ...input, id: newId(), starId, order, createdAt: t, updatedAt: t,
      };
      commit((d) => ({
        statements: [...d.statements, st],
        // 記述を書いた星は「登録済み」になる
        nodes: d.nodes.map((n) => (n.id === starId && n.status === 'unknown' ? { ...n, status: 'known', updatedAt: t } : n)),
      }));
      return st;
    },

    updateStatement(id, input) {
      commit((d) => {
        const statements = d.statements.map((st) => {
          if (st.id !== id) return st;
          return { ...st, ...input, updatedAt: nowIso() };
        });
        return collectUnknown({ ...d, statements });
      });
    },

    deleteStatement(id) {
      commit((d) => collectUnknown({ ...d, statements: d.statements.filter((st) => st.id !== id) }));
    },

    addSource(input) {
      const src: Source = { ...input, id: newId(), addedAt: nowIso() };
      commit((d) => ({ sources: [...d.sources, src] }));
      return src;
    },

    deleteSource(id) {
      commit((d) => ({
        sources: d.sources.filter((s) => s.id !== id),
        statements: d.statements.map((st) => {
          if (!st.sourceIds.includes(id)) return st;
          return { ...st, sourceIds: st.sourceIds.filter((x) => x !== id) };
        }),
        relations: d.relations.map((r) => (r.sourceIds.includes(id) ? { ...r, sourceIds: r.sourceIds.filter((x) => x !== id) } : r)),
      }));
    },

    addRelation(sourceId, targetId, type, explanation, explanationKind = 'fact') {
      const { nodes, relations } = get();
      const exists = (id: string) => nodes.some((n) => n.id === id);
      if (!exists(sourceId) || !exists(targetId) || sourceId === targetId) return;
      // 同じ2つの星でも、種類が違えば複数作れる（構造の層の決まり）
      const duplicate = relations.some(
        (r) =>
          r.relationType === type &&
          ((r.sourceNodeId === sourceId && r.targetNodeId === targetId) ||
            (r.sourceNodeId === targetId && r.targetNodeId === sourceId)),
      );
      if (duplicate) {
        set({ error: 'この2つの星は、同じ種類ですでにつながっています', pendingConnection: null });
        return;
      }
      const relation: Relation = {
        id: newId(), sourceNodeId: sourceId, targetNodeId: targetId, relationType: type, explanation,
        explanationKind, sourceIds: [], createdAt: nowIso(),
      };
      commit((d) => ({ relations: [...d.relations, relation] }));
      set({ pendingConnection: null, connectFromId: null, mode: 'view', selectedId: sourceId });
    },

    deleteRelation(id) {
      commit((d) => collectUnknown({ ...d, relations: d.relations.filter((r) => r.id !== id) }));
    },

    cancelConnection() {
      set({ pendingConnection: null });
    },

    registerFromWikipedia(starId, input) {
      // 文の中の [[言葉]] を星へのリンクにする。宇宙にない言葉は「まだ知らない星」として作る
      const resolve = (text: string) =>
        text.replace(/\[\[([^\]@][^\]]*)\]\]/g, (_, raw: string) => {
          const name = raw.trim();
          const { nodes } = get();
          const found =
            nodes.find((n) => displayName(n) === name) ??
            nodes.find((n) => n.title === name) ??
            nodes.find((n) => n.aliases.includes(name));
          return linkToken((found ?? get().ensureStar(name, starId)).id);
        });
      input = {
        ...input,
        sentences: input.sentences.map((item) =>
          typeof item === 'string' ? resolve(item) : { ...item, text: resolve(item.text) },
        ),
      };
      const t = nowIso();
      const sourceTitle = input.sourceTitle ?? `Wikipedia：${input.articleTitle}`;
      const existing = get().sources.find((src) => src.url === input.url || src.title === sourceTitle);
      const source: Source = existing ?? {
        id: newId(), type: 'web', title: sourceTitle, url: input.url, author: '', page: '', addedAt: t,
      };
      commit((d) => {
        const baseOrder = Math.max(-1, ...d.statements.filter((st) => st.starId === starId).map((st) => st.order)) + 1;
        const added: Statement[] = input.sentences.map((item, i) => ({
          id: newId(), starId, text: typeof item === 'string' ? item : item.text, kind: 'fact',
          topic: typeof item === 'string' ? '' : item.topic, sourceIds: [source.id],
          order: baseOrder + i, createdAt: t, updatedAt: t,
        }));
        return {
          sources: existing ? d.sources : [...d.sources, source],
          statements: [...d.statements, ...added],
          nodes: d.nodes.map((n) =>
            n.id === starId
              ? {
                  ...n,
                  status: 'known',
                  summary: n.summary || input.summary,
                  importance: n.status === 'unknown' ? 2 : n.importance,
                  origin: n.status === 'unknown' ? 'wikipedia' : n.origin,
                  updatedAt: t,
                }
              : n,
          ),
        };
      });
      set({ expanded: true });
    },

    seedStars(starId, names, limit) {
      const { nodes } = get();
      const parent = nodes.find((n) => n.id === starId);
      if (!parent) return 0;
      const exists = new Set<string>();
      for (const n of nodes) for (const nm of [n.title, displayName(n), ...n.aliases]) exists.add(nm);
      const fresh = [...new Set(names)].filter((nm) => nm.length >= 2 && !exists.has(nm)).slice(0, limit);
      const t = nowIso();
      const created: KnowledgeNode[] = fresh.map((title, i) => {
        // もとの星を中心に、球面上に散らして置く
        const y = 1 - (2 * (i + 0.5)) / fresh.length;
        const r = Math.sqrt(1 - y * y);
        const th = i * 2.399 + Math.random();
        const R = 2.6 + Math.random() * 1.2;
        return {
          id: newId(), status: 'unknown', title, qualifier: '', aliases: [], kind: 'other', category: '', tags: [],
          summary: '', importance: 1, origin: 'user', seedOf: starId, createdAt: t, updatedAt: t,
          position: [parent.position[0] + Math.cos(th) * r * R, parent.position[1] + y * R, parent.position[2] + Math.sin(th) * r * R],
        };
      });
      if (created.length) commit((d) => ({ nodes: [...d.nodes, ...created] }));
      return created.length;
    },

    linkWordInStatement(statementId, word) {
      const w = word.trim();
      const st = get().statements.find((x) => x.id === statementId);
      if (!st || w.length < 1) return null;
      // すでにリンクになっている部分（[[@ID]]）の外から、最初に出てくる場所を探す
      const parts = st.text.split(/(\[\[@[^\]]+\]\])/);
      const idx = parts.findIndex((p) => !p.startsWith('[[@') && p.includes(w));
      if (idx < 0) return null;
      const { nodes } = get();
      const target =
        nodes.find((n) => displayName(n) === w) ?? nodes.find((n) => n.title === w) ?? nodes.find((n) => n.aliases.includes(w)) ?? get().ensureStar(w, st.starId);
      if (target.id === st.starId) return null; // 自分自身へのリンクは作らない
      parts[idx] = parts[idx].replace(w, linkToken(target.id));
      const text = parts.join('');
      // 文の中身は変わらない（リンクを付けただけ）ので、確認状態はそのまま保つ
      commit((d) => ({ statements: d.statements.map((x) => (x.id === statementId ? { ...x, text, updatedAt: nowIso() } : x)) }));
      return target.id;
    },

    setWikiTitle(starId, title) {
      commit((d) => ({ nodes: d.nodes.map((n) => (n.id === starId ? { ...n, wikiTitle: title } : n)) }));
    },

    async addStarterSet() {
      const sample = await createSampleData();
      const before = snapshotOf(get());
      const { data, added } = mergeDataset(before, sample);
      set({ ...data, undo: { label: `初期セットを追加しました（${added}個）`, snapshot: before, expiresAt: Date.now() + 8000 } });
      persist();
      return added;
    },

    removeStarterSet() {
      const before = snapshotOf(get());
      const { data, removed } = removeStarter(before);
      set((s) => ({
        ...data,
        selectedId: data.nodes.some((n) => n.id === s.selectedId) ? s.selectedId : null,
        trail: [],
        undo: { label: `初期セットを削除しました（${removed}個）`, snapshot: before, expiresAt: Date.now() + 8000 },
      }));
      persist();
      return removed;
    },

    undoLast() {
      const { undo } = get();
      if (!undo) return;
      set({ ...undo.snapshot, undo: null });
      persist();
    },
  };
});

export function clearError() {
  useCosmos.setState({ error: null });
}

// 星が選ばれたら（タップ・リンク・検索など、どの方法でも）「開いた」と記録する
useCosmos.subscribe((s, prev) => {
  if (s.loaded && s.selectedId && s.selectedId !== prev.selectedId) s.recordView(s.selectedId);
});
