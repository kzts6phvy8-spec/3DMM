// AIで調べる：Supabase の Edge Function（supabase/functions/ai-search）を呼び、結果を確かめて整える。
// AIの秘密の鍵はサーバー側にだけある。アプリはログインの印（JWT）を付けて頼むだけ。
import { RELATION_TYPES, STAR_KINDS, type RelationType, type StarKind } from '../types';

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

export type AiSearchOutcome = { ok: true; result: AiSearchResult } | { ok: false; code: string; message: string };

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
  if (!s.session) return { ok: false, code: 'login', message: 'AIで調べるには、ログインが必要です（「その他」→「同期」）。' };
  const { data, error } = await sb.functions.invoke('ai-search', { body: { query } });
  if (error) {
    // サーバーが返した理由（日本語）を読み出す
    let body: { error?: string; code?: string } | null = null;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') body = await ctx.json();
    } catch {
      /* 読めなければ下の一般的な文にする */
    }
    return { ok: false, code: body?.code ?? 'network', message: body?.error ?? 'AIにつながりませんでした。通信を確かめて、もう一度試してください。' };
  }
  const result = normalizeResult((data as { result?: unknown })?.result, query);
  if (!result) return { ok: false, code: 'empty', message: 'AIの結果を読み取れませんでした。もう一度試してください。' };
  return { ok: true, result };
}
