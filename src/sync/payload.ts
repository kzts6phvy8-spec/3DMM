// 同期で送るデータの形：宇宙のデータ全体（星・記述・出典・つながり・関わり方の記録・連続記録）を
// JSON にして gzip で圧縮し、文字（base64）にする。星が1万個あっても約1.5MBに収まるように。
import type { CosmosData } from '../types';
import type { EngagementMap } from '../lib/engagement';

export interface SyncPayload {
  app: 'knowledge-cosmos';
  version: 2;
  savedAt: string;
  data: CosmosData;
  engagement: EngagementMap;
  activity: string[];
}

async function streamBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encodePayload(p: SyncPayload): Promise<string> {
  const json = new Blob([JSON.stringify(p)]).stream();
  return toBase64(await streamBytes(json.pipeThrough(new CompressionStream('gzip'))));
}

export async function decodePayload(text: string): Promise<SyncPayload> {
  const gz = new Blob([fromBase64(text) as BlobPart]).stream();
  const json = await new Response(gz.pipeThrough(new DecompressionStream('gzip'))).text();
  const p = JSON.parse(json);
  if (p?.app !== 'knowledge-cosmos' || !p.data || !Array.isArray(p.data.nodes)) throw new Error('同期データの形が正しくありません');
  return p as SyncPayload;
}
