// アプリ全体の状態と操作。3D表示やフォームはここを経由してデータを変更する。
// データを変えるときの決まり：docs/ux/03-structure.md「3-3. 変更したときの決まり」
import { create } from 'zustand';
import type {
  CosmosData,
  KnowledgeNode,
  ManualCheck,
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
import { parseLinkIds } from '../lib/knowledge';

/** view: 通常 / move: 星を動かす / connect: 星をつなぐ */
export type Mode = 'view' | 'move' | 'connect';

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
  /** 直前の削除を「元に戻す」ための控え */
  undo: { label: string; snapshot: Data; expiresAt: number } | null;

  init(): Promise<void>;
  select(id: string | null): void;
  setExpanded(v: boolean): void;
  /** リンクなどで別の星へ移動する（道のりに記録し、視点も動かす） */
  navigate(id: string): void;
  goBack(): void;
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
  setCheck(statementId: string, check: ManualCheck, note: string): void;

  addSource(input: SourceInput): Source;
  deleteSource(id: string): void;

  addRelation(sourceId: string, targetId: string, type: RelationType, explanation: string, explanationKind?: Relation['explanationKind']): void;
  deleteRelation(id: string): void;
  cancelConnection(): void;

  undoLast(): void;
  /** 初期セットを今のデータに追加する。追加した星の数を返す */
  addStarterSet(): number;
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
  const nodes = d.nodes.filter((n) => n.status === 'known' || referenced.has(n.id));
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
    undo: null,

    async init() {
      try {
        let data = await repo.load();
        if (!data) {
          data = createSampleData();
          await repo.save(data);
        }
        set({ ...snapshotOf(data), loaded: true });
      } catch (e) {
        const data = createSampleData();
        set({
          ...snapshotOf(data),
          loaded: true,
          error: `端末内のデータを読み込めませんでした。変更は保存されない可能性があります（${e instanceof Error ? e.message : String(e)}）`,
        });
      }
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
        ...input, id: newId(), starId, manualCheck: null, checkNote: '', order, createdAt: t, updatedAt: t,
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
          let manualCheck = st.manualCheck;
          // 本文が変わったら確認し直す必要がある。最後の出典を外したときも同じ
          if (manualCheck === 'verified' && (st.text !== input.text || input.sourceIds.length === 0)) manualCheck = null;
          if (input.kind === 'opinion') manualCheck = null;
          return { ...st, ...input, manualCheck, updatedAt: nowIso() };
        });
        return collectUnknown({ ...d, statements });
      });
    },

    deleteStatement(id) {
      commit((d) => collectUnknown({ ...d, statements: d.statements.filter((st) => st.id !== id) }));
    },

    setCheck(statementId, check, note) {
      const st = get().statements.find((s) => s.id === statementId);
      if (!st || st.kind === 'opinion') return;
      if (check === 'verified' && st.sourceIds.length === 0) {
        set({ error: '「確認済み」にするには、出典を1つ以上付けてください' });
        return;
      }
      commit((d) => ({
        statements: d.statements.map((s) =>
          s.id === statementId ? { ...s, manualCheck: check, checkNote: note, updatedAt: nowIso() } : s,
        ),
      }));
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
          const sourceIds = st.sourceIds.filter((x) => x !== id);
          const manualCheck = st.manualCheck === 'verified' && sourceIds.length === 0 ? null : st.manualCheck;
          return { ...st, sourceIds, manualCheck };
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
        explanationKind, sourceIds: [], manualCheck: null, createdAt: nowIso(),
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

    addStarterSet() {
      const before = snapshotOf(get());
      const { data, added } = mergeDataset(before, createSampleData());
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
