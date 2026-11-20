// AIで調べる：言葉を受け取り、AIにWebを検索させて「概要・記述（出典付き）・枝分かれする言葉」を返す。
// Supabase の Edge Functions（サーバー側で動く小さな処理）で動かす。AIの秘密の鍵は Supabase の Secrets にだけ置き、
// アプリには入れない。使えるのは、ログインしている有料プランの本人だけ。
// 使うAIは、預けた鍵で決まる（交換できるようにするため）：
//   GEMINI_API_KEY があれば Google の Gemini（Google検索で確かめる）。モデルは GEMINI_MODEL で変えられる
//   なければ ANTHROPIC_API_KEY で Claude（Web検索で確かめる）
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'claude-opus-5-5';
const MAX_CONTINUE = 4;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const RELATION_TYPES = ['causal', 'similarity', 'historical', 'opposition', 'application', 'partWhole', 'other'];
const STAR_KINDS = ['person', 'concept', 'event', 'place', 'work', 'term', 'other'];

const urlList = { type: 'array', items: { type: 'string' }, description: '根拠にしたページのURL（Web検索で実際に開いたもの）' };

// 結果はこの道具（submit_result）を呼んでもらう形で受け取る。形が必ずそろうように strict にする。
const submitTool = {
  name: 'submit_result',
  description: '調べ終えたら、結果をこの形で1回だけ提出する。',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'qualifier', 'kind', 'summary', 'statements', 'branches', 'sources'],
    properties: {
      title: { type: 'string', description: '言葉の正式な見出し語（日本語）' },
      qualifier: { type: 'string', description: '同名の別のものと区別する短い補足。不要なら空文字' },
      kind: { type: 'string', enum: STAR_KINDS },
      summary: { type: 'string', description: '何であるかを1文で（60字程度まで）' },
      statements: {
        type: 'array',
        description: 'この言葉についての事実を2〜4文。由来・語源・考案者など、クイズになりそうな事実を優先',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'topic', 'source_urls'],
          properties: {
            text: { type: 'string' },
            topic: { type: 'string', description: '例：定義・語源・由来・歴史・人物。短い言葉で' },
            source_urls: urlList,
          },
        },
      },
      branches: {
        type: 'array',
        description: 'この言葉から派生・関連して知る価値のある言葉を5〜8個。調べた人が「これも知った」と思えるもの',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'reason', 'relation_type', 'source_urls'],
          properties: {
            name: { type: 'string', description: '言葉の見出し語（日本語）' },
            reason: { type: 'string', description: 'なぜつながるかを1文で。例：「オズボーンのチェックリストを、英語の頭文字で7つにまとめたもの」' },
            relation_type: { type: 'string', enum: RELATION_TYPES },
            source_urls: urlList,
          },
        },
      },
      sources: {
        type: 'array',
        description: '上で使ったURLすべての一覧',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['url', 'title'],
          properties: { url: { type: 'string' }, title: { type: 'string' } },
        },
      },
    },
  },
};

const SYSTEM = `あなたは、日本語の言葉を調べる手伝いをする。利用者は、日常で気になった言葉を調べ、そこから派生する言葉を知っていくことを楽しんでいる。
- 必ずWeb検索で確かめてから答える。検索で確かめられなかったことは書かない。
- 記述と枝のそれぞれに、根拠にしたページのURLを付ける。URLは検索結果に実際に出てきたものだけを使う。
- 枝（branches）は、元の言葉から派生したもの・元になったもの・考えた人・似た手法・対になるものなど、たどると知識が広がる言葉を選ぶ。ありふれた一般語（例：「アイデア」「方法」）は避ける。`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POSTで呼んでください' }, 405);

  // ---- 本人確認と、有料プランかどうか ----
  const auth = req.headers.get('Authorization') ?? '';
  // 接続先と公開してよい鍵は、Supabase が自動で用意する。なければアプリと同じもの（公開してよい鍵）を使う
  const url = Deno.env.get('SUPABASE_URL') ?? 'https://qhaxsvljyohdohromjch.supabase.co';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? 'sb_publishable_hG5FBFMHuLcKpVhgLAd4-A_fMmLyTXB';
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError || !userData.user) return json({ error: 'ログインしてください', code: 'login' }, 401);
  const { data: profile } = await sb.from('profiles').select('plan').eq('user_id', userData.user.id).maybeSingle();
  if (profile?.plan !== 'paid') return json({ error: '有料プランの機能です', code: 'plan' }, 403);

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const claudeKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!geminiKey && !claudeKey) return json({ error: 'AIの鍵がまだ登録されていません', code: 'nokey' }, 503);

  let query = '';
  try {
    query = String((await req.json()).query ?? '').trim();
  } catch {
    /* 下で弾く */
  }
  if (!query || query.length > 100) return json({ error: '調べる言葉を1〜100文字で入れてください', code: 'input' }, 400);

  return geminiKey ? askGemini(query, geminiKey) : askClaude(query, claudeKey!);
});

// ================= Claude =================
async function askClaude(query: string, apiKey: string): Promise<Response> {
  const client = new Anthropic({ apiKey });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: `「${query}」を調べてください。` }];
  try {
    for (let i = 0; i <= MAX_CONTINUE; i++) {
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM + '\n- 調べ終えたら、submit_result を1回だけ呼んで終える。',
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }, submitTool],
        messages,
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);

      if (res.stop_reason === 'refusal') return json({ error: 'この言葉は調べられませんでした', code: 'refusal' }, 422);
      const submitted = res.content.find((b) => b.type === 'tool_use' && b.name === 'submit_result');
      if (submitted && submitted.type === 'tool_use') return json({ result: submitted.input, provider: 'claude' });
      // サーバー側の検索の途中で一時停止したら、そのまま続けてもらう
      if (res.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: res.content });
        continue;
      }
      // 提出せずに終わったら、提出だけを頼む
      messages.push({ role: 'assistant', content: res.content });
      messages.push({ role: 'user', content: 'submit_result を呼んで、結果を提出してください。' });
    }
    return json({ error: 'AIが結果をまとめられませんでした。もう一度試してください', code: 'incomplete' }, 502);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: '混み合っています。少し待ってから試してください', code: 'busy' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'AIの鍵が正しくありません', code: 'nokey' }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: `AIの呼び出しに失敗しました（${e.status}）`, code: 'api' }, 502);
    return json({ error: 'AIにつながりませんでした', code: 'network' }, 502);
  }
}

// ================= Gemini =================
interface GeminiChunk { web?: { uri?: string; title?: string } }
interface GeminiSupport { segment?: { text?: string }; groundingChunkIndices?: number[] }

async function askGemini(query: string, apiKey: string): Promise<Response> {
  // 無料枠で使えないモデルもあるので、上限（429）や見つからない（404）ときは次のモデルで試す
  const models = Deno.env.get('GEMINI_MODEL')
    ? [Deno.env.get('GEMINI_MODEL')!]
    : ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const prompt =
    `「${query}」を、Google検索で確かめながら調べてください。\n` +
    '結果は、次のJSONスキーマに合うJSONだけで答えてください（前後に説明や```を付けない）。source_urls と sources は空の配列でかまいません（出典はこちらで付けます）。\n' +
    JSON.stringify(submitTool.input_schema);
  const body = (withSchema: boolean) => ({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: withSchema ? { responseMimeType: 'application/json', responseJsonSchema: submitTool.input_schema } : {},
  });

  // Googleが返した理由の文を取り出す（画面とLogsに出して、原因がわかるようにする）
  const reasonOf = async (r: globalThis.Response) => {
    const t = await r.text();
    try {
      return String(JSON.parse(t)?.error?.message ?? t).slice(0, 300);
    } catch {
      return t.slice(0, 300);
    }
  };
  const call = (model: string, withSchema: boolean) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body(withSchema)),
    });

  let res: globalThis.Response | null = null;
  const tried: string[] = [];
  try {
    for (const model of models) {
      let r = await call(model, true);
      // 検索と決まった形の答え（スキーマ）を同時に使えないモデルなら、スキーマなしでもう一度
      if (r.status === 400) r = await call(model, false);
      if (r.status === 429 || r.status === 404) {
        const why = await reasonOf(r);
        console.error('gemini', model, r.status, why);
        tried.push(`${model}（${r.status}）：${why}`);
        continue;
      }
      res = r;
      break;
    }
  } catch {
    return json({ error: 'AIにつながりませんでした', code: 'network' }, 502);
  }
  if (!res) return json({ error: '無料枠で使える回数を超えたか、このモデルは無料枠で使えません', code: 'busy', detail: tried.join(' ／ ').slice(0, 600) }, 429);
  if (res.status === 401 || res.status === 403) {
    const why = await reasonOf(res);
    console.error('gemini auth', res.status, why);
    return json({ error: 'AIの鍵が正しくないか、使えない設定です', code: 'nokey', detail: why }, 503);
  }
  if (!res.ok) {
    const detail = await reasonOf(res);
    console.error('gemini error', res.status, detail);
    return json({ error: `AIの呼び出しに失敗しました（${res.status}）`, code: 'api', detail }, 502);
  }

  const data = await res.json();
  const cand = data?.candidates?.[0];
  if (!cand) return json({ error: 'この言葉は調べられませんでした', code: 'refusal' }, 422);
  const text: string = (cand.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  const result = parseJson(text);
  if (!result) return json({ error: 'AIの結果を読み取れませんでした。もう一度試してください', code: 'incomplete' }, 502);

  // 出典は、Google検索で実際に使われたページ（groundingChunks）から付ける。AIが書いたURLは使わない
  const meta = cand.groundingMetadata ?? {};
  const chunks: GeminiChunk[] = meta.groundingChunks ?? [];
  const supports: GeminiSupport[] = meta.groundingSupports ?? [];
  const pages = chunks.map((c) => ({ url: c.web?.uri ?? '', title: c.web?.title ?? '' }));
  const urlsFor = (t: unknown): string[] => {
    const s = typeof t === 'string' ? t : '';
    if (!s) return [];
    const idx = new Set<number>();
    for (const sp of supports) {
      const seg = (sp.segment?.text ?? '').trim();
      if (seg.length >= 6 && (s.includes(seg) || seg.includes(s))) for (const k of sp.groundingChunkIndices ?? []) idx.add(k);
    }
    return [...idx].map((k) => pages[k]?.url).filter((u): u is string => !!u);
  };
  const all = pages.map((p) => p.url).filter(Boolean);
  const r = result as Record<string, unknown>;
  const statements = (Array.isArray(r.statements) ? r.statements : []).map((st: Record<string, unknown>) => {
    const own = urlsFor(st.text);
    // 文ごとの対応が取れなければ、検索で使った最初のページを出典にする（出典なしにはしない）
    return { ...st, source_urls: own.length ? own : all.slice(0, 2) };
  });
  const branches = (Array.isArray(r.branches) ? r.branches : []).map((b: Record<string, unknown>) => ({ ...b, source_urls: urlsFor(b.reason) }));
  return json({
    result: { ...r, statements, branches, sources: pages.filter((p) => p.url) },
    provider: 'gemini',
    // Google検索の候補（Googleの決まりで表示が必要とされている部分）。アプリ側で表示する
    searchEntryPoint: meta.searchEntryPoint?.renderedContent ?? null,
  });
}

function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
