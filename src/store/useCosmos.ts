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
import { fixMemoData, mergeDataset, removeStarter } from '../data/mergeDataset';
import { applyCorrections, type Corrections } from '../data/applyCorrections';
import { fixKanaLinksInData } from '../lib/kanaLinks';
import { applyRefresh } from '../data/applyRefresh';
import { REFRESH_VERSIONS, loadRefresh, refreshFlag } from '../data/refresh';
import { newId, nowIso } from '../lib/util';
import { addView, mergeEngagement, type EngagementMap } from '../lib/engagement';
import { addDay, mergeDays } from '../lib/streak';
import { dateKey } from '../lib/day';
import type { CosmosCard } from '../lib/compare';
import { displayName, linkToken, parseLinkIds } from '../lib/knowledge';
import { scheduleWarmup } from '../lib/warmup';
import { track } from '../lib/analytics';
import type { AiSearchResult } from '../ai/search';
import type { ViewBasis } from '../lib/sceneApi';

/** view: 通常 / connect: 星をつなぐ（星を動かすのは長押しで行う） */
export type Mode = 'view' | 'connect';
/** 宇宙の上に重ねて開く画面 */
export type Panel = 'search' | 'list' | 'more' | 'report' | 'compare' | 'quiz' | null;
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
  /** 宇宙とリストに、自分の星だけを出す（初期セットの星は隠れるだけで消えない）。開き直すと元に戻る */
  ownOnly: boolean;
  setOwnOnly(v: boolean): void;
  /** 長押しで動かしている星 */
  draggingId: string | null;
  /** 関わり方の記録（星を開いた回数など）。知識のデータとは別に保存する */
  engagement: EngagementMap;
  /** 連続記録：クイズをやった日の一覧（廃止したパズルの日も残る） */
  activityDays: string[];
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
  /** 今日、クイズをやったと記録する（連続記録） */
  recordActivity(): void;
  mergeActivityFrom(days: string[]): void;
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
  /** label を null にすると「元に戻す」を出さない */
  replaceAll(data: CosmosData, label?: string | null): void;
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
  /** AIで調べた結果を、星（登録済み）と枝の星・つながりにする。できた星のIDを返す */
  applyAiSearch(result: AiSearchResult, targetId: string | null, position: Vec3, view?: ViewBasis): { id: string; added: number; linked: number };
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

/**
 * 名前から星を探す。「名前（補足）」と完全に同じ星 → 補足のない同じ名前の星 → 別名 の順。
 * 名前だけのときに、補足の付いた別の意味の星（例：「回転」→「回転（スキー）」）へつながないようにする。
 */
function findByName(nodes: KnowledgeNode[], name: string): KnowledgeNode | undefined {
  return (
    nodes.find((n) => displayName(n) === name) ??
    nodes.find((n) => !n.qualifier && n.title === name) ??
    nodes.find((n) => n.aliases.includes(name))
  );
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
    ownOnly: false,
    draggingId: null,
    engagement: {},
    activityDays: [],
    overlay: null,
    undo: null,

    async init() {
      try {
        set({ engagement: await repo.loadEngagement(), activityDays: await repo.loadActivity() });
      } catch {
        // 関わり方の記録が読めなくても、知識のデータは使えるようにする
      }
      try {
        let data = await repo.load();
        // メモの扱いをそろえる（メモから作った星は「自分の星」、初期セットの星に書き足されていたメモの文は消す。src/data/mergeDataset.ts）
        if (data) {
          const before = snapshotOf(data);
          const fixed = fixMemoData(before);
          if (fixed !== before) {
            data = { version: 2, ...collectUnknown(fixed) };
            await repo.save(data);
          }
        }
        // 初期セットの版。中身（雑学など）を増やしたら上げる。上げると、足りない記述だけが1回補われる
        const STARTER_FLAG = 'starter-v7-added';
        const SPREAD_FLAG = 'layout-spread-v1';
        // 初期セットの壊れた記述を直した版。直し方（corrections.json）を増やしたら上げる
        const FIX_FLAG = 'corrections-v4';
        // ひらがなの名前へのリンクが言葉の途中に付いていたのを外した版（例：植[[えら]]れて）
        const KANA_FLAG = 'kana-links-v2';
        if (!data) {
          data = await createSampleData();
          await repo.save(data);
          await repo.setFlag(STARTER_FLAG);
          await repo.setFlag(SPREAD_FLAG);
          await repo.setFlag(FIX_FLAG);
          await repo.setFlag(KANA_FLAG);
          // 初期セットはいちばん新しい文で作られるので、文の作り直し（差し替え一覧）は済んだことにする
          for (const v of REFRESH_VERSIONS) await repo.setFlag(refreshFlag(v));
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
        // 初期セットの壊れた記述（文の途中から始まる・かっこが合わない など）を、1回だけ直す。
        // 壊れた文と全く同じ文だけを置き換えるので、自分で編集した記述は変わらない
        if (!(await repo.getFlag(FIX_FLAG))) {
          const corrections = (await import('../data/corrections.json')).default as unknown as Corrections;
          const { data: fixed, changed } = applyCorrections(snapshotOf(data), corrections);
          if (changed > 0) {
            data = { version: 2, ...collectUnknown(fixed) };
            await repo.save(data);
          }
          await repo.setFlag(FIX_FLAG);
        }
        // 初期セットの記述で、ひらがなの名前（えら・もつ など）へのリンクが言葉の途中に付いていたものを、1回だけ外す
        if (!(await repo.getFlag(KANA_FLAG))) {
          const { data: fixed, changed } = fixKanaLinksInData(snapshotOf(data));
          if (changed > 0) {
            data = { version: 2, ...collectUnknown(fixed) };
            await repo.save(data);
          }
          await repo.setFlag(KANA_FLAG);
        }
        // 初期セットの文を、Wikipediaの今の記事に合わせて作り直した分を、版ごとに1回だけ反映する（src/data/applyRefresh.ts）。
        // 初期セットのまま変えていない星だけを差し替える。自分で編集・削除した記述がある星はそのまま
        for (const v of REFRESH_VERSIONS) {
          if (await repo.getFlag(refreshFlag(v))) continue;
          const { data: fixed, changed } = applyRefresh(snapshotOf(data), await loadRefresh(v));
          if (changed > 0) {
            data = { version: 2, ...collectUnknown(fixed) };
            await repo.save(data);
          }
          await repo.setFlag(refreshFlag(v));
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
      track('star_opened');
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

    recordActivity() {
      const before = get().activityDays;
      const activityDays = addDay(before, dateKey(new Date()));
      if (activityDays === before) return;
      set({ activityDays });
      repo.saveActivity(activityDays).catch((e: unknown) => {
        set({ error: `連続記録を保存できませんでした: ${e instanceof Error ? e.message : String(e)}` });
      });
    },

    mergeActivityFrom(days) {
      const activityDays = mergeDays(get().activityDays, days);
      set({ activityDays });
      repo.saveActivity(activityDays).catch(() => undefined);
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

    setOwnOnly(v) {
      set({ ownOnly: v });
    },

    setLabelDensity(v) {
      try {
        localStorage.setItem('cosmos-label-density', v);
      } catch {
        /* 保存できなくても表示は切り替える */
      }
      set({ labelDensity: v });
    },

    replaceAll(data, label = 'バックアップから復元しました') {
      const before = snapshotOf(get());
      set({
        // どこからも参照されない「まだ知らない星」は取り除く（データの決まり）。メモの扱いもそろえる
        ...collectUnknown(fixMemoData(snapshotOf(data))),
        selectedId: null,
        trail: [],
        undo: label === null ? null : { label, snapshot: before, expiresAt: Date.now() + 10000 },
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
      // 宇宙の中で星をタップしたら、その星へ移る（前の星は「戻る」で戻れる）。カメラも合わせる
      if (get().selectedId) get().navigate(id);
      else set({ selectedId: id, trail: [], expanded: false, focus: { id, nonce: Date.now() } });
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
          const found = findByName(nodes, name);
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

    applyAiSearch(result, targetId, position, view = { right: [1, 0, 0], up: [0, 1, 0] }) {
      const before = snapshotOf(get());
      const t = nowIso();
      const nodes = [...before.nodes];
      const sources = [...before.sources];
      const statements = [...before.statements];
      const relations = [...before.relations];
      const norm = (x: string) => x.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
      // 名前だけ（補足なし）のときは、補足の付いた別の意味の星（例：回転（スキー））にはつながない
      const findStar = (name: string) => {
        const k = norm(name);
        return (
          nodes.find((n) => norm(displayName(n)) === k) ??
          nodes.find((n) => !n.qualifier && norm(n.title) === k) ??
          nodes.find((n) => n.aliases.some((a) => norm(a) === k))
        );
      };

      // ---- 調べた言葉の星（なければ作る） ----
      let main =
        (targetId && nodes.find((n) => n.id === targetId)) ||
        findStar(result.qualifier ? `${result.title}（${result.qualifier}）` : result.title);
      if (!main) {
        // 枝の中に宇宙にすでにある星があれば、その近くに置く（つながりの線が短く、見つけやすい）
        const anchor = result.branches.map((b) => findStar(b.name)).find((n) => n);
        if (anchor) {
          // 画面で見て上か下の位置（名前は横に長いので、左右に並べると重なる）
          const a = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 + (Math.random() - 0.5) * 0.8;
          const q = anchor.position;
          const [cx, cy] = [Math.cos(a) * 14, Math.sin(a) * 14];
          position = [0, 1, 2].map((k) => q[k] + view.right[k] * cx + view.up[k] * cy) as Vec3;
        }
        main = {
          id: newId(), status: 'known', title: result.title, qualifier: result.qualifier, aliases: [], kind: result.kind,
          category: '', tags: [], summary: result.summary, importance: 2, position, origin: 'user', createdAt: t, updatedAt: t,
        };
        nodes.push(main);
      } else {
        const m: KnowledgeNode = main;
        const updated: KnowledgeNode = {
          ...m,
          status: 'known',
          summary: m.summary || result.summary,
          kind: m.status === 'unknown' || m.kind === 'other' ? result.kind : m.kind,
          qualifier: m.qualifier || (m.status === 'unknown' ? result.qualifier : ''),
          importance: m.status === 'unknown' ? 2 : m.importance,
          updatedAt: t,
        };
        nodes[nodes.findIndex((n) => n.id === m.id)] = updated;
        main = updated;
      }
      const mainId = main.id;

      // ---- 出典（同じURLは使い回す） ----
      const titleOf = new Map(result.sources.map((s) => [s.url, s.title]));
      const sourceIdOf = (url: string) => {
        const found = sources.find((s) => s.url === url);
        if (found) return found.id;
        const src: Source = { id: newId(), type: 'web', title: titleOf.get(url) || url, url, author: '', page: '', addedAt: t };
        sources.push(src);
        return src.id;
      };

      // ---- 記述（同じ文がすでにあれば足さない） ----
      const have = new Set(statements.filter((st) => st.starId === mainId).map((st) => st.text));
      let order = Math.max(-1, ...statements.filter((st) => st.starId === mainId).map((st) => st.order)) + 1;
      for (const s of result.statements) {
        if (have.has(s.text)) continue;
        statements.push({
          id: newId(), starId: mainId, text: s.text, kind: 'fact', topic: s.topic,
          sourceIds: s.sourceUrls.map(sourceIdOf), order: order++, createdAt: t, updatedAt: t,
        });
      }

      // ---- 枝：あれば今ある星につなぎ、なければ「まだ知らない星」を作る ----
      const connected = (a: string, b: string) =>
        relations.some((r) => (r.sourceNodeId === a && r.targetNodeId === b) || (r.sourceNodeId === b && r.targetNodeId === a));
      let added = 0;
      let linked = 0;
      // 新しい枝の星は、画面で見たときに、すでにつながっている星と重ならない向きに置く
      const p = main.position;
      const [rx, ry, rz] = view.right;
      const [ux, uy, uz] = view.up;
      // 画面の上での位置（右向き・上向きの成分）
      const flat = (q: Vec3): [number, number] => {
        const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
        return [d[0] * rx + d[1] * ry + d[2] * rz, d[0] * ux + d[1] * uy + d[2] * uz];
      };
      const neighborsOfMain = relations
        .filter((r) => r.sourceNodeId === mainId || r.targetNodeId === mainId)
        .map((r) => (r.sourceNodeId === mainId ? r.targetNodeId : r.sourceNodeId));
      // 名前は横に長いので、横の差は小さく数える（左右に並べるより、上下にずらしたほうが重ならない）
      const used: [number, number][] = [[0, 0]];
      for (const id of neighborsOfMain) {
        const n = nodes.find((x) => x.id === id);
        if (n) used.push(flat(n.position));
      }
      const apart = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) / 5, a[1] - b[1]);
      const freeSpot = (): [number, number] => {
        let best: [number, number] = [0, 10];
        let bestScore = -Infinity;
        for (let k = 0; k < 48; k++) {
          const a = (k / 48) * Math.PI * 2 + Math.random() * 0.05;
          for (const R of [9, 11.5, 14]) {
            const c: [number, number] = [Math.cos(a) * R, Math.sin(a) * R];
            // 下はパネルに隠れやすいので、少しだけ上を好む
            const score = Math.min(...used.map((u) => apart(c, u))) + (c[1] > 0 ? 0.6 : 0);
            if (score > bestScore) {
              bestScore = score;
              best = c;
            }
          }
        }
        used.push(best);
        return best;
      };
      result.branches.forEach((b) => {
        let target = findStar(b.name);
        if (target?.id === mainId) return;
        if (!target) {
          // 星どうしの普段の間隔（およそ18）に近い距離で散らす。近すぎると名前が重なって読めない
          const [fx, fy] = freeSpot();
          const depth = (Math.random() - 0.5) * 4;
          const back = [ry * uz - rz * uy, rz * ux - rx * uz, rx * uy - ry * ux]; // 画面の奥行きの向き
          target = {
            id: newId(), status: 'unknown', title: b.name, qualifier: '', aliases: [], kind: 'other', category: '', tags: [],
            summary: '', importance: 1, origin: 'user', seedOf: mainId, createdAt: t, updatedAt: t,
            position: [
              p[0] + rx * fx + ux * fy + back[0] * depth,
              p[1] + ry * fx + uy * fy + back[1] * depth,
              p[2] + rz * fx + uz * fy + back[2] * depth,
            ],
          };
          nodes.push(target);
          added++;
        } else linked++;
        if (connected(mainId, target.id)) return;
        relations.push({
          id: newId(), sourceNodeId: mainId, targetNodeId: target.id, relationType: b.relationType,
          explanation: b.reason, explanationKind: b.sourceUrls.length ? 'fact' : 'opinion',
          sourceIds: b.sourceUrls.map(sourceIdOf), createdAt: t,
        });
      });

      set({
        nodes, sources, statements, relations,
        undo: { label: `「${result.title}」をAIで調べて追加しました`, snapshot: before, expiresAt: Date.now() + 8000 },
      });
      persist();
      return { id: mainId, added, linked };
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
      const target = findByName(nodes, w) ?? get().ensureStar(w, st.starId);
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

// 読み込みが終わったとき・データが変わったときに、検索や星のページで使う下ごしらえを、手が空いているうちに済ませる
const warmData = () => {
  const { nodes, statements, sources } = useCosmos.getState();
  return { nodes, statements, sources };
};
useCosmos.subscribe((s, prev) => {
  if (!s.loaded) return;
  if (!prev.loaded || s.nodes !== prev.nodes || s.statements !== prev.statements || s.sources !== prev.sources) scheduleWarmup(warmData);
});
