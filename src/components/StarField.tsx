// 星の描画とタッチ操作（軽量版）。
// - 全部の星を1つの「点の集まり」として、1回でまとめて描く（星が1000個を超えても軽くするため）
// - タップは「画面上で指に一番近い星」を選ぶ（遠くの小さな星も押しやすい）
// - 長押しで星をつかんで動かす（骨格の層 ③B）
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCosmos } from '../store/useCosmos';
import { categoryColor, starRadius } from '../lib/util';
import type { OverlayClass } from '../lib/compare';
import { useOverlayMap } from './useOverlayMap';

/** 友達と重ねるときの色 */
export const OVERLAY_COLORS: Record<OverlayClass, string> = { both: '#ffd36e', mine: '#7fb8ff', friend: '#ff8fc8' };

const TAP_TOLERANCE = 10; // 指のぶれを許す量（ピクセル）
const LONG_PRESS_MS = 450; // 長押しとみなす時間
const PICK_RADIUS = 26; // 星を押したとみなす距離（ピクセル）
const DOUBLE_TAP_MS = 350;

const vertexShader = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  attribute float alpha;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // 光のにじみを含めた直径（星の半径の5倍）を画面上の大きさにする
    gl_PointSize = clamp(size * 6.0 * uScale / -mv.z, 3.0, 110.0);
    gl_Position = projectionMatrix * mv;
    vColor = color;
    vAlpha = alpha;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    // 芯は小さくはっきり、にじみは弱く（星が密集しても眩しくなりすぎないように）
    float core = smoothstep(0.30, 0.22, d);
    float halo = exp(-d * d * 14.0) * 0.32;
    vec3 col = mix(vColor, vec3(1.0), 0.5) * core * 0.95 + vColor * halo;
    gl_FragColor = vec4(col * vAlpha, 1.0);
  }
`;

function nodeRadius(status: string, importance: number) {
  return status === 'unknown' ? starRadius(1) * 0.75 : starRadius(importance);
}

/** すべての星を1回で描く */
export function StarField({ connected }: { connected: Set<string> }) {
  const nodes = useCosmos((s) => s.nodes);
  const overlay = useOverlayMap();
  const { size, camera, gl } = useThree();

  const geometry = useMemo(() => {
    const n = nodes.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const sz = new Float32Array(n);
    const al = new Float32Array(n);
    const c = new THREE.Color();
    nodes.forEach((node, i) => {
      pos.set(node.position, i * 3);
      const unknown = node.status === 'unknown';
      const cls = overlay?.[node.id];
      c.set(overlay ? (cls ? OVERLAY_COLORS[cls] : '#5a6280') : unknown ? '#8f99c2' : categoryColor(node.category));
      col.set([c.r, c.g, c.b], i * 3);
      sz[i] = nodeRadius(node.status, node.importance) * (cls ? 1.3 : 1);
      // まだ知らない星・つながりのない星は淡く光らせる。重ねて表示しているときは、関係のない星を暗くする
      al[i] = overlay ? (cls ? 1 : 0.12) : unknown ? 0.4 : connected.has(node.id) ? 0.85 : 0.55;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(al, 1));
    g.computeBoundingSphere();
    return g;
  }, [nodes, connected, overlay]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 1 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    material.uniforms.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/** 選んでいる星・つなぐ元の星・動かしている星に輪を付ける */
export function SelectionMarkers() {
  const nodes = useCosmos((s) => s.nodes);
  const selectedId = useCosmos((s) => s.selectedId);
  const connectFromId = useCosmos((s) => s.connectFromId);
  const draggingId = useCosmos((s) => s.draggingId);
  const marks = [
    { id: draggingId, color: '#8dffb0', scale: 1.4 },
    { id: connectFromId, color: '#8dffb0', scale: 1 },
    { id: selectedId, color: '#ffffff', scale: 1 },
  ].filter((m, i, arr) => m.id && arr.findIndex((x) => x.id === m.id) === i);
  return (
    <>
      {marks.map((m) => {
        const n = nodes.find((x) => x.id === m.id);
        if (!n) return null;
        const r = nodeRadius(n.status, n.importance);
        return (
          <Billboard key={m.id!} position={n.position} scale={m.scale}>
            <mesh>
              <ringGeometry args={[r * 1.35, r * 1.5, 48]} />
              <meshBasicMaterial color={m.color} transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          </Billboard>
        );
      })}
    </>
  );
}

/** 画面のタッチを受け取り、星のタップ・ダブルタップ・長押しドラッグを判定する */
export function StarPicker() {
  const { gl, camera, controls } = useThree() as unknown as {
    gl: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControlsImpl | null;
  };
  const state = useRef<{
    pointerId: number;
    x: number;
    y: number;
    t: number;
    starId: string | null;
    timer: number;
    moved: boolean;
    drag: { plane: THREE.Plane; offset: THREE.Vector3; id: string } | null;
  } | null>(null);
  const pointers = useRef(0);
  const lastTap = useRef<{ id: string; t: number } | null>(null);

  useEffect(() => {
    const el = gl.domElement;
    const v = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();

    const rayAt = (x: number, y: number) => {
      const rect = el.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), camera);
      return raycaster.ray;
    };

    /** 画面上で指に一番近い星（近いものが同じくらいなら手前の星）を探す */
    const pick = (x: number, y: number): string | null => {
      const rect = el.getBoundingClientRect();
      const fovScale = rect.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
      let best: string | null = null;
      let bestScore = Infinity;
      for (const n of useCosmos.getState().nodes) {
        v.set(n.position[0], n.position[1], n.position[2]);
        const dist = camera.position.distanceTo(v);
        v.project(camera);
        if (v.z > 1 || v.z < -1) continue;
        const sx = rect.left + ((v.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - v.y) / 2) * rect.height;
        const d = Math.hypot(sx - x, sy - y);
        const rPx = (nodeRadius(n.status, n.importance) * 2 * fovScale) / dist;
        const limit = Math.max(PICK_RADIUS, rPx);
        if (d > limit) continue;
        const score = d / limit + dist * 0.002;
        if (score < bestScore) {
          bestScore = score;
          best = n.id;
        }
      }
      return best;
    };

    const endDrag = () => {
      const s = state.current;
      if (!s?.drag) return;
      if (controls) controls.enabled = true;
      const id = s.drag.id;
      const node = useCosmos.getState().nodes.find((n) => n.id === id);
      if (node) useCosmos.getState().moveNode(id, node.position, true);
      useCosmos.setState({ draggingId: null });
    };

    const onDown = (e: PointerEvent) => {
      pointers.current++;
      if (pointers.current > 1) {
        // 2本指（ズーム）のときは、タップや長押しにしない
        if (state.current) window.clearTimeout(state.current.timer);
        state.current = null;
        return;
      }
      const starId = useCosmos.getState().mode === 'view' || useCosmos.getState().mode === 'connect' ? pick(e.clientX, e.clientY) : null;
      const s = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), starId, timer: 0, moved: false, drag: null as null | { plane: THREE.Plane; offset: THREE.Vector3; id: string } };
      if (starId && useCosmos.getState().mode === 'view') {
        s.timer = window.setTimeout(() => {
          const cur = state.current;
          if (!cur || cur.moved || cur.pointerId !== e.pointerId) return;
          const node = useCosmos.getState().nodes.find((n) => n.id === starId);
          if (!node) return;
          if (controls) controls.enabled = false;
          const normal = new THREE.Vector3();
          camera.getWorldDirection(normal);
          const p = new THREE.Vector3(...node.position);
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, p);
          const hit = new THREE.Vector3();
          rayAt(cur.x, cur.y).intersectPlane(plane, hit);
          cur.drag = { plane, offset: p.clone().sub(hit), id: starId };
          useCosmos.setState({ draggingId: starId });
        }, LONG_PRESS_MS);
      }
      state.current = s;
    };

    const onMove = (e: PointerEvent) => {
      const s = state.current;
      if (!s || s.pointerId !== e.pointerId) return;
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_TOLERANCE) {
        s.moved = true;
        if (!s.drag) window.clearTimeout(s.timer); // 長押しの前に動いたら、視点を回す操作
      }
      if (s.drag) {
        const hit = new THREE.Vector3();
        if (!rayAt(e.clientX, e.clientY).intersectPlane(s.drag.plane, hit)) return;
        hit.add(s.drag.offset);
        useCosmos.getState().moveNode(s.drag.id, [hit.x, hit.y, hit.z], false);
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.current = Math.max(0, pointers.current - 1);
      const s = state.current;
      if (!s || s.pointerId !== e.pointerId) return;
      window.clearTimeout(s.timer);
      state.current = null;
      if (s.drag) {
        state.current = s;
        endDrag();
        state.current = null;
        return;
      }
      if (s.moved || e.type === 'pointercancel') return;
      const store = useCosmos.getState();
      if (!s.starId) {
        // 何もない場所をタップしたら選択解除
        if (store.mode === 'view') store.select(null);
        return;
      }
      const now = performance.now();
      if (store.mode === 'view' && lastTap.current && lastTap.current.id === s.starId && now - lastTap.current.t < DOUBLE_TAP_MS) {
        store.select(s.starId);
        store.focusOn(s.starId);
        lastTap.current = null;
        return;
      }
      lastTap.current = { id: s.starId, t: now };
      store.tapNode(s.starId);
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [gl, camera, controls]);

  return null;
}
