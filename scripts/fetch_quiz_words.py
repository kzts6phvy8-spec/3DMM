"""言葉クイズの候補の言葉（scripts/quiz_words.txt）について、日本語版Wikipediaの冒頭の文を取ってくる。

使い方：
  python3 scripts/fetch_quiz_words.py scripts/quiz_words.txt <出力.json>

- 20語ずつまとめて取得し、Wikipediaの制限（429）のときは指示された時間だけ待つ。
- 途中まで取れた分は cache.json に保存し、もう一度動かすと続きから取る。
- 出力は scripts/build_quiz.py の入力になる。
"""
import json, sys, time, urllib.parse, urllib.request
UA={"User-Agent":"KnowledgeCosmosDev/0.1 (quiz builder)"}
def api(params, tries=30):
    q=urllib.parse.urlencode({**params,'format':'json','formatversion':'2'}); wait=20
    for _ in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request('https://ja.wikipedia.org/w/api.php?'+q, headers=UA), timeout=60) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            ra=e.headers.get('Retry-After'); w=float(ra) if ra and ra.isdigit() else wait
            print('retry', e.code, w, file=sys.stderr, flush=True); time.sleep(w); wait=min(wait*1.5,120)
        except Exception as e:
            print('retry', repr(e)[:80], file=sys.stderr, flush=True); time.sleep(wait); wait=min(wait*1.5,120)
    raise SystemExit('FAIL')
items=[]
for line in open(sys.argv[1]):
    line=line.strip()
    if not line or line.startswith('#'): continue
    cat, words = line.split('|')
    items += [(w, cat) for w in words.split(',')]
import os
CACHE = sys.argv[2] + '.cache.json'
out=json.load(open(CACHE)) if os.path.exists(CACHE) else {}
for i in range(0, len(items), 20):
    chunk=[x for x in items[i:i+20] if x[0] not in out]
    if not chunk: continue
    d=api({'action':'query','prop':'extracts|pageprops','exintro':'1','explaintext':'1','redirects':'1','ppprop':'disambiguation','titles':'|'.join(w for w,_ in chunk)})
    q=d['query']; m={}
    for x in q.get('normalized',[])+q.get('redirects',[]): m[x['from']]=x['to']
    pages={p['title']:p for p in q['pages']}
    for w,cat in chunk:
        t=w
        while t in m: t=m[t]
        p=pages.get(t,{})
        out[w]={'q':w,'cat':cat,'title':t,'missing':p.get('missing',False) or not p,'disambig':'disambiguation' in p.get('pageprops',{}),'extract':p.get('extract','')}
    json.dump(out, open(CACHE,'w'), ensure_ascii=False)
    print('done', len(out), file=sys.stderr, flush=True); time.sleep(10)
json.dump(list(out.values()), open(sys.argv[2],'w'), ensure_ascii=False, indent=1)
