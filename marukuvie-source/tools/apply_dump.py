# Googleスプレッドシートの書き出し（テキスト）から、単純な差し替え（話し手が変わらない・行が増えない）だけを story.js に反映する。
# 「話し手：」付きの行や「セリフなし」は、演出と合わせて手で反映するので、ここでは一覧に出すだけ。
import sys, csv, io, re
src = open(sys.argv[1], encoding='utf-8').read(); SP = sys.argv[2]
story = open(SP, encoding='utf-8').read()
secs = {m.group(1): m.end() for m in re.finditer(r'^## Sheet name: (.+)$', src, re.M)}
def sheet(name):
    a = secs[name]; nxt = [v for v in secs.values() if v > a]; b = min(nxt) if nxt else len(src)
    body = src[a:b]; body = body[:body.rfind('\n## ')] if '\n## ' in body else body
    return list(csv.reader(io.StringIO(body.strip('\n'))))
q1 = lambda t: "'" + t.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"
def nth(s, old, new, n):
    i, st = -1, 0
    for _ in range(n):
        i = s.find(old, st)
        if i < 0: raise SystemExit('見つからない: ' + old[:40])
        st = i + len(old)
    return s[:i] + new + s[i + len(old):]
manual, done = [], []
rows = sheet('セリフ')[1:]
# 同じ文の差し替えで、照合番号がずれないよう、後ろの出現から順に置き換える
todo = []
for r in rows:
    if len(r) < 14 or not r[9].strip(): continue
    new = r[9].strip('\n')
    if new.startswith('セリフなし') or re.search(r'^(ルノ|アルボ|アミーナ|フラメト|地の文)：', new, re.M): manual.append((r[0], r[1], new)); continue
    todo.append((r[8], new, int(r[13]), r[0], r[1]))
todo.sort(key=lambda t: -t[2])
for old, new, n, no, id_ in todo: story = nth(story, q1(old), q1(new), n); done.append('%s %s' % (no, id_))
for r in sheet('案内文')[1:]:
    if len(r) >= 10 and r[5].strip(): story = nth(story, q1(r[4]), q1(r[5].strip()), int(r[9])); done.append('案内 ' + r[1])
for r in sheet('結末')[1:]:
    if len(r) >= 8 and r[7].strip(): story = nth(story, 'note: ' + q1(r[5]), 'note: ' + q1(r[7].strip()), 1); done.append('結末説明 ' + r[1])
open(SP, 'w', encoding='utf-8').write(story)
print('反映', len(done)); print('手で反映するもの:'); [print(' ', m[0], m[1], m[2].replace('\n', ' / ')[:80]) for m in manual]
