# Googleスプレッドシートの書き出し（テキスト）から audio.js を作る（効果音の「場合分け」「何種類かから選ぶ」にも対応）
#  効果音のファイル名のセルに、何行か書いてあるとき：
#   ・「説明：ファイル名」の行 … 場合ごとの音（下の ALT の言葉で、どの場合かを決める）
#   ・ファイル名だけの行が2つ以上 … 鳴らすたびに、その中から1つを選ぶ
import sys, csv, io, json, os, re
sys.path.insert(0, os.path.dirname(__file__)); from audio_def import BGM, SE
ALT = [('上がる', 'bad'), ('下がった', 'bad'), ('下がる', 'good'), ('回復', 'good'), ('隠し部屋', 'hidden')]   # 説明に含まれる言葉 → 場合の名前（先に当たったもの）
src = open(sys.argv[1], encoding='utf-8').read()
def sheet(name):
    body = src.split('## Sheet name: ' + name)[1].split('## Sheet name:')[0]
    return list(csv.reader(io.StringIO(body.strip('\n'))))[1:]
def fn(s):
    s = s.strip()
    return s if not s or s == 'なし' or re.search(r'\.(mp3|ogg|wav|m4a)$', s, re.I) else s + '.mp3'   # 拡張子が書いてなければ .mp3 とみなす
cfg = {'BGM': {k: {'file': '', 'vol': 60, 'loop': True, 'fade': 1.0} for k, _ in BGM}, 'SE': {k: {'file': '', 'vol': 80} for k, _, _ in SE}}
for r in sheet('BGM'):
    if len(r) > 6 and r[1] in cfg['BGM']:
        cfg['BGM'][r[1]] = {'file': fn(r[3]), 'vol': int(r[4] or 60), 'loop': r[5].strip() != 'しない', 'fade': float(r[6] or 1)}
for r in sheet('効果音'):
    if len(r) > 5 and r[1] in cfg['SE']:
        lines = [x.strip() for x in r[4].split('\n') if x.strip()]; e = {'file': '', 'vol': int(r[5] or 80)}; plain = []
        for ln in lines:
            m = re.match(r'^(.*?)[：:](.+)$', ln)
            if m:
                key = next((v for w, v in ALT if w in m.group(1)), None)
                if key: e.setdefault('alt', {}).setdefault(key, fn(m.group(2))); continue
            plain.append(fn(ln))
        if len(plain) > 1: e['pick'] = plain
        e['file'] = plain[0] if plain else (list(e.get('alt', {}).values()) or [''])[0]
        cfg['SE'][r[1]] = e
t = open(sys.argv[2], encoding='utf-8').read(); head = t[:t.index('window.AUDIO = ') + len('window.AUDIO = ')]
open(sys.argv[2], 'w', encoding='utf-8').write(head + json.dumps(cfg, ensure_ascii=False, indent=1) + ';\n')
files = set()
for e in cfg['BGM'].values():
    if e['file'] and e['file'] != 'なし': files.add(e['file'])
for e in cfg['SE'].values():
    files |= {f for f in [e['file']] + e.get('pick', []) + list(e.get('alt', {}).values()) if f}
print(len(files), 'files'); print('\n'.join(sorted(files)))
