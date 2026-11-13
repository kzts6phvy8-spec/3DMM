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
import { labelElements } from '../lib/labelRegistry';
import { mentionEdges, parseLinkIds, type MentionEdge } from '../lib/knowledge';
import { SelectionMarkers, StarField, StarPicker } from './StarField';

function MentionSegments({ edges, byId, dashed, dim }: { edges: MentionEdge[]; byId: Map<string, KnowledgeNode>; dashed: boolean; dim: boolean }) {
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
  const fade = Math.min(1, Math.max(0.25, 250 / Math.max(1, edges.length)));
  return (
    <lineSegments ref={ref} geometry={geometry}>
      {dashed ? (
        <lineDashedMaterial color="#c9d6ff" transparent opacity={(dim ? 0.05 : 0.16) * fade} dashSize={0.25} gapSize={0.2} depthWrite={false} />
      ) : (
        <lineBasicMaterial color="#c9d6ff" transparent opacity={(dim ? 0.05 : 0.18) * fade} depthWrite={false} />
      )}
    </lineSegments>
  );
}

function RelationLines() {
  const nodes = useCosmos((s) => s.nodes);
  const relations = useCosmos((s) => s.relations);
  const statements = useCosmos((s) => s.statements);
  const selectedId = useCosmos((s) => s.selectedId);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const mentions = useMemo(() => mentionEdges(statements, new Set(byId.keys())), [statements, byId]);
  // 「広げる」で生まれた、まだ知らない星と、もとの星を結ぶ点線
  const seedEdges = useMemo<MentionEdge[]>(
    () =>
      nodes
        .filter((n) => n.status === 'unknown' && n.seedOf && byId.has(n.seedOf))
        .map((n) => ({ id: `s:${n.id}`, a: n.seedOf!, b: n.id, kind: 'opinion' as const })),
    [nodes, byId],
  );

  return (
    <>
      {/* 言及のつながり：記述の中のリンクから自動でできる細い線（まとめて1回で描いて軽くする） */}
      <MentionSegments edges={mentions.filter((m) => m.kind === 'fact')} byId={byId} dashed={false} dim={!!selectedId} />
      <MentionSegments edges={[...mentions.filter((m) => m.kind === 'opinion'), ...seedEdges]} byId={byId} dashed dim={!!selectedId} />
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
        const a = byId.get(r.sourceNodeId);
        const b = byId.get(r.targetNodeId);
        if (!a || !b) return null;
        const active = selectedId === a.id || selectedId === b.id;
        return (
          <Line
            key={r.id}
            points={[a.position, b.position]}
            color={RELATION_COLORS[r.relationType]}
            lineWidth={active ? 3 : 1.8}
            transparent
            opacity={active ? 0.95 : selectedId ? 0.25 : 0.7}
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
    const distance = 9;
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

const MAX_LABELS = 70;
/** ラベルの見た目を、変わったときだけ書き換える（毎フレーム全部書き換えると重いため） */
const labelState = new WeakMap<HTMLDivElement, string>();
function hide(el: HTMLDivElement) {
  if (labelState.get(el) === 'hidden') return;
  el.style.visibility = 'hidden';
  labelState.set(el, 'hidden');
}
function show(el: HTMLDivElement, transform: string, opacity: string) {
  const key = transform + opacity;
  if (labelState.get(el) === key) return;
  el.style.visibility = 'visible';
  el.style.transform = transform;
  el.style.opacity = opacity;
  labelState.set(el, key);
}

/** 毎フレーム、星の3D座標を画面上の位置に変換してラベルを動かす */
function LabelProjector() {
  const v = useMemo(() => new THREE.Vector3(), []);
  const selectedId = useCosmos((s) => s.selectedId);
  const statements = useCosmos((s) => s.statements);
  const seedCount = useCosmos((s) => s.nodes.filter((n) => n.seedOf).length);
  // 選んだ星とリンクでつながっている星（まだ知らない星のラベルを見せる対象）
  const near = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    set.add(selectedId);
    for (const st of statements) {
      const ids = parseLinkIds(st.text);
      if (st.starId === selectedId) ids.forEach((id) => set.add(id));
      else if (ids.includes(selectedId)) set.add(st.starId);
    }
    // 選んだ星から広げた星の名前も見せる
    for (const n of useCosmos.getState().nodes) if (n.seedOf === selectedId) set.add(n.id);
    return set;
  }, [selectedId, statements, seedCount]);

  // ラベルの幅は、文字が変わったときだけ測る（毎フレーム測ると重いため）
  const widths = useMemo(() => new Map<string, { text: string; w: number }>(), []);

  const controls = useThree((st) => st.controls) as OrbitControlsImpl | null;
  useFrame(({ camera, size }) => {
    const { nodes, labelDensity } = useCosmos.getState();
    // 今見ている距離（注視点までの距離）を基準に、どこまでの名前を出すかを決める
    const d0 = controls ? camera.position.distanceTo(controls.target) : 40;
    // 名前の表示量の設定（少なめ／普通／多め）
    const densityBonus = labelDensity === 'few' ? -10 : labelDensity === 'many' ? 12 : 0;
    type Cand = { el: HTMLDivElement; x: number; y: number; w: number; opacity: number; priority: number };
    const cands: Cand[] = [];
    for (const n of nodes) {
      const el = labelElements.get(n.id);
      if (!el) continue;
      const unknown = n.status === 'unknown';
      const r = unknown ? starRadius(1) * 0.75 : starRadius(n.importance);
      v.set(n.position[0], n.position[1] - r - 0.35, n.position[2]);
      const dist = camera.position.distanceTo(v);
      v.project(camera);
      // 遠くからは重要な星の名前だけ見せ、近づくほど多くの名前が見えるようにする
      let opacity: number;
      if (near.has(n.id)) opacity = 1;
      else if (unknown) opacity = Math.max(0, Math.min(0.8, (d0 * 0.45 - dist) / (d0 * 0.1)));
      else {
        const limit = d0 * (0.75 + n.importance * 0.14) + densityBonus * (d0 / 30);
        opacity = Math.max(0, Math.min(1, (limit - dist) / (d0 * 0.12)));
      }
      const sx = ((v.x + 1) / 2) * size.width;
      const sy = ((1 - v.y) / 2) * size.height;
      // 画面の外・後ろ・薄すぎるものは候補にしない
      if (v.z > 1 || v.z < -1 || opacity <= 0.02 || sx < -80 || sx > size.width + 80 || sy < -20 || sy > size.height + 20) {
        hide(el);
        continue;
      }
      let cached = widths.get(n.id);
      if (!cached || cached.text !== el.textContent) {
        cached = { text: el.textContent ?? '', w: el.offsetWidth || 60 };
        widths.set(n.id, cached);
      }
      cands.push({
        el,
        x: sx,
        y: sy,
        w: cached.w,
        opacity,
        // 選んだ星の周り → 重要な星 → 手前の星 の順に場所を取る
        priority: (near.has(n.id) ? 1000 : 0) + (unknown ? 0 : n.importance * 20) - dist,
      });
    }
    // 重なるラベルは、優先度の低いほうを隠す
    cands.sort((a, b) => b.priority - a.priority);
    // 画面上部のバーの下にはラベルを出さない
    const placed: { x1: number; x2: number; y1: number; y2: number }[] = [
      { x1: -1e4, x2: 1e4, y1: -1e4, y2: 78 },
      { x1: -1e4, x2: 1e4, y1: size.height - 84, y2: 1e4 },
    ];
    for (const c of cands) {
      const box = { x1: c.x - c.w / 2 - 2, x2: c.x + c.w / 2 + 2, y1: c.y - 11, y2: c.y + 11 };
      // 一度に出す名前は最大70個まで（多すぎると読めず、重くもなる）
      const hit = placed.length > MAX_LABELS || placed.some((p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1);
      if (hit) {
        hide(c.el);
        continue;
      }
      placed.push(box);
      show(c.el, `translate3d(${Math.round(c.x)}px, ${Math.round(c.y)}px, 0) translate(-50%, -50%)`, c.opacity.toFixed(2));
    }
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
    return () => {
      sceneApi.getSpawnPosition = null;
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
    camera.position.set(c[0], c[1] + r * 0.3, c[2] + r * 2.1);
    controls.maxDistance = Math.max(90, r * 5);
    camera.far = Math.max(500, r * 12);
    camera.updateProjectionMatrix();
    controls.update();
  }, [camera, controls]);
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
    for (const m of mentionEdges(statements, new Set(nodes.map((n) => n.id)))) {
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
      <FocusRig />
      <ViewShift />
      <LabelProjector />
      <SceneBridge />
    </Canvas>
  );
}
