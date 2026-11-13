// 保存処理。UIや3D表示から切り離しておくことで、
// 将来クラウド同期に差し替えるときもこのファイルだけ変えればよい。
import { createStore, get, set } from 'idb-keyval';
import type { CosmosData } from '../types';

export interface CosmosRepository {
  /** 保存データを読み込む。まだ何も保存されていなければ null */
  load(): Promise<CosmosData | null>;
  save(data: CosmosData): Promise<void>;
}

const store = createStore('knowledge-cosmos', 'data');
const KEY = 'cosmos-v1';

export const indexedDbRepository: CosmosRepository = {
  async load() {
    const data = await get<CosmosData>(KEY, store);
    return data ?? null;
  },
  async save(data) {
    await set(KEY, data, store);
  },
};
