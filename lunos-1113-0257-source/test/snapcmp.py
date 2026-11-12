# 前後の画面を比べる：ハッシュが違うものだけ、画素の差を数える
import json, sys, os
from PIL import Image, ImageChops
A, B = sys.argv[1], sys.argv[2]
ha, hb = json.load(open(A + '/hashes.json')), json.load(open(B + '/hashes.json'))
miss = sorted(set(ha) ^ set(hb)); bad = []
for k in sorted(set(ha) & set(hb)):
    if ha[k] == hb[k]: continue
    f = k.replace('/', '_') + '.png'
    a, b = Image.open(os.path.join(A, f)).convert('RGB'), Image.open(os.path.join(B, f)).convert('RGB')
    d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 24 else 0)
    n = sum(1 for v in d.getdata() if v); bad.append((k, n))
print('比べた数', len(set(ha) & set(hb)), '片方だけ', miss)
print('ハッシュが違う', len(bad), [b for b in bad if b[1] > 0][:30])
