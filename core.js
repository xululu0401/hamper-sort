/* 分一筐脏衣服 · 计算核心（core.js）
 * 问题：一筐脏衣服里有白的、深的、会掉色的，有能随便洗的、要轻柔的、要走羊毛程序的。
 *       轻柔和羊毛程序一缸装得少；颜色混了怕染。到底最少要洗几缸、每缸放哪几件、几点能洗完。
 * 口径（设计选择，页面「怎么算的」写明）：
 *   - 颜色分 4 类：白、浅、深、易掉色。白和深永远不同缸；易掉色只和易掉色同缸；
 *     白+浅、浅+深能不能同缸由两个开关决定。
 *   - 每件衣服写它能接受的最「粗」程序：标准 / 轻柔 / 羊毛。一缸走的是缸里最温和的那个程序
 *     （标准衣服跟着走轻柔没问题，反过来不行）。
 *   - 每种程序一缸最多装「额定容量 × 这个程序的装载比例」（干衣重量，克，向下取整）；比例看洗衣机说明书。
 *   - 一缸的水温取缸里每件「最高水温」的最小值（只是输出，不当约束）。
 *   - 目标：先让缸数最少；缸数一样时，让「被迫跟着走更温和程序」的衣服重量最少（能洗标准的毛巾跟着走轻柔，
 *     洗得没那么干净，算「降档」）。
 *     逐件分支搜索（分支定界），同款衣服按顺序放以去掉重复分法；搜索步数有上限，超了如实说「没证明是最少」。
 * 精确：重量按整数克计算，不用浮点。 */
(function (root) {
  'use strict';
  var COLORS = ['w', 'l', 'd', 'b'];
  var COLOR_NAME = { w: '白', l: '浅', d: '深', b: '易掉色' };
  var PROG_NAME = ['标准', '轻柔', '羊毛'];
  var TEMPS = [20, 30, 40, 60, 90];
  var NODE_LIMIT = 150000;   /* 每组颜色的搜索步数上限；到了就用目前最好的分法，并如实说没证明是最少 */
  var MAX_ROWS = 12, MAX_PIECES = 60;

  function defaultItems() {
    return [
      { n: '白T恤', c: '6', w: '180', col: 'w', prog: '0', t: '60' },
      { n: '浅色衬衫', c: '4', w: '220', col: 'l', prog: '0', t: '40' },
      { n: '牛仔裤', c: '3', w: '650', col: 'd', prog: '0', t: '40' },
      { n: '深色卫衣', c: '2', w: '600', col: 'd', prog: '0', t: '40' },
      { n: '毛巾', c: '5', w: '350', col: 'w', prog: '0', t: '90' },
      { n: '床单被套', c: '1', w: '1600', col: 'l', prog: '0', t: '60' },
      { n: '羊毛衫', c: '2', w: '400', col: 'd', prog: '2', t: '30' },
      { n: '新买的红T恤', c: '1', w: '200', col: 'b', prog: '0', t: '30' },
      { n: '内衣袜子', c: '12', w: '50', col: 'l', prog: '1', t: '40' }
    ];
  }
  function defaultState() {
    return {
      name: '周末这一筐', cap: '8', pct0: '100', min0: '55', pct1: '50', min1: '40', pct2: '30', min2: '35',
      wl: '1', ld: '0', start: '09:00', gap: '10', items: defaultItems()
    };
  }
  var FIELDS = ['name', 'cap', 'pct0', 'min0', 'pct1', 'min1', 'pct2', 'min2', 'wl', 'ld', 'start', 'gap'];
  var ITEM_FIELDS = ['n', 'c', 'w', 'col', 'prog', 't'];

  function half(s) { return String(s == null ? '' : s).replace(/[\uFF01-\uFF5E]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); }).replace(/\u3000/g, ' ').replace(/\s/g, ''); }

  function parse(st) {
    var errs = [], P = {};
    st = st && typeof st === 'object' ? st : {};
    function int(v, f, lo, hi, label, unit) {
      var s = half(v);
      if (!/^\d+$/.test(s)) { errs.push({ field: f, message: label + (s === '' ? '没填' : /^\d+\.\d+$/.test(s) ? '要填整数' : '要填数字') }); return null; }
      var x = Number(s);
      if (x < lo || x > hi) { errs.push({ field: f, message: label + '要在 ' + lo + '～' + hi + unit + '之间' }); return null; }
      return x;
    }
    P.name = String(st.name == null ? '' : st.name).slice(0, 16).trim() || '这一筐';
    var cs = half(st.cap);
    if (!/^\d+(\.\d)?$/.test(cs)) errs.push({ field: 'cap', message: '洗衣机额定容量' + (cs === '' ? '没填' : '要填数字，最多一位小数') });
    else {
      var g = Math.round(Number(cs) * 10) * 100;
      if (g < 1000 || g > 20000) errs.push({ field: 'cap', message: '洗衣机额定容量要在 1～20 公斤之间' });
      else P.capG = g;
    }
    P.pct = []; P.min = [];
    for (var p = 0; p < 3; p++) {
      P.pct[p] = int(st['pct' + p], 'pct' + p, 10, 100, PROG_NAME[p] + '程序装载比例', '%');
      P.min[p] = int(st['min' + p], 'min' + p, 5, 300, PROG_NAME[p] + '程序时长', ' 分钟');
    }
    P.wl = String(st.wl) === '1'; P.ld = String(st.ld) === '1';
    var ts = half(st.start), tm = /^(\d{1,2})[:：](\d{2})$/.exec(ts);
    if (!tm || +tm[1] > 23 || +tm[2] > 59) errs.push({ field: 'start', message: '开始时间要写成 19:00 这样' });
    else P.start = +tm[1] * 60 + +tm[2];
    P.gap = int(st.gap, 'gap', 0, 120, '每缸之间取衣晾衣', ' 分钟');

    var items = Array.isArray(st.items) ? st.items : [];
    P.items = [];
    if (!items.length) errs.push({ field: 'items', message: '至少填一样衣服' });
    if (items.length > MAX_ROWS) errs.push({ field: 'items', message: '最多 ' + MAX_ROWS + ' 行衣服' });
    var pieces = 0;
    items.slice(0, MAX_ROWS).forEach(function (it, i) {
      it = it && typeof it === 'object' ? it : {};
      var lab = '第 ' + (i + 1) + ' 行';
      var x = {
        n: String(it.n == null ? '' : it.n).slice(0, 20).trim() || ('衣服' + (i + 1)),
        c: int(it.c, 'i' + i + 'c', 1, 30, lab + '件数', ' 件'),
        w: int(it.w, 'i' + i + 'w', 10, 5000, lab + '每件干重', ' 克'),
        col: COLORS.indexOf(it.col) >= 0 ? it.col : null,
        prog: ['0', '1', '2'].indexOf(String(it.prog)) >= 0 ? +it.prog : null,
        t: TEMPS.indexOf(+it.t) >= 0 ? +it.t : null
      };
      if (x.col === null) errs.push({ field: 'i' + i + 'col', message: lab + '颜色没选' });
      if (x.prog === null) errs.push({ field: 'i' + i + 'prog', message: lab + '程序没选' });
      if (x.t === null) errs.push({ field: 'i' + i + 't', message: lab + '最高水温没选' });
      if (x.c !== null) pieces += x.c;
      P.items.push(x);
    });
    if (pieces > MAX_PIECES) errs.push({ field: 'items', message: '一筐最多算 ' + MAX_PIECES + ' 件（现在 ' + pieces + ' 件），分两筐算' });
    if (!errs.length) {
      P.cap = [0, 1, 2].map(function (p) { return Math.floor(P.capG * P.pct[p] / 100); });
      P.items.forEach(function (x, i) {
        if (x.w > P.cap[x.prog]) errs.push({ field: 'i' + i + 'w', message: '「' + x.n + '」一件 ' + x.w + ' 克，比' + PROG_NAME[x.prog] + '程序一缸能装的 ' + P.cap[x.prog] + ' 克还重，这台洗衣机洗不了' });
      });
    }
    return { P: P, errors: errs };
  }

  function compat(a, b, P) {
    if (a === b) return true;
    if (a === 'b' || b === 'b') return false;
    var k = [a, b].sort().join('');
    if (k === 'dw') return false;
    if (k === 'lw') return P.wl;
    if (k === 'dl') return P.ld;
    return false;
  }
  /* 颜色上至少几缸：在场颜色里两两不能同缸的最大一组 */
  function colorLB(P) {
    var present = COLORS.filter(function (c) { return P.items.some(function (x) { return x.col === c; }); }), best = 0, bestSet = [];
    for (var m = 1; m < (1 << present.length); m++) {
      var s = present.filter(function (c, i) { return m & (1 << i); }), ok = true;
      for (var i = 0; i < s.length && ok; i++) for (var j = i + 1; j < s.length; j++) if (compat(s[i], s[j], P)) { ok = false; break; }
      if (ok && s.length > best) { best = s.length; bestSet = s; }
    }
    return { n: best, set: bestSet };
  }

  /* 逐件分支定界。颜色上互不能同缸的几组（比如易掉色永远单独）分开搜，缸数和降档重量直接相加。 */
  function groupsOf(P) {
    var gs = [], seen = {};
    COLORS.forEach(function (c) {
      if (seen[c] || !P.items.some(function (x) { return x.col === c; })) return;
      var g = [c], q = [c]; seen[c] = 1;
      while (q.length) { var u = q.pop(); COLORS.forEach(function (v) { if (!seen[v] && compat(u, v, P) && P.items.some(function (x) { return x.col === v; })) { seen[v] = 1; g.push(v); q.push(v); } }); }
      gs.push(g);
    });
    return gs;
  }
  function solveGroup(P, pieces, limit) {
    /* 难放的先放：程序越温和、越重越先 */
    pieces.sort(function (a, b) { return b.prog - a.prog || b.w - a.w || a.ti - b.ti; });
    var n = pieces.length, i, j;
    /* 每个程序档以上的衣服只能进这一档或更温和的缸：剩余重量 ÷ 那几档里最大的一缸 */
    var restQ = [], capQ = [];
    for (var q = 0; q < 3; q++) { capQ[q] = Math.max.apply(null, P.cap.slice(q)); restQ[q] = new Array(n + 1); restQ[q][n] = 0; }
    for (i = n - 1; i >= 0; i--) for (q = 0; q < 3; q++) restQ[q][i] = restQ[q][i + 1] + (pieces[i].prog >= q ? pieces[i].w : 0);
    var loads = [], assign = new Array(n), best = null, nodes = 0, cut = false;
    /* 降档重量：缸里程序比衣服自己能接受的更温和的那部分干重 */
    function down(l) { var r = 0; for (var qq = 0; qq < l.prog; qq++) r += l.bp[qq]; return r; }
    function downSum() { var r = 0; for (var jj = 0; jj < loads.length; jj++) r += down(loads[jj]); return r; }
    function snap(L, R) { best = { L: L, R: R, assign: assign.slice(), loads: loads.map(function (l) { return { prog: l.prog, w: l.w, cols: l.cols.slice(), down: down(l) }; }) }; }
    function fits(ld, pc) {
      var np = Math.max(ld.prog, pc.prog);
      if (ld.w + pc.w > P.cap[np]) return -1;
      for (var k = 0; k < ld.cols.length; k++) if (!compat(ld.cols[k], pc.col, P)) return -1;
      return np;
    }
    function put(ld, pc, np, idx) { var r = { op: ld.prog, added: ld.cols.indexOf(pc.col) < 0 }; ld.prog = np; ld.w += pc.w; ld.bp[pc.prog] += pc.w; if (r.added) ld.cols.push(pc.col); assign[idx] = loads.indexOf(ld); return r; }
    function take(ld, pc, r) { ld.prog = r.op; ld.w -= pc.w; ld.bp[pc.prog] -= pc.w; if (r.added) ld.cols.pop(); }
    function open(pc, idx) { var bp = [0, 0, 0]; bp[pc.prog] = pc.w; loads.push({ prog: pc.prog, w: pc.w, cols: [pc.col], bp: bp }); assign[idx] = loads.length - 1; }
    /* 先用「放得下就放第一缸」得到一个可行解，当搜索的起点上界 */
    for (i = 0; i < n; i++) {
      var placed = false;
      for (j = 0; j < loads.length && !placed; j++) { var np0 = fits(loads[j], pieces[i]); if (np0 >= 0) { put(loads[j], pieces[i], np0, i); placed = true; } }
      if (!placed) open(pieces[i], i);
    }
    snap(loads.length, downSum()); loads = [];
    var rootLB = 0;
    for (q = 0; q < 3; q++) rootLB = Math.max(rootLB, Math.ceil(restQ[q][0] / capQ[q]));
    function dfs(i) {
      if (++nodes > limit) { cut = true; return; }
      var L = loads.length, R = downSum();
      if (i === n) { if (L < best.L || (L === best.L && R < best.R)) snap(L, R); return; }
      /* 下界：剩下的重量塞不进已开缸的空位，就要再开缸（按程序档分别算，取最大） */
      var extra = 0;
      for (var q = 0; q < 3; q++) {
        if (!restQ[q][i]) continue;
        var spare = 0;
        for (var j = 0; j < L; j++) spare += Math.max(0, capQ[Math.max(q, loads[j].prog)] - loads[j].w);   /* 放进去后程序只会更温和，空位不超过那几档里最大的一缸 */
        extra = Math.max(extra, Math.ceil((restQ[q][i] - spare) / capQ[q]));
      }
      if (L + extra > best.L || (L + extra === best.L && R >= best.R)) return;
      var pc = pieces[i];
      /* 同款衣服按缸号不减的顺序放，去掉重复分法 */
      var from = (i > 0 && pieces[i - 1].ti === pc.ti) ? assign[i - 1] : 0;
      for (j = from; j < L; j++) {
        var ld = loads[j], np = fits(ld, pc);
        if (np < 0) continue;
        var r = put(ld, pc, np, i);
        dfs(i + 1);
        take(ld, pc, r);
        if (cut) return;
      }
      if (L + 1 > best.L) return;
      open(pc, i);
      dfs(i + 1);
      loads.pop();
    }
    if (!(best.L === rootLB && best.R === 0)) dfs(0);
    return { best: best, nodes: nodes, cut: cut, n: n };
  }
  function solve(P, limit) {
    limit = limit || NODE_LIMIT;
    var all = [], nodes = 0, cut = false, L = 0, R = 0, outLoads = [], gs = groupsOf(P);
    P.items.forEach(function (x, ti) { for (var k = 0; k < x.c; k++) all.push({ ti: ti, w: x.w, col: x.col, prog: x.prog }); });
    gs.forEach(function (g) {
      var pieces = all.filter(function (pc) { return g.indexOf(pc.col) >= 0; });
      var r = solveGroup(P, pieces, limit), b = r.best;
      nodes += r.nodes; cut = cut || r.cut; L += b.L; R += b.R;
      var ls = b.loads.map(function (l) { return { prog: l.prog, w: l.w, cols: l.cols, down: l.down, rows: {} }; });
      for (var i = 0; i < pieces.length; i++) { var rw = ls[b.assign[i]].rows; rw[pieces[i].ti] = (rw[pieces[i].ti] || 0) + 1; }
      outLoads = outLoads.concat(ls);
    });
    var best = { L: L, R: R };
    /* 组装每缸：件数按衣服行汇总 */
    var out = outLoads;
    out.forEach(function (l) {
      l.list = Object.keys(l.rows).map(Number).sort(function (a, b) { return a - b; }).map(function (ti) { return { ti: ti, k: l.rows[ti] }; });
      delete l.rows;
      l.pieces = l.list.reduce(function (s, x) { return s + x.k; }, 0);
      l.temp = Math.min.apply(null, l.list.map(function (x) { return P.items[x.ti].t; }));
      l.cap = P.cap[l.prog]; l.minutes = P.min[l.prog];
      l.colKey = Math.min.apply(null, l.cols.map(function (c) { return COLORS.indexOf(c); }));
      l.why = l.prog ? l.list.filter(function (x) { return P.items[x.ti].prog === l.prog; }).map(function (x) { return P.items[x.ti].n; }) : [];
    });
    /* 缸的顺序：白→浅→深→易掉色，同色先标准后温和，再按重量 */
    out.sort(function (a, b) { return a.colKey - b.colKey || a.prog - b.prog || b.w - a.w; });
    var t = P.start;
    out.forEach(function (l, k) { l.no = k + 1; l.t0 = t; l.t1 = t + l.minutes; t = l.t1 + P.gap; });
    return { ok: true, L: best.L, down: best.R, loads: out, nodes: nodes, proven: !cut, pieces: all.length, groups: gs };
  }

  function stats(P) {
    var pieces = 0, w = 0;
    P.items.forEach(function (x) { pieces += x.c; w += x.c * x.w; });
    return { pieces: pieces, w: w };
  }
  function evaluate(P) {
    var s = solve(P), st = stats(P);
    return { sol: s, pieces: st.pieces, w: st.w, colorLB: colorLB(P), weightLB: Math.ceil(st.w / P.capG) };
  }

  /* 改法：只列能真的少洗缸的 */
  function cloneState(s) { return JSON.parse(JSON.stringify(s)); }
  function applyChange(st, a) {
    var s = cloneState(st);
    if (a.kind === 'toggle') s[a.field] = a.to;
    else if (a.kind === 'defer') {
      var it = s.items[a.row], left = Number(half(it.c)) - a.k;
      if (left <= 0) s.items.splice(a.row, 1); else it.c = String(left);
    }
    return s;
  }
  /* 改法先用小步数筛（同一个确定的搜索顺序，步数多只会找到更好或一样的），选中的再用完整步数算一遍，
   * 所以按钮上写的「改完几缸」和点了之后页面算出来的一致。 */
  var SCREEN_LIMIT = 15000;
  function loadsOf(st, limit) { var r = parse(st); if (r.errors.length) return null; var s = solve(r.P, limit); return s.ok ? s : null; }
  function actions(st, P, ev) {
    var base = ev.sol, acts = [];
    if (!base.ok) return acts;
    [['wl', '白色和浅色同缸', '浅色衣服可能把白的洗灰'], ['ld', '浅色和深色同缸', '深色可能掉色到浅色上']].forEach(function (f) {
      if (P[f[0]]) return;
      var a = { id: 'act_' + f[0], kind: 'toggle', field: f[0], to: '1' }, s = loadsOf(applyChange(st, a), SCREEN_LIMIT);
      if (s && s.L < base.L) { a.after = s; a.text = '允许' + f[1] + '：' + base.L + ' → ' + s.L + ' 缸（' + f[2] + '，看衣服本身）'; acts.push(a); }
    });
    P.items.forEach(function (x, i) {
      var whole = { kind: 'defer', row: i, k: x.c }, sw = loadsOf(applyChange(st, whole), SCREEN_LIMIT);
      if (!sw || sw.L >= base.L) return;
      /* 少洗的件数越多缸数只会更少或不变，二分找最少要留几件 */
      var lo = 1, hi = x.c, got = sw;
      while (lo < hi) {
        var mid = (lo + hi) >> 1, s = loadsOf(applyChange(st, { kind: 'defer', row: i, k: mid }), SCREEN_LIMIT);
        if (s && s.L < base.L) { hi = mid; got = s; } else lo = mid + 1;
      }
      acts.push({ id: 'act_d' + i, kind: 'defer', row: i, k: lo, after: got, all: lo === x.c,
        text: '「' + x.n + '」' + (lo === x.c ? (x.c > 1 ? '这 ' + x.c + ' 件' : '') + '这次先不洗' : '先留 ' + lo + ' 件') + '，攒到下一筐：' + base.L + ' → ' + got.L + ' 缸' });
    });
    acts.sort(function (a, b) { return a.after.L - b.after.L || (a.kind === 'defer' ? a.k : 0) - (b.kind === 'defer' ? b.k : 0) || (a.id < b.id ? -1 : 1); });
    acts = acts.slice(0, 4);
    acts.forEach(function (a) { a.after = loadsOf(applyChange(st, a)); a.text = a.text.replace(/→ \d+ 缸/, '→ ' + a.after.L + ' 缸'); });
    return acts;
  }

  function compute(st) {
    var r = parse(st);
    if (r.errors.length) return { ok: false, errors: r.errors };
    var ev = evaluate(r.P);
    return { ok: true, P: r.P, ev: ev, actions: actions(st, r.P, ev) };
  }

  function kg(g) { var r = Math.floor((g + 5) / 10); return Math.floor(r / 100) + '.' + p2(r % 100); }
  function p2(x) { return (x < 10 ? '0' : '') + x; }
  function hm(m) { var d = Math.floor(m / 1440), x = m % 1440; return (d ? (d === 1 ? '次日 ' : '第 ' + (d + 1) + ' 天 ') : '') + p2(Math.floor(x / 60)) + ':' + p2(x % 60); }
  function pctOf(w, cap) { return Math.floor((w * 100 + cap / 2) / cap); }
  function colsName(l) { return COLORS.filter(function (c) { return l.cols.indexOf(c) >= 0; }).map(function (c) { return COLOR_NAME[c]; }).join('+'); }
  function listText(P, l) { return l.list.map(function (x) { return P.items[x.ti].n + ' ' + x.k + ' 件'; }).join('、'); }

  function headline(o) {
    var e = o.ev, s = e.sol, P = o.P;
    if (!s.ok) return '分不出来。';
    var last = s.loads[s.loads.length - 1];
    return P.name + '：' + e.pieces + ' 件、' + kg(e.w) + ' 公斤，' + (s.proven ? '最少' : '') + '要洗 ' + s.L + ' 缸。' + hm(P.start) + ' 开始，' + hm(last.t1) + ' 全部洗完。';
  }
  function explain(o) {
    var e = o.ev, s = e.sol, P = o.P, c = e.colorLB;
    var t = '颜色上至少 ' + c.n + ' 缸（' + c.set.map(function (x) { return COLOR_NAME[x]; }).join('、') + (c.n > 1 ? '两两不能同缸' : '') + '），重量上至少 ' + e.weightLB + ' 缸（' + kg(e.w) + ' ÷ ' + kg(P.capG) + ' 公斤）。';
    var gentle = s.loads.filter(function (l) { return l.prog; });
    var lb = Math.max(c.n, e.weightLB);
    if (s.L > lb) t += '实际比下限多 ' + (s.L - lb) + ' 缸' + (gentle.length ? '，' + s.L + ' 缸里有 ' + gentle.length + ' 缸走轻柔或羊毛（轻柔一缸最多 ' + kg(P.cap[1]) + ' 公斤、羊毛最多 ' + kg(P.cap[2]) + ' 公斤）' : '') + '。';
    else t += '缸数已经到下限。';
    t += s.proven ? (s.nodes ? '每件衣服放进每一缸的分法都试过了（' + s.nodes.toLocaleString('en-US') + ' 步），' : '按顺序往缸里放就到了下限，') + s.L + ' 缸是最少；同样缸数里挑了「跟着走温和程序」的衣服最少的分法' + (s.down ? '（仍有 ' + kg(s.down) + ' 公斤要跟着降档）。' : '，没有衣服被迫降档。')
      : '搜了 ' + s.nodes.toLocaleString('en-US') + ' 步到上限还没试完，这是目前找到的最好分法，没能证明是最少。';
    return t;
  }

  function csvCell(v) { var x = String(v); if (/^[=+\-@]/.test(x) && !/^-\d+(\.\d+)?$/.test(x)) x = "'" + x; return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  function row(a) { return a.map(csvCell).join(','); }
  function toCSV(o, when) {
    var P = o.P, s = o.ev.sol, L = [];
    L.push(row(['分一筐脏衣服', '导出时间', when, '名字', P.name]));
    L.push(row(['额定容量 kg', kg(P.capG), '白浅同缸', P.wl ? '是' : '否', '浅深同缸', P.ld ? '是' : '否']));
    L.push('');
    L.push(row(['缸号', '程序', '颜色', '水温上限 ℃', '开始', '结束', '干重 kg', '这程序最多 kg', '装满 %', '衣服', '件数']));
    s.loads.forEach(function (l) {
      l.list.forEach(function (x, j) {
        L.push(row(j ? ['', '', '', '', '', '', '', '', '', P.items[x.ti].n, x.k] : [l.no, PROG_NAME[l.prog], colsName(l), l.temp, hm(l.t0), hm(l.t1), kg(l.w), kg(l.cap), pctOf(l.w, l.cap), P.items[x.ti].n, x.k]));
      });
    });
    L.push('');
    L.push(row(['合计缸数', s.L, '是否已证明最少', s.proven ? '是' : '否']));
    o.actions.forEach(function (a) { L.push(row(['改法', a.text])); });
    return L.join('\r\n') + '\r\n';
  }
  function toMD(o, when) {
    var P = o.P, s = o.ev.sol, L = ['# 分一筐脏衣服 · ' + P.name, '', '导出时间：' + when, '', '**' + headline(o) + '**', '', explain(o), ''];
    s.loads.forEach(function (l) {
      L.push('## 第 ' + l.no + ' 缸 · ' + PROG_NAME[l.prog] + ' · ' + colsName(l) + ' · 水温不超过 ' + l.temp + '℃', '');
      L.push('- ' + hm(l.t0) + '–' + hm(l.t1) + '，' + l.minutes + ' 分钟', '- 干重 ' + kg(l.w) + ' / ' + kg(l.cap) + ' 公斤（' + pctOf(l.w, l.cap) + '%）', '- ' + listText(P, l));
      if (l.why.length) L.push('- 走' + PROG_NAME[l.prog] + '是因为：' + l.why.join('、'));
      L.push('');
    });
    if (o.actions.length) { L.push('## 改一样试试', ''); o.actions.forEach(function (a) { L.push('- ' + a.text); }); L.push(''); }
    L.push('> 颜色怎么分、程序能装多少按你填的和洗衣机说明书；默认数字是虚构示例。');
    return L.join('\n') + '\n';
  }

  var api = { FIELDS: FIELDS, ITEM_FIELDS: ITEM_FIELDS, COLORS: COLORS, COLOR_NAME: COLOR_NAME, PROG_NAME: PROG_NAME, TEMPS: TEMPS, NODE_LIMIT: NODE_LIMIT, MAX_ROWS: MAX_ROWS,
    defaultState: defaultState, parse: parse, compat: compat, colorLB: colorLB, solve: solve, evaluate: evaluate, applyChange: applyChange, actions: actions, compute: compute,
    headline: headline, explain: explain, kg: kg, hm: hm, pctOf: pctOf, colsName: colsName, listText: listText, toCSV: toCSV, toMD: toMD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AppCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
