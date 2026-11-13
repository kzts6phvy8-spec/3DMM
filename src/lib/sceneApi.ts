import type { Vec3 } from '../types';

/** 3D空間の外のUIから、3D側の情報（カメラ位置など）を参照するための窓口 */
export const sceneApi: { getSpawnPosition: (() => Vec3) | null } = {
  getSpawnPosition: null,
};

export function spawnPosition(): Vec3 {
  if (sceneApi.getSpawnPosition) return sceneApi.getSpawnPosition();
  return [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6];
}
