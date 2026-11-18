/* 分一筐脏衣服 · 核心测试：node --test tests/core.test.cjs
 * 锚点：tests/ref.json（独立 Python 按文字规则写的集合划分暴力穷举，300 组）、默认场景手算、
 *       颜色规则、程序容量取整与阈值两侧、降档平局规则、非法输入、改法真的少一缸、步数上限时的措辞、导出。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require(path.join(__dirname, '..', 'core.js'));
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
const D = () => A.defaultState();
const it = (n, c, w, col, prog, t) => ({ n, c: String(c), w: String(w), col, prog: String(prog), t: String(t || 40) });
const one = (items, o) => Object.assign(D(), { items }, o || {});

test('默认场景：手算读数、标题、说明、每缸、改法', () => {
  const o = A.compute(D()); assert.ok(o.ok, JSON.stringify(o.errors));
  const s = o.ev.sol;
  /* 36 件：6+4+3+2+5+1+2+1+12；干重 1080+880+1950+1200+1750+1600+800+200+600 = 10060 克 */
  assert.equal(o.ev.pieces, 36); assert.equal(o.ev.w, 10060);
  assert.deepEqual(o.P.cap, [8000, 4000, 2400]);
  assert.equal(s.L, 5); assert.equal(s.down, 0); assert.ok(s.proven);
  assert.equal(o.ev.colorLB.n, 3); assert.equal(o.ev.weightLB, 2);
  assert.deepEqual(s.loads.map((l) => [l.no, A.PROG_NAME[l.prog], A.colsName(l), l.temp, A.hm(l.t0), A.hm(l.t1), l.w, A.listText(o.P, l)]), [
    [1, '标准', '白+浅', 40, '09:00', '09:55', 5310, '白T恤 6 件、浅色衬衫 4 件、毛巾 5 件、床单被套 1 件'],
    [2, '轻柔', '浅', 40, '10:05', '10:45', 600, '内衣袜子 12 件'],
    [3, '标准', '深', 40, '10:55', '11:50', 3150, '牛仔裤 3 件、深色卫衣 2 件'],
    [4, '羊毛', '深', 30, '12:00', '12:35', 800, '羊毛衫 2 件'],
    [5, '标准', '易掉色', 30, '12:45', '13:40', 200, '新买的红T恤 1 件']]);
  assert.equal(A.headline(o), '周末这一筐：36 件、10.06 公斤，最少要洗 5 缸。09:00 开始，13:40 全部洗完。');
  assert.match(A.explain(o), /^颜色上至少 3 缸（白、深、易掉色两两不能同缸），重量上至少 2 缸（10\.06 ÷ 8\.00 公斤）。实际比下限多 2 缸，5 缸里有 2 缸走轻柔或羊毛（轻柔一缸最多 4\.00 公斤、羊毛最多 2\.40 公斤）。每件衣服放进每一缸的分法都试过了（[\d,]+ 步），5 缸是最少；.*没有衣服被迫降档。$/);
  assert.deepEqual(o.actions.map((a) => a.text), [
    '允许浅色和深色同缸：5 → 4 缸（深色可能掉色到浅色上，看衣服本身）',
    '「新买的红T恤」这次先不洗，攒到下一筐：5 → 4 缸',
    '「羊毛衫」这 2 件这次先不洗，攒到下一筐：5 → 4 缸',
    '「牛仔裤」这 3 件这次先不洗，攒到下一筐：5 → 4 缸']);
  /* 每件都进了且只进了一缸；每缸不超该程序容量；同缸颜色两两相容；程序 = 缸里最温和 */
  const cnt = o.P.items.map(() => 0);
  s.loads.forEach((l) => {
    l.list.forEach((x) => { cnt[x.ti] += x.k; });
    assert.ok(l.w <= o.P.cap[l.prog]);
    assert.equal(l.w, l.list.reduce((a, x) => a + x.k * o.P.items[x.ti].w, 0));
    assert.equal(l.prog, Math.max(...l.list.map((x) => o.P.items[x.ti].prog)));
    l.cols.forEach((a) => l.cols.forEach((b) => assert.ok(A.compat(a, b, o.P))));
  });
  assert.deepEqual(cnt, o.P.items.map((x) => x.c));
});

test('与独立 Python 暴力穷举逐组对拍（300 组：最少缸数 + 同缸数最少降档重量）', () => {
  assert.equal(REF.cases.length, 300);
  const Ls = new Set(REF.cases.map((c) => c.L)); assert.ok(Ls.size >= 5);
  assert.ok(REF.cases.filter((c) => c.down > 0).length >= 40);
  REF.cases.forEach((c, k) => {
    const s = Object.assign(D(), { cap: c.in.cap.toFixed(1), pct0: '100', pct1: String(c.in.pct[1]), pct2: String(c.in.pct[2]), wl: c.in.wl ? '1' : '0', ld: c.in.ld ? '1' : '0',
      items: c.in.items.map((i) => it(i.n, i.c, i.w, i.col, i.prog, i.t)) });
    const o = A.compute(s); assert.ok(o.ok, '#' + k);
    assert.equal(o.ev.sol.L, c.L, '#' + k + ' 缸数'); assert.equal(o.ev.sol.down, c.down, '#' + k + ' 降档'); assert.ok(o.ev.sol.proven, '#' + k);
  });
});

test('颜色规则：白深永不同缸、易掉色只和易掉色、两个开关', () => {
  const P = { wl: false, ld: false };
  assert.equal(A.compat('w', 'd', { wl: true, ld: true }), false);
  ['w', 'l', 'd'].forEach((c) => assert.equal(A.compat('b', c, { wl: true, ld: true }), false));
  assert.equal(A.compat('b', 'b', P), true);
  assert.equal(A.compat('w', 'l', P), false); assert.equal(A.compat('w', 'l', { wl: true }), true);
  assert.equal(A.compat('l', 'd', P), false); assert.equal(A.compat('d', 'l', { ld: true }), true);
  /* 两件很轻的白和深：两个开关全开也得 2 缸；白+浅开关开 → 1 缸，关 → 2 缸 */
  const wd = one([it('白', 1, 100, 'w', 0), it('深', 1, 100, 'd', 0)], { wl: '1', ld: '1' });
  assert.equal(A.compute(wd).ev.sol.L, 2);
  assert.equal(A.compute(one([it('白', 1, 100, 'w', 0), it('浅', 1, 100, 'l', 0)], { wl: '1' })).ev.sol.L, 1);
  assert.equal(A.compute(one([it('白', 1, 100, 'w', 0), it('浅', 1, 100, 'l', 0)], { wl: '0' })).ev.sol.L, 2);
  /* 白浅深都开：白-浅-深 三件可以 2 缸（白+浅、深）或（白、浅+深），下限 2 */
  const o = A.compute(one([it('白', 1, 100, 'w', 0), it('浅', 1, 100, 'l', 0), it('深', 1, 100, 'd', 0)], { wl: '1', ld: '1' }));
  assert.equal(o.ev.sol.L, 2); assert.equal(o.ev.colorLB.n, 2);
});

test('程序容量：额定 × 比例向下取整到克，正好装满算放得下、多 1 克就要再开一缸', () => {
  const base = { cap: '6.5', pct1: '33' };
  let o = A.compute(one([it('a', 1, 100, 'w', 1)], base));
  assert.equal(o.P.capG, 6500); assert.equal(o.P.cap[1], 2145);   /* 6500 × 33% = 2145 */
  o = A.compute(one([it('a', 1, 2145, 'w', 1)], base)); assert.ok(o.ok); assert.equal(o.ev.sol.L, 1);
  o = A.compute(one([it('a', 1, 2146, 'w', 1)], base)); assert.ok(!o.ok);
  assert.match(o.errors[0].message, /比轻柔程序一缸能装的 2145 克还重/);
  /* 两件加起来正好 = 容量 → 1 缸；多 1 克 → 2 缸 */
  assert.equal(A.compute(one([it('a', 1, 1000, 'w', 1), it('b', 1, 1145, 'w', 1)], base)).ev.sol.L, 1);
  assert.equal(A.compute(one([it('a', 1, 1000, 'w', 1), it('b', 1, 1146, 'w', 1)], base)).ev.sol.L, 2);
  /* 标准衣服跟着走羊毛缸，那一缸的上限就降到羊毛的 */
  o = A.compute(one([it('毛衣', 1, 1000, 'w', 2), it('T', 3, 400, 'w', 0)], { cap: '8', pct2: '30' }));
  /* 羊毛缸 2400：毛衣 1000 + 3×400 = 2200 能装进 1 缸 → 缸数优先，接受 1200 克降档（初版测试期望写成 2 缸，是我写错） */
  assert.equal(o.ev.sol.L, 1); assert.equal(o.ev.sol.down, 1200); assert.equal(o.ev.sol.loads[0].prog, 2);
  /* 再加 1 件 T 恤到 2600 > 2400 → 装不进羊毛缸，2 缸，可以 0 降档 */
  o = A.compute(one([it('毛衣', 1, 1000, 'w', 2), it('T', 4, 400, 'w', 0)], { cap: '8', pct2: '30' }));
  assert.equal(o.ev.sol.L, 2); assert.equal(o.ev.sol.down, 0);
});

test('降档平局：同样缸数，挑被迫走温和程序的衣服最少的分法', () => {
  /* 全白：轻柔内衣 300、标准 T 恤 2×3500、标准毛巾 1500；8kg、轻柔 4kg。标准衣服 8500 一缸装不下，
     2 缸时轻柔缸必须分走至少 500 克标准衣服：带毛巾 → 降档 1500，带一件 T 恤 → 降档 3500 → 选毛巾 */
  const o = A.compute(one([it('内衣', 1, 300, 'w', 1), it('T恤', 2, 3500, 'w', 0), it('毛巾', 1, 1500, 'w', 0)], { cap: '8', pct1: '50' }));
  assert.equal(o.ev.sol.L, 2); assert.equal(o.ev.sol.down, 1500);
  const g = o.ev.sol.loads.find((l) => l.prog === 1);
  assert.equal(A.listText(o.P, g), '内衣 1 件、毛巾 1 件'); assert.equal(g.down, 1500);
  assert.match(A.explain(o), /仍有 1\.50 公斤要跟着降档/);
  /* 毛巾减到 900：标准衣服 7900 一缸装下，内衣单独走轻柔，降档 0 */
  assert.equal(A.compute(one([it('内衣', 1, 300, 'w', 1), it('T恤', 2, 3500, 'w', 0), it('毛巾', 1, 900, 'w', 0)], { cap: '8', pct1: '50' })).ev.sol.down, 0);
});

test('水温取缸里最低、时间跨过半夜写「次日」、颜色排序白→浅→深→易掉色', () => {
  const o = A.compute(one([it('红', 1, 200, 'b', 0, 30), it('毛巾', 1, 300, 'w', 0, 90), it('衬衫', 1, 200, 'w', 0, 40)], { start: '23:30', gap: '10' }));
  const l = o.ev.sol.loads;
  assert.deepEqual(l.map((x) => A.colsName(x)), ['白', '易掉色']);
  assert.equal(l[0].temp, 40); assert.equal(l[1].temp, 30);
  assert.equal(A.hm(l[0].t1), '次日 00:25'); assert.equal(A.hm(l[1].t0), '次日 00:35');
  assert.equal(A.hm(60 * 24 * 2 + 5), '第 3 天 00:05');
  assert.match(A.headline(o), /23:30 开始，次日 01:30 全部洗完/);
});

test('非法输入：每个字段都给出能定位的报错，不算结果', () => {
  const bad = Object.assign(D(), { cap: '8.25', pct1: '5', min0: '0', start: '25:00', gap: 'x' });
  bad.items = [it('', 0, 5, 'x', 9, 33), it('a', 1.5, 100, 'w', 0)];
  bad.items[1].c = '1.5';
  const o = A.compute(bad); assert.ok(!o.ok);
  const f = o.errors.map((e) => e.field);
  ['cap', 'pct1', 'min0', 'start', 'gap', 'i0c', 'i0w', 'i0col', 'i0prog', 'i0t', 'i1c'].forEach((k) => assert.ok(f.includes(k), k));
  assert.ok(o.errors.find((e) => e.field === 'i1c').message.endsWith('要填整数'));
  assert.equal(o.errors.find((e) => e.field === 'pct1').message, '轻柔程序装载比例要在 10～100%之间');
  assert.equal(A.compute(Object.assign(D(), { cap: '0.9' })).errors[0].message, '洗衣机额定容量要在 1～20 公斤之间');
  assert.ok(A.compute(Object.assign(D(), { cap: '１０' })).ok, '全角数字照常认');
  assert.ok(A.compute(Object.assign(D(), { cap: '20' })).ok); assert.ok(!A.compute(Object.assign(D(), { cap: '20.1' })).ok); assert.ok(A.compute(Object.assign(D(), { cap: '1' , items: [it('a', 1, 100, 'w', 0)] })).ok);
  assert.deepEqual(A.compute(Object.assign(D(), { items: [] })).errors.map((e) => e.message), ['至少填一样衣服']);
  assert.match(A.compute(Object.assign(D(), { items: Array.from({ length: 13 }, () => it('a', 1, 100, 'w', 0)) })).errors[0].message, /最多 12 行/);
  assert.match(A.compute(Object.assign(D(), { items: [it('a', 30, 100, 'w', 0), it('b', 30, 100, 'w', 0), it('c', 1, 100, 'w', 0)] })).errors[0].message, /最多算 60 件（现在 61 件）/);
  assert.ok(A.compute(Object.assign(D(), { items: [it('a', 30, 100, 'w', 0), it('b', 30, 100, 'w', 0)] })).ok, '正好 60 件能算');
  assert.ok(!A.compute(null).ok); assert.ok(!A.compute({}).ok);
});

test('改法：点了真的少一缸，按钮上写的缸数就是改完重算的缸数；先留几件是最少的件数', () => {
  const st = D(), o = A.compute(st);
  o.actions.forEach((a) => {
    const o2 = A.compute(A.applyChange(st, a));
    assert.ok(o2.ok); assert.equal(o2.ev.sol.L, a.after.L); assert.ok(a.after.L < o.ev.sol.L, a.text);
    if (a.kind === 'defer' && a.k > 1) assert.ok(A.compute(A.applyChange(st, Object.assign({}, a, { k: a.k - 1 }))).ev.sol.L >= o.ev.sol.L, '少留一件就不够');
  });
  /* 只需要留一部分的场景：白 8kg、只能装 8000，T 恤 41 × 200 = 8200 → 2 缸；留 1 件就 1 缸 */
  const s2 = one([it('T恤', 30, 200, 'w', 0), it('衬衫', 11, 200, 'w', 0)], { cap: '8' });
  const o2 = A.compute(s2); assert.equal(o2.ev.sol.L, 2);
  const a = o2.actions.find((x) => x.id === 'act_d0');
  assert.equal(a.k, 1); assert.equal(a.text, '「T恤」先留 1 件，攒到下一筐：2 → 1 缸');
  const after = A.applyChange(s2, a); assert.equal(after.items[0].c, '29'); assert.equal(A.compute(after).ev.sol.L, 1);
  /* 整行不洗会删掉那一行 */
  const rm = A.applyChange(D(), { kind: 'defer', row: 7, k: 1 }); assert.equal(rm.items.length, 8); assert.ok(!rm.items.some((x) => x.n === '新买的红T恤'));
  /* 已经到下限时没有改法 */
  assert.deepEqual(A.compute(one([it('a', 1, 100, 'w', 0)])).actions, []);
  /* 开关已经开着的不再建议 */
  assert.ok(!A.compute(Object.assign(D(), { ld: '1' })).actions.some((x) => x.id === 'act_ld'));
});

test('搜索步数上限：没试完就如实说没证明是最少，结果仍然是可行分法', () => {
  const items = [];
  const ws = [130, 170, 230, 290, 310, 370, 410, 470, 530, 590, 610, 670];
  ws.forEach((w, i) => items.push(it('x' + i, 5, w, 'l', i % 3 === 0 ? 1 : 0)));
  const r = A.parse(one(items, { cap: '5', wl: '1', ld: '1' }));
  const s = A.solve(r.P, 50);
  assert.equal(s.proven, false); assert.ok(s.L >= 1);
  s.loads.forEach((l) => assert.ok(l.w <= r.P.cap[l.prog]));
  assert.equal(s.loads.reduce((a, l) => a + l.pieces, 0), 60);
  const o = { ok: true, P: r.P, ev: { sol: s, pieces: 60, w: 0, colorLB: A.colorLB(r.P), weightLB: 1 } };
  assert.match(A.explain(o), /到上限还没试完，这是目前找到的最好分法，没能证明是最少。$/);
  assert.doesNotMatch(A.headline(o), /最少/);
  /* 同一组输入步数给够时结果不会更差 */
  const full = A.solve(r.P);
  assert.ok(full.L <= s.L);
});

test('导出：CSV 防公式注入、每件都在、MD 结构', () => {
  const st = one([it('=HYPERLINK("x")', 2, 300, 'w', 0), it('+1', 1, 300, 'd', 2, 30)]);
  const o = A.compute(st), csv = A.toCSV(o, '2026-11-18 13:00');
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`)); assert.ok(csv.includes(",'+1,"));
  assert.ok(csv.endsWith('\r\n'));
  const d = A.compute(D()), c2 = A.toCSV(d, 'T');
  assert.equal(c2.split('\r\n').filter((l) => /^\d,|^,/.test(l)).length, 9, '9 样衣服各一行');
  assert.ok(c2.includes('合计缸数,5,是否已证明最少,是'));
  const md = A.toMD(d, 'T');
  assert.equal((md.match(/^## 第 \d 缸/gm) || []).length, 5);
  assert.ok(md.includes('- 走羊毛是因为：羊毛衫')); assert.ok(md.includes('## 改一样试试'));
  assert.ok(md.includes('默认数字是虚构示例'));
});

test('数字格式：公斤两位小数四舍五入、装满百分比四舍五入', () => {
  assert.equal(A.kg(10060), '10.06'); assert.equal(A.kg(1005), '1.01'); assert.equal(A.kg(1004), '1.00'); assert.equal(A.kg(50), '0.05'); assert.equal(A.kg(20000), '20.00');
  assert.equal(A.pctOf(5310, 8000), 66); assert.equal(A.pctOf(4000, 8000), 50); assert.equal(A.pctOf(1, 8000), 0); assert.equal(A.pctOf(8000, 8000), 100);
  assert.equal(A.pctOf(2145, 4290), 50); assert.equal(A.pctOf(3, 8), 38);
});
