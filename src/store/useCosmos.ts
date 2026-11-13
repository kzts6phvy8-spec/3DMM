// アプリ全体の状態と操作。3D表示やフォームはここを経由してデータを変更する。
import { create } from 'zustand';
import type { CosmosData, KnowledgeNode, Relation, RelationType, Vec3 } from '../types';
import { indexedDbRepository, type CosmosRepository } from '../storage/repository';
import { createSampleData } from '../sampleData';
import { newId, nowIso } from '../lib/util';

/** view: 通常 / move: 星を動かす / connect: 星をつなぐ */
export type Mode = 'view' | 'move' | 'connect';

export type NodeInput = Pick<KnowledgeNode, 'title' | 'description' | 'category' | 'tags' | 'sourceUrl' | 'importance'>;

interface CosmosState extends CosmosData {
  loaded: boolean;
  error: string | null;
  selectedId: string | null;
  mode: Mode;
  /** 接続モードで最初に選んだ星 */
  connectFromId: string | null;
  /** 接続先が決まり、関係の種類を入力中のペア */
  pendingConnection: { sourceId: string; targetId: string } | null;
  /** カメラを向ける先（焦点移動用）。nonce は同じ星を再度選んでも動かすため */
  focus: { id: string; nonce: number } | null;

  init(): Promise<void>;
  select(id: string | null): void;
  setMode(mode: Mode): void;
  focusOn(id: string): void;
  tapNode(id: string): void;

  addNode(input: NodeInput, position: Vec3): KnowledgeNode;
  updateNode(id: string, input: NodeInput): void;
  deleteNode(id: string): void;
  moveNode(id: string, position: Vec3, persist: boolean): void;

  addRelation(sourceId: string, targetId: string, type: RelationType, explanation: string): void;
  deleteRelation(id: string): void;
  cancelConnection(): void;
}

const repo: CosmosRepository = indexedDbRepository;

export const useCosmos = create<CosmosState>((set, get) => {
  /** 現在のデータを端末に保存する。失敗したら画面にエラーを出す */
  const persist = () => {
    const { nodes, relations } = get();
    repo.save({ nodes, relations }).catch((e: unknown) => {
      set({ error: `保存に失敗しました: ${e instanceof Error ? e.message : String(e)}` });
    });
  };

  return {
    nodes: [],
    relations: [],
    loaded: false,
    error: null,
    selectedId: null,
    mode: 'view',
    connectFromId: null,
    pendingConnection: null,
    focus: null,

    async init() {
      try {
        let data = await repo.load();
        if (!data) {
          data = createSampleData();
          await repo.save(data);
        }
        set({ nodes: data.nodes, relations: data.relations, loaded: true });
      } catch (e) {
        // 保存領域が使えない場合（プライベートブラウズ等）でもサンプルで動かす
        const data = createSampleData();
        set({
          ...data,
          loaded: true,
          error: `端末内のデータを読み込めませんでした。変更は保存されない可能性があります（${e instanceof Error ? e.message : String(e)}）`,
        });
      }
    },

    select(id) {
      set({ selectedId: id });
    },

    setMode(mode) {
      const { selectedId } = get();
      set({
        mode,
        connectFromId: mode === 'connect' ? selectedId : null,
        pendingConnection: null,
      });
    },

    focusOn(id) {
      set({ focus: { id, nonce: Date.now() } });
    },

    tapNode(id) {
      const { mode, connectFromId } = get();
      if (mode === 'connect') {
        if (!connectFromId) {
          set({ connectFromId: id, selectedId: id });
        } else if (connectFromId !== id) {
          set({ pendingConnection: { sourceId: connectFromId, targetId: id } });
        }
        return;
      }
      set({ selectedId: id });
    },

    addNode(input, position) {
      const t = nowIso();
      const node: KnowledgeNode = { ...input, id: newId(), createdAt: t, updatedAt: t, position };
      set((s) => ({ nodes: [...s.nodes, node], selectedId: node.id }));
      persist();
      return node;
    },

    updateNode(id, input) {
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...input, updatedAt: nowIso() } : n)),
      }));
      persist();
    },

    deleteNode(id) {
      // 星を消すときは、その星につながる線も一緒に消して整合性を保つ
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== id),
        relations: s.relations.filter((r) => r.sourceNodeId !== id && r.targetNodeId !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        connectFromId: s.connectFromId === id ? null : s.connectFromId,
      }));
      persist();
    },

    moveNode(id, position, shouldPersist) {
      set((s) => ({
        nodes: s.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
      }));
      if (shouldPersist) persist();
    },

    addRelation(sourceId, targetId, type, explanation) {
      const { nodes, relations } = get();
      const exists = (id: string) => nodes.some((n) => n.id === id);
      if (!exists(sourceId) || !exists(targetId) || sourceId === targetId) return;
      const duplicate = relations.some(
        (r) =>
          (r.sourceNodeId === sourceId && r.targetNodeId === targetId) ||
          (r.sourceNodeId === targetId && r.targetNodeId === sourceId),
      );
      if (duplicate) {
        set({ error: 'この2つの星はすでにつながっています', pendingConnection: null });
        return;
      }
      const relation: Relation = {
        id: newId(),
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        relationType: type,
        explanation,
        createdAt: nowIso(),
      };
      set((s) => ({
        relations: [...s.relations, relation],
        pendingConnection: null,
        connectFromId: null,
        mode: 'view',
        selectedId: sourceId,
      }));
      persist();
    },

    deleteRelation(id) {
      set((s) => ({ relations: s.relations.filter((r) => r.id !== id) }));
      persist();
    },

    cancelConnection() {
      set({ pendingConnection: null });
    },
  };
});

export function clearError() {
  useCosmos.setState({ error: null });
}
