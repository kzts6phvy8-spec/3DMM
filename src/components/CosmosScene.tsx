// 3D宇宙空間。データは store から受け取り、表示とタッチ操作だけを担当する。
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCosmos } from '../store/useCosmos';
import type { KnowledgeNode, Vec3 } from '../types';
import { RELATION_COLORS, categoryColor, starRadius } from '../lib/util';
import { sceneApi } from '../lib/sceneApi';
import { labelElements } from '../lib/labelRegistry';
import { mentionEdges, parseLinkIds, type MentionEdge } from '../lib/knowledge';

/** 指が少しぶれても「タップ」とみなす移動量（ピクセル） */
const TAP_TOLERANCE = 10;

/** 星の周りのぼんやりした光（ハロー）用のテクスチャ。1回だけ作って使い回す */
let haloTexture: THREE.Texture | null = null;
function getHaloTexture() {
  if (haloTexture) return haloTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  haloTexture = new THREE.CanvasTexture(canvas);
  return haloTexture;
}

function StarNode({ node, connected }: { node: KnowledgeNode; connected: boolean }) {
  const selected = useCosmos((s) => s.selectedId === node.id);
  const isConnectFrom = useCosmos((s) => s.connectFromId === node.id);
  const mode = useCosmos((s) => s.mode);
  const tapNode = useCosmos((s) => s.tapNode);
  const moveNode = useCosmos((s) => s.moveNode);
  const select = useCosmos((s) => s.select);
  const focusOn = useCosmos((s) => s.focusOn);
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: OrbitControlsImpl | null };

  // まだ知らない星は、小さく淡い光で表す
  const unknown = node.status === 'unknown';
  const r = unknown ? starRadius(1) * 0.75 : starRadius(node.importance);
  const color = unknown ? '#8f99c2' : categoryColor(node.category);
  const coreColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.65), [color]);
  // つながりのない星は「未整理」として淡く光らせる
  const dim = !connected || unknown;
  const highlight = selected || isConnectFrom;

  const drag = useRef<{ plane: THREE.Plane; offset: THREE.Vector3 } | null>(null);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (mode !== 'move') return;
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture(e.pointerId);
    if (controls) controls.enabled = false;
    // カメラに正面を向けた平面の上で星を動かす
    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    const pos = new THREE.Vector3(...node.position);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, pos);
    const hit = new THREE.Vector3();
    e.ray.intersectPlane(plane, hit);
    drag.current = { plane, offset: pos.clone().sub(hit) };
    select(node.id);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    const hit = new THREE.Vector3();
    if (!e.ray.intersectPlane(drag.current.plane, hit)) return;
    hit.add(drag.current.offset);
    moveNode(node.id, [hit.x, hit.y, hit.z], false);
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
    if (controls) controls.enabled = true;
    // 指を離した時点の位置を保存する
    const current = useCosmos.getState().nodes.find((n) => n.id === node.id);
    if (current) moveNode(node.id, current.position, true);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > TAP_TOLERANCE) return; // 視点を回しただけならタップ扱いしない
    if (mode === 'move') return;
    tapNode(node.id);
  };

  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (mode !== 'view') return;
    select(node.id);
    focusOn(node.id);
  };

  return (
    <group position={node.position}>
      {/* 星の核（白く輝く中心） */}
      <mesh>
        <sphereGeometry args={[r * 0.6, 20, 20]} />
        <meshBasicMaterial color={coreColor} transparent opacity={unknown ? 0.3 : dim ? 0.5 : 1} toneMapped={false} />
      </mesh>
      {/* 内側の強い光 */}
      <sprite scale={[r * 3.2, r * 3.2, 1]}>
        <spriteMaterial map={getHaloTexture()} color={color} transparent opacity={unknown ? 0.3 : dim ? 0.45 : 1}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* 外側のぼんやりした光（ハロー） */}
      <sprite scale={[r * (highlight ? 12 : 8), r * (highlight ? 12 : 8), 1]}>
        <spriteMaterial map={getHaloTexture()} color={color} transparent opacity={dim ? 0.15 : highlight ? 0.6 : 0.35}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {highlight && (
        <Billboard>
          <mesh>
            <ringGeometry args={[r * 1.35, r * 1.5, 48]} />
            <meshBasicMaterial color={isConnectFrom ? '#8dffb0' : '#ffffff'} transparent opacity={0.8} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </Billboard>
      )}
      {/* 指でタップしやすいよう、見た目より大きい透明な当たり判定 */}
      <mesh
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <sphereGeometry args={[Math.max(r * 2.2, 0.85), 12, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

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
  return (
    <lineSegments ref={ref} geometry={geometry}>
      {dashed ? (
        <lineDashedMaterial color="#c9d6ff" transparent opacity={dim ? 0.06 : 0.16} dashSize={0.25} gapSize={0.2} depthWrite={false} />
      ) : (
        <lineBasicMaterial color="#c9d6ff" transparent opacity={dim ? 0.06 : 0.18} depthWrite={false} />
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

  return (
    <>
      {/* 言及のつながり：記述の中のリンクから自動でできる細い線（まとめて1回で描いて軽くする） */}
      <MentionSegments edges={mentions.filter((m) => m.kind === 'fact')} byId={byId} dashed={false} dim={!!selectedId} />
      <MentionSegments edges={mentions.filter((m) => m.kind === 'opinion')} byId={byId} dashed dim={!!selectedId} />
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

/** 毎フレーム、星の3D座標を画面上の位置に変換してラベルを動かす */
function LabelProjector() {
  const v = useMemo(() => new THREE.Vector3(), []);
  const selectedId = useCosmos((s) => s.selectedId);
  const statements = useCosmos((s) => s.statements);
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
    return set;
  }, [selectedId, statements]);

  // ラベルの幅は、文字が変わったときだけ測る（毎フレーム測ると重いため）
  const widths = useMemo(() => new Map<string, { text: string; w: number }>(), []);

  useFrame(({ camera, size }) => {
    const { nodes } = useCosmos.getState();
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
      else if (unknown) opacity = Math.max(0, Math.min(0.8, (11 - dist) / 3));
      else opacity = Math.max(0, Math.min(1, (22 + n.importance * 6 - dist) / 4));
      if (v.z > 1 || v.z < -1 || opacity <= 0.02) {
        el.style.visibility = 'hidden';
        continue;
      }
      let cached = widths.get(n.id);
      if (!cached || cached.text !== el.textContent) {
        cached = { text: el.textContent ?? '', w: el.offsetWidth || 60 };
        widths.set(n.id, cached);
      }
      cands.push({
        el,
        x: ((v.x + 1) / 2) * size.width,
        y: ((1 - v.y) / 2) * size.height,
        w: cached.w,
        opacity,
        // 選んだ星の周り → 重要な星 → 手前の星 の順に場所を取る
        priority: (near.has(n.id) ? 1000 : 0) + (unknown ? 0 : n.importance * 20) - dist,
      });
    }
    // 重なるラベルは、優先度の低いほうを隠す
    cands.sort((a, b) => b.priority - a.priority);
    // 画面上部のバーの下にはラベルを出さない
    const placed: { x1: number; x2: number; y1: number; y2: number }[] = [{ x1: -1e4, x2: 1e4, y1: -1e4, y2: 78 }];
    for (const c of cands) {
      const box = { x1: c.x - c.w / 2 - 2, x2: c.x + c.w / 2 + 2, y1: c.y - 11, y2: c.y + 11 };
      const hit = placed.some((p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1);
      if (hit) {
        c.el.style.visibility = 'hidden';
        continue;
      }
      placed.push(box);
      c.el.style.visibility = 'visible';
      c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) translate(-50%, -50%)`;
      c.el.style.opacity = String(c.opacity);
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

export function CosmosScene() {
  const nodes = useCosmos((s) => s.nodes);
  const relations = useCosmos((s) => s.relations);
  const statements = useCosmos((s) => s.statements);
  const mode = useCosmos((s) => s.mode);
  const select = useCosmos((s) => s.select);

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
      onPointerMissed={(e) => {
        // 何もない場所をタップしたら選択解除（ドラッグで視点を回した場合は除く）
        if (mode === 'view' && e.type === 'click') select(null);
      }}
    >
      <color attach="background" args={['#05060f']} />
      <fog attach="fog" args={['#05060f', 45, 120]} />
      <Stars radius={90} depth={50} count={2500} factor={4} saturation={0.3} fade speed={0.4} />
      <RelationLines />
      {nodes.map((n) => (
        <StarNode key={n.id} node={n} connected={connectedIds.has(n.id)} />
      ))}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} rotateSpeed={0.7} minDistance={2} maxDistance={90} />
      <FocusRig />
      <ViewShift />
      <LabelProjector />
      <SceneBridge />
    </Canvas>
  );
}
