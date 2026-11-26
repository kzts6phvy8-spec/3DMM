// 初期セットの作り直し（scripts/refresh_starter.py --write）で作った差し替え一覧の目録。
// このフォルダに <年-月>.json を置くだけで、アプリが見つけて、各端末に1回だけ反映する（useCosmos の init）。
// 中身は必要なときだけ読み込む（ふだんの起動を軽くするため）。
import type { StarterRefresh } from '../applyRefresh';

const files = import.meta.glob<{ default: StarterRefresh }>('./*.json');

/** 差し替え一覧の版（古い順） */
export const REFRESH_VERSIONS: string[] = Object.keys(files)
  .map((path) => path.replace(/^\.\/(.+)\.json$/, '$1'))
  .sort();

export const loadRefresh = async (version: string): Promise<StarterRefresh> => (await files[`./${version}.json`]()).default;

/** 端末に反映したかの印の名前 */
export const refreshFlag = (version: string) => `refresh-${version}`;
