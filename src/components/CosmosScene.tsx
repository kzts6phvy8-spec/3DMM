// 3D宇宙空間。データは store から受け取り、表示とタッチ操作だけを担当する。
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCosmos } from '../store/useCosmos';
import type { KnowledgeNode, Vec3 } from '../types';
import { RELATION_COLORS, starRadius } from '../lib/util';
import { sceneApi } from '../lib/sceneApi';
import { labelPool, labelSlots, labelWidth } from '../lib/labelRegistry';
import { displayName, mentionEdgesFor, type MentionEdge } from '../lib/knowledge';
import { SelectionMarkers, StarField, StarPicker } from './StarField';
import { neighborIds } from '../lib/neighbors';
import { hiddenStarIds, isOwnStar } from '../lib/ownStars';
import { lineFilterStarIds, pairKey, useLinkTypes, type LineKind } from '../lib/linkTypes';

function MentionSegments({ edges, byId, dashed, dim, color = '#c9d6ff', boost = 1 }: { edges: MentionEdge[]; byId: Map<string, KnowledgeNode>; dashed: boolean; dim: boolean; color?: string; boost?: number }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (const m of edges) {
      const a = byId.get(m.a);
      const b = byId.get(m.b);
      if (a && b) pts.push(...a.position, ...b.position);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [edges, byId]);
  const ref = useRef<THREE.LineSegments>(null);
  useEffect(() => {
    if (dashed) ref.current?.computeLineDistances();
    return () => geometry.dispose();
  }, [geometry, dashed]);
  // 線が多いほど1本ずつを薄くする（宇宙が灰色の網のようにならないように）
  const fade = Math.min(1, Math.max(0.15, 200 / Math.max(1, edges.length)));
  return (
    <lineSegments ref={ref} geometry={geometry}>
      {dashed ? (
        <lineDashedMaterial color={color} transparent opacity={Math.min(1, (dim ? 0.05 : 0.16) * fade * boost)} dashSize={0.25} gapSize={0.2} depthWrite={false} />
      ) : (
        <lineBasicMaterial color={color} transparent opacity={Math.min(1, (dim ? 0.05 : 0.18) * fade * boost)} depthWrite={false} />
      )}
    </lineSegments>
  );
}

function RelationLines() {
  const nodes = useCosmos((s) => s.nodes);
  const relations = useCosmos((s) => s.relations);
  const statements = useCosmos((s) => s.statements);
  const selectedId = useCosmos((s) => s.selectedId);
  const focusMode = useCosmos((s) => s.mode === 'view' && s.selectedId !== null && !s.overlay);
  const ownOnly = useCosmos((s) => s.ownOnly);
  const hidden = useMemo(() => hiddenStarIds(nodes, ownOnly, selectedId), [nodes, ownOnly, selectedId]);
  // 「自分の星だけ表示」のときは、隠れている星を地図から外す（その星への線も描かない）
  const byId = useMemo(() => new Map(nodes.filter((n) => !hidden?.has(n.id)).map((n) => [n.id, n])), [nodes, hidden]);
  const allMentions = useMemo(() => mentionEdgesFor(statements, nodes), [statements, nodes]);
  // 線の絞り込み：言及の線は AIの推測の種類で分ける（種類の分からない線は unknown）。違う意味のリンクの線は出さない
  const lineFilter = useCosmos((s) => s.lineFilter);
  const linkTypes = useLinkTypes(lineFilter !== null);
  const mentions = useMemo(() => {
    let out = hidden ? allMentions.filter((m) => byId.has(m.a) && byId.has(m.b)) : allMentions;
    if (lineFilter && linkTypes) {
      const want = new Set(lineFilter);
      out = out.filter((m) => {
        const k = pairKey(m.a, m.b);
        if (linkTypes.mislinks.has(k)) return false;
        return want.has(linkTypes.types.get(k) ?? 'unknown');
      });
    }
    return out;
  }, [allMentions, hidden, byId, lineFilter, linkTypes]);
  // 「広げる」で生まれた、まだ知らない星と、もとの星を結ぶ点線
  const seedEdges = useMemo<MentionEdge[]>(
    () =>
      nodes
        .filter((n) => n.status === 'unknown' && n.seedOf && byId.has(n.seedOf))
        .map((n) => ({ id: `s:${n.id}`, a: n.seedOf!, b: n.id, kind: 'opinion' as const })),
    [nodes, byId],
  );
  // 線の一覧は、データが変わったときだけ作り直す（星を選ぶたびに3万本以上の線を作り直さないように）
  const factEdges = useMemo(() => mentions.filter((m) => m.kind === 'fact'), [mentions]);
  const opinionEdges = useMemo(() => [...mentions.filter((m) => m.kind === 'opinion'), ...seedEdges], [mentions, seedEdges]);
  // 絞り込み中だけ、種類ごとに分ける（絞り込んでいないときは今までどおり1色）
  // 残った線につながっている星を、星の明るさと名前の表示に使えるよう、状態に入れる
  useEffect(() => {
    const lit = lineFilterStarIds(lineFilter, linkTypes, allMentions, relations);
    useCosmos.setState({ lineLit: lit });
  }, [lineFilter, linkTypes, allMentions, relations]);
  const typedGroups = useMemo(() => {
    if (!lineFilter || !linkTypes) return [];
    const groups = new Map<LineKind, { fact: MentionEdge[]; opinion: MentionEdge[] }>();
    for (const m of mentions) {
      const t: LineKind = linkTypes.types.get(pairKey(m.a, m.b)) ?? 'unknown';
      if (!groups.has(t)) groups.set(t, { fact: [], opinion: [] });
      groups.get(t)![m.kind === 'opinion' ? 'opinion' : 'fact'].push(m);
    }
    return [...groups.entries()].map(([type, g]) => ({ type, ...g }));
  }, [lineFilter, linkTypes, mentions]);

  return (
    <>
      {/* 言及のつながり：記述の中のリンクから自動でできる細い線（まとめて1回で描いて軽くする） */}
      {/* 星を開いている間は、ほかの星どうしの線を消して、開いた星の線だけを見せる */}
      {/* 線を種類で絞り込んでいる間は、種類ごとの色で少し明るく描く（どの線が残ったか見分けられるように） */}
      {!focusMode &&
        typedGroups.map(({ type, fact, opinion }) => (
          <group key={type}>
            <MentionSegments edges={fact} byId={byId} dashed={false} dim={!!selectedId} color={type === 'unknown' ? undefined : RELATION_COLORS[type]} boost={2.5} />
            <MentionSegments edges={opinion} byId={byId} dashed dim={!!selectedId} color={type === 'unknown' ? undefined : RELATION_COLORS[type]} boost={2.5} />
          </group>
        ))}
      {!focusMode && !typedGroups.length && <MentionSegments edges={factEdges} byId={byId} dashed={false} dim={!!selectedId} />}
      {!focusMode && !typedGroups.length && <MentionSegments edges={opinionEdges} byId={byId} dashed dim={!!selectedId} />}
      {/* 選んだ星の言及のつながりだけ、太く明るく描く */}
      {selectedId &&
        mentions
          .filter((m) => m.a === selectedId || m.b === selectedId)
          .map((m) => {
            const a = byId.get(m.a)!;
            const b = byId.get(m.b)!;
            return (
              <Line key={m.id} points={[a.position, b.position]} color="#c9d6ff" lineWidth={1.4} transparent opacity={0.6}
                dashed={m.kind === 'opinion'} dashSize={0.25} gapSize={0.2} toneMapped={false} />
            );
          })}
      {/* 意味のつながり：自分で結んだ明るい線（理由が意見なら点線） */}
      {relations.map((r) => {
        if (lineFilter && !lineFilter.includes(r.relationType)) return null;
        const a = byId.get(r.sourceNodeId);
        const b = byId.get(r.targetNodeId);
        if (!a || !b) return null;
        const active = selectedId === a.id || selectedId === b.id;
        return (
          <Line
            key={r.id}
            points={[a.position, b.position]}
            color={RELATION_COLORS[r.relationType]}
            lineWidth={active ? 3 : 1.4}
            transparent
            opacity={active ? 0.95 : focusMode ? 0.04 : selectedId ? 0.2 : 0.45}
            dashed={r.explanationKind === 'opinion'}
            dashSize={0.3}
            gapSize={0.2}
            toneMapped={false}
          />
        );
      })}
    </>
  );
}

/** つながっている星（近い順に最大30個）が、詳細パネルの上の空間に収まる距離 */
const FIT_MAX = 30;
function fitDistance(node: KnowledgeNode, cam: THREE.PerspectiveCamera, max: number): number {
  const { statements, relations, nodes } = useCosmos.getState();
  const ids = neighborIds(node.id, { statements, relations, nodes });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const p = new THREE.Vector3(...node.position);
  const ds: number[] = [];
  for (const id of ids) {
    const n = byId.get(id);
    if (n && id !== node.id) ds.push(p.distanceTo(new THREE.Vector3(...n.position)));
  }
  if (ds.length === 0) return 9;
  ds.sort((a, b) => a - b);
  const r = ds[Math.min(ds.length, FIT_MAX) - 1];
  // 星はパネルの上（画面の上から約4分の1）に来る。その上下と左右に収まる大きさ
  const t = Math.tan((cam.fov * Math.PI) / 360);
  const room = Math.min(t * 0.36, t * cam.aspect * 0.85);
  // 遠近のずれと上のバーの分を見込んで、少し余裕をとる
  return Math.min(max, Math.max(9, (r / room) * 1.5));
}

/** 選んだ星へカメラを滑らかに移動させる */
function FocusRig() {
  const focus = useCosmos((s) => s.focus);
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: OrbitControlsImpl | null };
  const anim = useRef<{ target: THREE.Vector3; camPos: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!focus || !controls) return;
    const node = useCosmos.getState().nodes.find((n) => n.id === focus.id);
    if (!node) return;
    const target = new THREE.Vector3(...node.position);
    const dir = camera.position.clone().sub(controls.target).normalize();
    // つながっている星が宇宙の反対側にあることもある。必要なら、引ける距離の上限も広げて全部を収める
    const distance = fitDistance(node, camera as THREE.PerspectiveCamera, 5000);
    if (distance > controls.maxDistance * 0.95) controls.maxDistance = distance / 0.95;
    // 引いた先からでも宇宙の奥まで見えるように、見える距離の限界も広げる（広げないと、星も名前も消えて真っ暗になる）
    const cam = camera as THREE.PerspectiveCamera;
    const needFar = controls.maxDistance * 1.6;
    if (cam.far < needFar) {
      cam.far = needFar;
      cam.updateProjectionMatrix();
    }
    anim.current = { target, camPos: target.clone().add(dir.multiplyScalar(distance)) };
    // ユーザーが触ったらアニメーションを止める
    const stop = () => (anim.current = null);
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [focus, camera, controls]);

  useFrame((_, dt) => {
    if (!anim.current || !controls) return;
    const k = 1 - Math.pow(0.002, dt);
    controls.target.lerp(anim.current.target, k);
    camera.position.lerp(anim.current.camPos, k);
    controls.update();
    if (camera.position.distanceTo(anim.current.camPos) < 0.01) anim.current = null;
  });
  return null;
}

/** 遠くから見ているときは霧も遠ざける（離れた星まで引いたときに、つながっている星が霧で消えないように） */
function FogRig() {
  const base = useRef(0);
  useFrame(({ camera, scene, controls }) => {
    const fog = scene.fog as THREE.Fog | null;
    const c = controls as unknown as OrbitControlsImpl | null;
    if (!fog || !c) return;
    const d = camera.position.distanceTo(c.target);
    if (!base.current) base.current = d;
    const k = Math.max(1, d / base.current);
    fog.near = 120 * k;
    fog.far = 400 * k;
  });
  return null;
}

/** 詳細パネルが開いている間、画面の中心を上にずらして星がパネルに隠れないようにする */
function ViewShift() {
  const open = useCosmos((s) => s.mode === 'view' && s.selectedId !== null);
  const current = useRef(0);
  useFrame(({ camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera;
    const target = open ? size.height * 0.24 : 0;
    const next = current.current + (target - current.current) * 0.15;
    current.current = Math.abs(next - target) < 0.5 ? target : next;
    if (current.current === 0) {
      if (cam.view?.enabled) cam.clearViewOffset();
      return;
    }
    cam.setViewOffset(size.width, size.height, 0, current.current, size.width, size.height);
  });
  return null;
}

const MAX_LABELS = 45;
/** ラベルの要素に、星の名前と位置を書き込む（前と同じなら何もしない。画面の再計算を減らすため） */
function assign(el: HTMLDivElement, id: string, text: string, cls: string, transform: string, opacity: string) {
  const cur = labelSlots.get(el);
  const style = transform + opacity;
  if (cur && cur.id === id && cur.text === text && cur.cls === cls && cur.style === style) return;
  if (!cur || cur.text !== text) el.textContent = text;
  if (!cur || cur.cls !== cls) el.className = cls;
  if (!cur || cur.style !== style) {
    el.style.transform = transform;
    el.style.opacity = opacity;
  }
  if (!cur || cur.id === '') el.style.visibility = 'visible';
  labelSlots.set(el, { id, text, cls, style });
}
function release(el: HTMLDivElement) {
  const cur = labelSlots.get(el);
  if (cur && cur.id === '') return;
  el.style.visibility = 'hidden';
  labelSlots.set(el, { id: '', text: cur?.text ?? '', cls: cur?.cls ?? '', style: cur?.style ?? '' });
}

/** 毎フレーム、星の3D座標を画面上の位置に変換してラベルを動かす */
function LabelProjector() {
  const v = useMemo(() => new THREE.Vector3(), []);
  const selectedId = useCosmos((s) => s.selectedId);
  const statements = useCosmos((s) => s.statements);
  const relations = useCosmos((s) => s.relations);
  const seedCount = useCosmos((s) => s.nodes.filter((n) => n.seedOf).length);
  // 選んだ星とつながっている星（必ず名前を見せる対象）
  const near = useMemo(
    () => neighborIds(selectedId, { statements, relations, nodes: useCosmos.getState().nodes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, statements, relations, seedCount],
  );


  const controls = useThree((st) => st.controls) as OrbitControlsImpl | null;
  // 前のコマと同じ見え方なら、ラベルの計算を省く（星が1万個あっても、止まっているときは軽く）
  const last = useMemo(() => ({ key: '', nodes: null as unknown, near: null as unknown, lit: null as unknown }), []);
  useFrame(({ camera, size }) => {
    const { nodes, labelDensity, connectFromId, mode, ownOnly, lineLit } = useCosmos.getState();
    const key = `${camera.matrixWorld.elements.join(',')}|${camera.projectionMatrix.elements[0]}|${size.width}x${size.height}|${labelDensity}|${connectFromId}|${mode}|${ownOnly}`;
    if (key === last.key && nodes === last.nodes && near === last.near && lineLit === last.lit) return;
    last.lit = lineLit;
    last.key = key;
    last.nodes = nodes;
    last.near = near;
    // 今見ている距離（注視点までの距離）を基準に、どこまでの名前を出すかを決める
    const d0 = controls ? camera.position.distanceTo(controls.target) : 40;
    // 名前の表示量の設定（少なめ／普通／多め）
    const densityBonus = labelDensity === 'few' ? -10 : labelDensity === 'many' ? 12 : 0;
    type Cand = { node: KnowledgeNode; text: string; x: number; y: number; w: number; opacity: number; priority: number };
    const cands: Cand[] = [];
    // 「自分の星だけ表示」で隠れている星の名前は出さない
    const hidden = hiddenStarIds(nodes, ownOnly, selectedId);
    for (const n of nodes) {
      if (hidden?.has(n.id)) continue;
      // 線を絞り込んでいる間は、残った線につながっていない星の名前を出さない（開いている星とそのまわりは出す）
      if (lineLit && !lineLit.has(n.id) && n.id !== selectedId && !near.has(n.id)) continue;
      const unknown = n.status === 'unknown';
      const r = unknown ? starRadius(1) * 0.75 : starRadius(n.importance);
      v.set(n.position[0], n.position[1] - r - 0.35, n.position[2]);
      const dist = camera.position.distanceTo(v);
      // 遠くからは重要な星の名前だけ見せ、近づくほど多くの名前が見えるようにする
      let opacity: number;
      if (near.has(n.id)) opacity = 1;
      // 「自分の星だけ表示」のときは星が少ないので、遠くても名前を出す（重なるものは下で間引く）
      else if (hidden && !(selectedId && mode === 'view')) opacity = 1;
      // 星を選んでいる間は、つながっていない星の名前を出さない（つながりを目立たせるため）
      else if (selectedId && mode === 'view') continue;
      else if (unknown) opacity = Math.max(0, Math.min(0.8, (d0 * 0.45 - dist) / (d0 * 0.1)));
      else {
        const limit = d0 * (0.75 + n.importance * 0.14) + densityBonus * (d0 / 30);
        opacity = Math.max(0, Math.min(1, (limit - dist) / (d0 * 0.12)));
      }
      // 名前を出さない遠い星は、画面上の位置を計算しない（重い計算を減らす）
      if (opacity <= 0.02) continue;
      v.project(camera);
      const sx = ((v.x + 1) / 2) * size.width;
      const sy = ((1 - v.y) / 2) * size.height;
      // 画面の外・後ろ・薄すぎるものは候補にしない
      if (v.z > 1 || v.z < -1 || sx < -80 || sx > size.width + 80 || sy < -20 || sy > size.height + 20) continue;
      const text = displayName(n);
      cands.push({
        node: n,
        text,
        x: sx,
        y: sy,
        w: labelWidth(text),
        opacity,
        // 選んだ星の周り → 重要な星 → 手前の星 の順に場所を取る
        priority: (n.id === selectedId ? 2000 : near.has(n.id) ? 1000 : 0) + (unknown ? 0 : n.importance * 20) - dist,
      });
    }
    // 重なるラベルは、優先度の低いほうを隠す
    cands.sort((a, b) => b.priority - a.priority);
    // 画面上部のバーの下にはラベルを出さない
    const placed: { x1: number; x2: number; y1: number; y2: number }[] = [
      { x1: -1e4, x2: 1e4, y1: -1e4, y2: 78 },
      { x1: -1e4, x2: 1e4, y1: size.height - 84, y2: 1e4 },
    ];
    const chosen: Cand[] = [];
    for (const c of cands) {
      const box = { x1: c.x - c.w / 2 - 2, x2: c.x + c.w / 2 + 2, y1: c.y - 11, y2: c.y + 11 };
      // 一度に出す名前は最大45個まで（多すぎると読めず、重くもなる）
      if (placed.length > MAX_LABELS || chosen.length >= labelPool.length) break;
      if (placed.some((p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1)) continue;
      placed.push(box);
      chosen.push(c);
    }
    // 前のコマと同じ星には同じ要素を使う（文字の書き換えを減らす）
    const prevOwner = new Map<string, HTMLDivElement>();
    for (const el of labelPool) {
      const id = labelSlots.get(el)?.id;
      if (id) prevOwner.set(id, el);
    }
    const used = new Set<HTMLDivElement>();
    const rest: Cand[] = [];
    const put = (el: HTMLDivElement, c: Cand) => {
      used.add(el);
      const cls = `star-label${c.node.status === 'unknown' ? ' is-unknown' : ''}${c.node.id === selectedId || c.node.id === connectFromId ? ' is-selected' : ''}`;
      assign(el, c.node.id, c.text, cls, `translate3d(${Math.round(c.x)}px, ${Math.round(c.y)}px, 0) translate(-50%, -50%)`, c.opacity.toFixed(2));
    };
    for (const c of chosen) {
      const el = prevOwner.get(c.node.id);
      if (el) put(el, c);
      else rest.push(c);
    }
    const free = labelPool.filter((el) => !used.has(el));
    rest.forEach((c, i) => put(free[i], c));
    for (const el of free.slice(rest.length)) release(el);
  });
  return null;
}

/** 3D空間の外（UI）から、新しい星を置く位置を問い合わせられるようにする */
function SceneBridge() {
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: OrbitControlsImpl | null };
  useEffect(() => {
    sceneApi.getSpawnPosition = (): Vec3 => {
      const center = controls ? controls.target.clone() : new THREE.Vector3();
      const others = useCosmos.getState().nodes.map((n) => new THREE.Vector3(...n.position));
      // 画面中央付近の候補をいくつか作り、既存の星と「空間でも画面上でも」重ならない場所を選ぶ
      const othersOnScreen = others.map((o) => o.clone().project(camera));
      let best = center.clone();
      let bestScore = -Infinity;
      for (let i = 0; i < 60; i++) {
        const dir = new THREE.Vector3().randomDirection();
        const cand = center.clone().add(dir.multiplyScalar(2.5 + Math.random() * 2.5));
        const scr = cand.clone().project(camera);
        if (Math.abs(scr.x) > 0.75 || Math.abs(scr.y) > 0.6 || scr.z > 1) continue; // 画面内に収める
        const d3 = others.length ? Math.min(...others.map((o) => o.distanceTo(cand))) : 10;
        const d2 = othersOnScreen.length ? Math.min(...othersOnScreen.map((o) => Math.hypot(o.x - scr.x, o.y - scr.y))) : 1;
        const score = Math.min(d3, 4) / 4 + Math.min(d2, 0.35) / 0.35 * 1.5 - cand.distanceTo(center) * 0.02;
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }
      return [best.x, best.y, best.z];
    };
    sceneApi.getViewBasis = () => {
      const e = camera.matrixWorld.elements;
      return { right: [e[0], e[1], e[2]], up: [e[4], e[5], e[6]] };
    };
    return () => {
      sceneApi.getSpawnPosition = null;
      sceneApi.getViewBasis = null;
    };
  }, [camera, controls]);
  return null;
}

/** 起動したとき、宇宙全体が見える距離にカメラを置く（星の数が増えても全体を見渡せるように） */
function CameraFit() {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !controls) return;
    const nodes = useCosmos.getState().nodes.filter((n) => n.status === 'known');
    if (nodes.length === 0) return;
    done.current = true;
    const c = [0, 1, 2].map((k) => nodes.reduce((sum, n) => sum + n.position[k], 0) / nodes.length);
    const dists = nodes.map((n) => Math.hypot(n.position[0] - c[0], n.position[1] - c[1], n.position[2] - c[2])).sort((a, b) => a - b);
    const r = Math.max(8, dists[Math.floor(dists.length * 0.9)] ?? 10);
    controls.target.set(c[0], c[1], c[2]);
    // 最初は宇宙の一部を近くから見せる（全体はピンチで縮めると見える）
    camera.position.set(c[0], c[1] + r * 0.15, c[2] + r * 1.15);
    controls.maxDistance = Math.max(90, r * 5);
    camera.far = Math.max(500, r * 12);
    camera.updateProjectionMatrix();
    controls.update();
  }, [camera, controls]);
  return null;
}

/** 「自分の星だけ表示」にしたとき、自分の星がまとめて見える位置へカメラを動かす（向きは今のまま） */
function OwnOnlyFit() {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const ownOnly = useCosmos((s) => s.ownOnly);
  useEffect(() => {
    if (!ownOnly || !controls) return;
    const own = useCosmos.getState().nodes.filter(isOwnStar);
    if (own.length === 0) return;
    const c = new THREE.Vector3(...[0, 1, 2].map((k) => own.reduce((sum, n) => sum + n.position[k], 0) / own.length));
    const dists = own.map((n) => c.distanceTo(new THREE.Vector3(...n.position))).sort((a, b) => a - b);
    // 星が少ないときは全部が入るように、多いときは離れた1割を除いて合わせる
    const r = Math.max(4, dists[dists.length <= 20 ? dists.length - 1 : Math.floor((dists.length - 1) * 0.9)] ?? 4);
    const dir = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(c);
    camera.position.copy(c).addScaledVector(dir, Math.min(controls.maxDistance, r * 2.6 + 8));
    controls.update();
  }, [ownOnly, camera, controls]);
  return null;
}

export function CosmosScene() {
  const nodes = useCosmos((s) => s.nodes);
  const relations = useCosmos((s) => s.relations);
  const statements = useCosmos((s) => s.statements);
  const connectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of relations) {
      set.add(r.sourceNodeId);
      set.add(r.targetNodeId);
    }
    for (const m of mentionEdgesFor(statements, nodes)) {
      set.add(m.a);
      set.add(m.b);
    }
    return set;
  }, [relations, statements, nodes]);

  return (
    <Canvas
      className="cosmos-canvas"
      camera={{ position: [0, 10, 44], fov: 55, near: 0.1, far: 500 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#05060f']} />
      <fog attach="fog" args={['#05060f', 120, 400]} />
      <Stars radius={90} depth={50} count={2500} factor={4} saturation={0.3} fade speed={0.4} />
      <RelationLines />
      <StarField connected={connectedIds} />
      <SelectionMarkers />
      <StarPicker />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} rotateSpeed={0.7} minDistance={2} maxDistance={400} />
      <CameraFit />
      <OwnOnlyFit />
      <FocusRig />
      <ViewShift />
      <FogRig />
      <LabelProjector />
      <SceneBridge />
    </Canvas>
  );
}
