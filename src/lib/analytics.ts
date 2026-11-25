// 利用状況の記録（PostHog）。ロードマップのステップ8〜10（課金した人の割合・続けて使う人の割合）を測るため。
// 送るのは「何をしたか」だけ。調べた言葉の中身・星の名前・メールアドレスは送らない。
// 画面の自動記録（autocapture）と画面の録画は使わない。鍵が空のときは何も送らない。
// 鍵（phc_ で始まる）は、記録を書き込むことしかできない「公開してよい鍵」。
import type { PostHog } from 'posthog-js';

export const POSTHOG_KEY: string = 'phc_woVdDVgLqCHvLY5yqhvMypiB5BW63Q8Nq3XK7JRddMgE';
export const POSTHOG_HOST: string = 'https://eu.i.posthog.com';

let ready: Promise<PostHog | null> | null = null;

function load(): Promise<PostHog | null> {
  if (!POSTHOG_KEY) return Promise.resolve(null);
  if (!ready) {
    ready = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(POSTHOG_KEY, {
          api_host: POSTHOG_HOST,
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          disable_session_recording: true,
          persistence: 'localStorage',
          person_profiles: 'identified_only',
        });
        return posthog;
      })
      .catch(() => null);
  }
  return ready;
}

/** 出来事を1つ記録する（失敗しても、アプリの動きには影響させない） */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  void load().then((p) => p?.capture(event, props));
}

/** ログインした人を、Supabase の利用者ID（メールアドレスではない）で結びつける */
export function identify(userId: string, props?: Record<string, string>) {
  void load().then((p) => p?.identify(userId, props));
}

/** ログアウトしたら、結びつきを外す */
export function resetIdentity() {
  void load().then((p) => p?.reset());
}
