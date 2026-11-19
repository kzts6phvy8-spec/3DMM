// AIで調べる：言葉を受け取り、AIにWebを検索させて「概要・記述（出典付き）・枝分かれする言葉」を返す。
// Supabase の Edge Functions（サーバー側で動く小さな処理）で動かす。AIの秘密の鍵（ANTHROPIC_API_KEY）は
// Supabase の Secrets にだけ置き、アプリには入れない。使えるのは、ログインしている有料プランの本人だけ。
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
- 枝（branches）は、元の言葉から派生したもの・元になったもの・考えた人・似た手法・対になるものなど、たどると知識が広がる言葉を選ぶ。ありふれた一般語（例：「アイデア」「方法」）は避ける。
- 調べ終えたら、submit_result を1回だけ呼んで終える。`;

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

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'AIの鍵がまだ登録されていません', code: 'nokey' }, 503);

  let query = '';
  try {
    query = String((await req.json()).query ?? '').trim();
  } catch {
    /* 下で弾く */
  }
  if (!query || query.length > 100) return json({ error: '調べる言葉を1〜100文字で入れてください', code: 'input' }, 400);

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
        system: SYSTEM,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }, submitTool],
        messages,
      } as Anthropic.Beta.MessageCreateParamsNonStreaming);

      if (res.stop_reason === 'refusal') return json({ error: 'この言葉は調べられませんでした', code: 'refusal' }, 422);
      const submitted = res.content.find((b) => b.type === 'tool_use' && b.name === 'submit_result');
      if (submitted && submitted.type === 'tool_use') return json({ result: submitted.input });
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
});
