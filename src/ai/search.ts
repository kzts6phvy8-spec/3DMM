// AIで調べる：Supabase の Edge Function（supabase/functions/ai-search）を呼び、結果を確かめて整える。
// AIの秘密の鍵はサーバー側にだけある。アプリはログインの印（JWT）を付けて頼むだけ。
import { RELATION_TYPES, STAR_KINDS, type RelationType, type StarKind } from '../types';
import { AI_SEARCH_FUNCTION } from '../sync/config';

export interface AiBranch {
  name: string;
  reason: string;
  relationType: RelationType;
  sourceUrls: string[];
}

export interface AiSearchResult {
  title: string;
  qualifier: string;
  kind: StarKind;
  summary: string;
  statements: { text: string; topic: string; sourceUrls: string[] }[];
  branches: AiBranch[];
  sources: { url: string; title: string }[];
}

/** 今月のAIで調べる回数（無料は月20回・有料は月300回） */
export interface AiQuota {
  used: number;
  limit: number;
}

export type AiSearchOutcome =
  | { ok: true; result: AiSearchResult; searchEntryPoint: string | null; quota: AiQuota | null }
  | { ok: false; code: string; message: string; quota?: AiQuota | null };

const toQuota = (q: unknown): AiQuota | null => {
  const v = q as { used?: unknown; limit?: unknown } | null;
  return v && typeof v.used === 'number' && typeof v.limit === 'number' ? { used: v.used, limit: v.limit } : null;
};

/** 今月の回数を読む。ログインしていない・準備ができていないときは null */
export async function aiQuota(): Promise<AiQuota | null> {
  try {
    const { client } = await import('../sync/sync');
    const sb = await client();
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return null;
    const { data, error } = await sb.rpc('ai_quota');
    if (error || !(data as { ok?: boolean })?.ok) return null;
    return toQuota(data);
  } catch {
    return null;
  }
}

/**
 * Google検索の候補（Gemini を使ったとき）。Googleの決まりで、検索で確かめた結果には表示が必要とされているので、
 * 調べた星の画面に出す。星のIDごとに、アプリを開いている間だけ覚えておく。
 */
export const searchEntryPoints = new Map<string, string>();

const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const urls = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map((u) => str(u, 1000)).filter((u) => /^https?:\/\//.test(u)))].slice(0, 5) : [];
const list = (v: unknown, max: number): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').slice(0, max) : [];

/** AIの答えは信用しすぎず、形と長さをここで確かめる */
export function normalizeResult(raw: unknown, query: string): AiSearchResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 80) || query;
  const kind = (Object.keys(STAR_KINDS) as StarKind[]).includes(r.kind as StarKind) ? (r.kind as StarKind) : 'other';
  const statements = list(r.statements, 6)
    .map((s) => ({ text: str(s.text), topic: str(s.topic, 20), sourceUrls: urls(s.source_urls) }))
    .filter((s) => s.text);
  const seen = new Set([title]);
  const branches: AiBranch[] = [];
  for (const b of list(r.branches, 12)) {
    const name = str(b.name, 60);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const type = b.relation_type as RelationType;
    branches.push({
      name,
      reason: str(b.reason, 200),
      relationType: type in RELATION_TYPES ? type : 'other',
      sourceUrls: urls(b.source_urls),
    });
  }
  const sources = list(r.sources, 20)
    .map((s) => ({ url: str(s.url, 1000), title: str(s.title, 200) }))
    .filter((s) => /^https?:\/\//.test(s.url));
  if (!statements.length && !branches.length) return null;
  return { title, qualifier: str(r.qualifier, 30), kind, summary: str(r.summary, 200), statements, branches, sources };
}

export async function aiSearch(query: string): Promise<AiSearchOutcome> {
  const { client } = await import('../sync/sync');
  const sb = await client();
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return { ok: false, code: 'login', message: 'AIで調べるには、ログインが必要です（無料・月20回まで）。「その他」→「アカウントと同期」から登録・ログインできます。' };
  // 返事が来ないまま「調べています」で止まらないように、2分で打ち切る
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 120_000));
  const answer = await Promise.race([sb.functions.invoke(AI_SEARCH_FUNCTION, { body: { query } }), timeout]);
  if (answer === 'timeout') return { ok: false, code: 'network', message: 'AIからの返事が2分来ませんでした。少し待ってから、もう一度試してください。' };
  const { data, error } = answer;
  if (error) {
    // サーバーが返した理由（日本語）を読み出す
    let body: { error?: string; code?: string; detail?: string; quota?: unknown } | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') body = await ctx.json();
    } catch {
      /* 読めなければ下の一般的な文にする */
    }
    const detail = typeof body?.detail === 'string' && body.detail ? `（AIの会社からの理由：${body.detail.slice(0, 400)}）` : '';
    return {
      ok: false,
      code: body?.code ?? 'network',
      message: (body?.error ?? 'AIにつながりませんでした。通信を確かめて、もう一度試してください。') + detail,
      quota: toQuota(body?.quota),
    };
  }
  // 関数は通信をつないでおくため、失敗も「成功（200）」の形で返し、本文の error で伝える
  const failed = data as { error?: unknown; code?: unknown; detail?: unknown } | null;
  if (failed && typeof failed.error === 'string') {
    const detail = typeof failed.detail === 'string' && failed.detail ? `（AIの会社からの理由：${failed.detail.slice(0, 400)}）` : '';
    return {
      ok: false,
      code: typeof failed.code === 'string' ? failed.code : 'network',
      message: failed.error + detail,
      quota: toQuota((failed as { quota?: unknown }).quota),
    };
  }
  const result = normalizeResult((data as { result?: unknown })?.result, query);
  if (!result) return { ok: false, code: 'empty', message: 'AIの結果を読み取れませんでした。もう一度試してください。' };
  const entry = (data as { searchEntryPoint?: unknown })?.searchEntryPoint;
  return {
    ok: true,
    result,
    searchEntryPoint: typeof entry === 'string' && entry.length < 20000 ? entry : null,
    quota: toQuota((data as { quota?: unknown })?.quota),
  };
}
