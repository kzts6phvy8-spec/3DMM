import type { Vec3 } from '../types';

/** 3D空間の外のUIから、3D側の情報（カメラ位置など）を参照するための窓口 */
export const sceneApi: { getSpawnPosition: (() => Vec3) | null; getViewBasis: (() => ViewBasis) | null } = {
  getSpawnPosition: null,
  getViewBasis: null,
};

/** 画面の右向きと上向き（3D空間の中の向き）。新しい星を、画面の上で重ならないように置くのに使う */
export interface ViewBasis {
  right: Vec3;
  up: Vec3;
}

export function viewBasis(): ViewBasis {
  return sceneApi.getViewBasis?.() ?? { right: [1, 0, 0], up: [0, 1, 0] };
}

export function spawnPosition(): Vec3 {
  if (sceneApi.getSpawnPosition) return sceneApi.getSpawnPosition();
  return [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6];
}
