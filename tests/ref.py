#!/usr/bin/env python3
"""分一筐脏衣服 · 独立参考实现（按需求简报文字规则重写，不读 core.js）。
用「把每件衣服分进各缸」的全部集合划分暴力穷举（件数 ≤ 9），找：
  缸数最少 → 同缸数下「降档重量」最少（衣服能接受的程序比缸里程序粗的那部分干重之和）。
规则：
  颜色 白w 浅l 深d 易掉色b：同色可同缸；b 只和 b；w-d 永不；w-l 看开关 wl；l-d 看开关 ld。
  缸的程序 = 缸里最温和的（标准0<轻柔1<羊毛2）；每缸干重 ≤ floor(额定克 × 该程序比例% / 100)。
生成 300 组 → tests/ref.json。"""
import json, random

def compat(a, b, wl, ld):
    if a == b: return True
    if 'b' in (a, b): return False
    k = ''.join(sorted([a, b]))
    return {'dw': False, 'lw': wl, 'dl': ld}.get(k, False)

def partitions(xs):
    if not xs:
        yield []
        return
    first, rest = xs[0], xs[1:]
    for p in partitions(rest):
        for i in range(len(p)):
            yield p[:i] + [[first] + p[i]] + p[i + 1:]
        yield [[first]] + p

def solve(case):
    cap_g = round(case['cap'] * 10) * 100
    caps = [cap_g * case['pct'][q] // 100 for q in range(3)]
    pieces = []
    for it in case['items']:
        pieces += [(it['w'], it['col'], it['prog'])] * it['c']
    best = None
    for p in partitions(pieces):
        ok, down = True, 0
        for grp in p:
            prog = max(x[2] for x in grp)
            if sum(x[0] for x in grp) > caps[prog]: ok = False; break
            cols = set(x[1] for x in grp)
            if any(not compat(a, b, case['wl'], case['ld']) for a in cols for b in cols): ok = False; break
            down += sum(x[0] for x in grp if x[2] < prog)
        if ok:
            key = (len(p), down)
            if best is None or key < best: best = key
    return best

def gen(rng):
    n_rows = rng.randint(1, 4)
    items, total = [], 0
    for i in range(n_rows):
        c = rng.randint(1, 3)
        if total + c > 8: c = max(1, 8 - total)
        if total + c > 8: break
        total += c
        items.append({'n': '衣%d' % i, 'c': c, 'w': rng.choice([50, 120, 300, 450, 700, 1000, 1500]),
                      'col': rng.choice('wldb'), 'prog': rng.choice([0, 0, 1, 2]), 't': rng.choice([20, 30, 40, 60, 90])})
    return {'cap': rng.choice([3.0, 5.0, 6.5, 8.0, 10.0]), 'pct': [100, rng.choice([40, 50, 60]), rng.choice([20, 30, 40])],
            'wl': rng.random() < .5, 'ld': rng.random() < .3, 'items': items}

rng = random.Random(20261118)
cases = []
while len(cases) < 300:
    c = gen(rng)
    caps = [round(c['cap'] * 10) * 100 * c['pct'][q] // 100 for q in range(3)]
    if any(it['w'] > caps[it['prog']] for it in c['items']): continue
    r = solve(c)
    cases.append({'in': c, 'L': r[0], 'down': r[1]})
print('cases', len(cases), 'down>0', sum(1 for c in cases if c['down']), 'L dist', sorted(set(c['L'] for c in cases)))
json.dump({'cases': cases}, open(__file__.replace('ref.py', 'ref.json'), 'w'), ensure_ascii=False)
