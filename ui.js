/* 分一筐脏衣服 · 界面（ui.js）：所有读数取自 core.js 同一次 compute 的 out */
'use strict';
(function () {
  var A = window.AppCore, KEY = 'hamper-sort:v1';
  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = A.FIELDS, CHECKS = ['wl', 'ld'];
  var PRESETS = [
    { key: 'def', name: '周末这一筐', note: '默认（虚构）：8 公斤滚筒，36 件、约 10 公斤，有毛巾床单、牛仔卫衣、羊毛衫、一件新买的红 T 恤和一把内衣袜子。' },
    { key: 'dorm', name: '宿舍一周', note: '虚构示例：6.5 公斤波轮式，一个人一周的衣服，白的浅的允许一起洗。', f: function (s) {
      s.name = '宿舍一周'; s.cap = '6.5'; s.pct1 = '50'; s.pct2 = '30'; s.min0 = '45'; s.min1 = '35'; s.min2 = '30'; s.start = '20:30'; s.gap = '5'; s.wl = '1'; s.ld = '1';
      s.items = [
        { n: 'T恤', c: '7', w: '170', col: 'l', prog: '0', t: '40' },
        { n: '运动裤', c: '3', w: '400', col: 'd', prog: '0', t: '40' },
        { n: '袜子内裤', c: '14', w: '40', col: 'l', prog: '1', t: '40' },
        { n: '毛巾', c: '2', w: '300', col: 'w', prog: '0', t: '60' }
      ];
    } },
    { key: 'baby', name: '一堆都要轻柔', note: '虚构示例：大半筐都只能走轻柔或羊毛，10 公斤的机器轻柔一缸只装四成、羊毛两成，看缸数怎么被卡住。', f: function (s) {
      s.name = '换季收纳前'; s.cap = '10'; s.pct1 = '40'; s.pct2 = '20'; s.wl = '0'; s.ld = '0'; s.start = '08:30';
      s.items = [
        { n: '真丝衬衫', c: '3', w: '150', col: 'w', prog: '1', t: '30' },
        { n: '针织开衫', c: '4', w: '450', col: 'l', prog: '1', t: '30' },
        { n: '羊绒围巾', c: '3', w: '200', col: 'd', prog: '2', t: '30' },
        { n: '羊毛大衣内胆', c: '1', w: '900', col: 'd', prog: '2', t: '30' },
        { n: '雪纺裙', c: '2', w: '250', col: 'b', prog: '1', t: '30' },
        { n: '纯棉T恤', c: '6', w: '180', col: 'w', prog: '0', t: '60' }
      ];
    } }
  ];
  var state, out, tmr;
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function presetState(k) { var s = A.defaultState(), p = PRESETS.filter(function (q) { return q.key === k; })[0]; if (p && p.f) p.f(s); return s; }
  function str(v, n) { return v == null || typeof v === 'object' ? '' : String(v).slice(0, n); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState();
    FIELDS.forEach(function (k) { if (k in s) d[k] = str(s[k], k === 'name' ? 16 : 12); });
    if (Array.isArray(s.items)) d.items = s.items.slice(0, A.MAX_ROWS).map(function (it) {
      it = it && typeof it === 'object' ? it : {}; var x = {};
      A.ITEM_FIELDS.forEach(function (k) { x[k] = str(it[k], k === 'n' ? 20 : 8); }); return x;
    });
    return d;
  }
  function norm(s) { return JSON.stringify(sanitize(s)); }
  function presetKey(s) { var j = norm(s); for (var i = 0; i < PRESETS.length; i++) if (norm(presetState(PRESETS[i].key)) === j) return PRESETS[i].key; return null; }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return j && j.state ? sanitize(j.state) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, state: state })); $('saveTag').textContent = '· 已自动存在本机'; } catch (e) { $('saveTag').textContent = '· 这台设备存不了，刷新会丢'; } }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  state = load() || A.defaultState();

  function opt(list, v) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); }
  var COL_OPTS = A.COLORS.map(function (c) { return [c, A.COLOR_NAME[c]]; }), PROG_OPTS = A.PROG_NAME.map(function (n, i) { return [String(i), n]; }), T_OPTS = A.TEMPS.map(function (t) { return [String(t), t + '℃']; });
  function renderRows() {
    $('rows').innerHTML = state.items.map(function (it, i) {
      return '<tr data-i="' + i + '">' +
        '<td class="nm"><input data-k="n" id="i' + i + 'n" maxlength="20" value="' + esc(it.n) + '" aria-label="第 ' + (i + 1) + ' 样衣服名字"></td>' +
        '<td class="cc"><input class="num" data-k="c" id="i' + i + 'c" inputmode="numeric" value="' + esc(it.c) + '" aria-label="件数"></td>' +
        '<td class="ww"><input class="num" data-k="w" id="i' + i + 'w" inputmode="numeric" value="' + esc(it.w) + '" aria-label="每件干重 克"></td>' +
        '<td class="co"><select data-k="col" id="i' + i + 'col" aria-label="颜色">' + opt(COL_OPTS, it.col) + '</select></td>' +
        '<td class="pp"><select data-k="prog" id="i' + i + 'prog" aria-label="最多能走的程序">' + opt(PROG_OPTS, it.prog) + '</select></td>' +
        '<td class="tt"><select data-k="t" id="i' + i + 't" aria-label="水温上限">' + opt(T_OPTS, it.t) + '</select></td>' +
        '<td class="dd"><button type="button" class="del" data-del="' + i + '" aria-label="删掉这一样">删</button></td></tr>';
    }).join('');
    $('addRow').disabled = state.items.length >= A.MAX_ROWS;
  }
  function fill() {
    FIELDS.forEach(function (k) { if (CHECKS.indexOf(k) >= 0) $(k).checked = state[k] === '1'; else $(k).value = state[k]; });
    renderRows();
  }
  FIELDS.forEach(function (k) {
    if (CHECKS.indexOf(k) >= 0) $(k).addEventListener('change', function () { state[k] = this.checked ? '1' : '0'; update(); });
    else $(k).addEventListener('input', function () { state[k] = this.value; schedule(); });
  });
  function onRow(e) {
    var el = e.target, tr = el.closest('tr[data-i]'); if (!tr || !el.getAttribute('data-k')) return;
    state.items[+tr.getAttribute('data-i')][el.getAttribute('data-k')] = el.value;
    if (el.tagName === 'SELECT') update(); else schedule();
  }
  $('rows').addEventListener('input', onRow);
  $('rows').addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') onRow(e); });
  $('rows').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; state.items.splice(+b.getAttribute('data-del'), 1); renderRows(); update(); });
  $('addRow').addEventListener('click', function () { if (state.items.length >= A.MAX_ROWS) return; state.items.push({ n: '', c: '1', w: '200', col: 'l', prog: '0', t: '40' }); renderRows(); update(); var r = $('i' + (state.items.length - 1) + 'n'); if (r) r.focus(); });
  function schedule() { clearTimeout(tmr); tmr = setTimeout(update, 120); }
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; state = presetState(b.getAttribute('data-p')); fill(); update(); });
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !out.ok) return;
    var a = out.actions.filter(function (x) { return x.id === b.getAttribute('data-act'); })[0]; if (!a) return;
    state = A.applyChange(state, a); fill(); update();
  });

  function markErrors() {
    document.querySelectorAll('.bad').forEach(function (e) { e.classList.remove('bad'); });
    if (!out.ok) out.errors.forEach(function (er) { var el = $(er.field); if (el) el.classList.add('bad'); });
  }
  function renderPresets() {
    var key = presetKey(state);
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (key === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = PRESETS.filter(function (p) { return p.key === key; })[0];
    $('presetNote').textContent = cur ? cur.note : '你自己改过的清单（默认那组是虚构示例）。';
  }
  function sw(l) { return A.COLORS.filter(function (c) { return l.cols.indexOf(c) >= 0; }).map(function (c) { return '<span class="sw ' + c + '"></span>'; }).join(''); }
  function renderLoads() {
    var o = out, P = o.P;
    $('loads').innerHTML = o.ev.sol.loads.map(function (l) {
      var pc = A.pctOf(l.w, l.cap);
      return '<div class="load" id="load' + l.no + '"><div class="hd"><span class="no">第 ' + l.no + ' 缸</span><span class="pg p' + l.prog + '">' + A.PROG_NAME[l.prog] + ' · ≤' + l.temp + '℃</span></div>' +
        '<div class="meta">' + sw(l) + ' ' + A.colsName(l) + ' · ' + A.hm(l.t0) + '–' + A.hm(l.t1) + '</div>' +
        '<div class="bar" title="装满程度"><i style="width:' + Math.min(pc, 100) + '%"></i></div>' +
        '<div class="muted">' + A.kg(l.w) + ' / ' + A.kg(l.cap) + ' 公斤（' + pc + '%）· ' + l.pieces + ' 件</div>' +
        '<ul>' + l.list.map(function (x) { return '<li>' + esc(P.items[x.ti].n) + ' × ' + x.k + '</li>'; }).join('') + '</ul>' +
        (l.why.length ? '<div class="note">走' + A.PROG_NAME[l.prog] + '是因为：' + esc(l.why.join('、')) + (l.down ? '；有 ' + A.kg(l.down) + ' 公斤能洗标准的跟着降档' : '') + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function render() {
    var o = out;
    $('errBox').classList.toggle('hide', o.ok); $('okBox').classList.toggle('hide', !o.ok); $('actCard').classList.toggle('hide', !o.ok);
    if (!o.ok) { $('errBox').innerHTML = '先改好标红的地方：<ul>' + o.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>'; return; }
    $('headline').textContent = A.headline(o);
    $('why').textContent = A.explain(o);
    renderLoads();
    $('acts').innerHTML = o.actions.length ? o.actions.map(function (a) { return '<button type="button" class="act" id="' + a.id + '" data-act="' + a.id + '">→ ' + esc(a.text) + '</button>'; }).join('')
      : '<span class="muted">' + (o.ev.sol.L <= Math.max(o.ev.colorLB.n, o.ev.weightLB) ? '已经到颜色和重量上的下限了，少不了。' : '开一个颜色开关、或者少洗一样衣服，都少不了一缸。') + '</span>';
  }
  function update() { clearTimeout(tmr); out = A.compute(state); markErrors(); renderPresets(); render(); save(); }

  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function tag() { return out.ok ? out.ev.sol.L + '缸' : '待改'; }
  $('dlCsv').addEventListener('click', function () { if (out.ok) download('分一筐脏衣服-每缸清单.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { if (out.ok) download('分一筐脏衣服-' + tag() + '.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('分一筐脏衣服-备份.json', new Blob([JSON.stringify({ app: '分一筐脏衣服', slug: 'hamper-sort', version: 1, exported_at: stamp(), state: state }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importText(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('impMsg').textContent = '这个文件读不出来，没改动。'; return false; }
    $('impMsg').textContent = '已导入。'; state = s; fill(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); $('impMsg').textContent = ''; fill(); update(); });

  /* 结果卡 PNG 1080×1350：文字取自同一次 out */
  var CC = { w: '#f4f4f1', l: '#e9dcc4', d: '#3b4a63', b: '#c4473a' };
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), FF = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#eef1f2'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffffff'; g.fillRect(50, 50, W - 100, H - 100);
    var L = 100, Rr = W - 100, maxW = Rr - L, y = 150;
    function font(size, bold) { g.font = (bold ? '700 ' : '') + size + 'px ' + FF; }
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function wrap(t, size, color, bold, lim, x0, w0) {
      x0 = x0 || L; w0 = w0 || maxW;
      font(size, bold); g.fillStyle = color; var cur = '', n = 0;
      var toks = String(t).match(/[0-9.,:]+ ?(?:公斤|缸|件|克|分钟|℃|%)?[）)。，、；：]?|[（(「]?[^\s（(「][）)」。，、；：]?|\s/g) || [];
      for (var i = 0; i < toks.length; i++) { var ch = toks[i]; if (g.measureText(cur + ch).width > w0 && cur) { if (lim && ++n >= lim) { g.fillText(clip(cur + '…', w0), x0, y); y += size * 1.45; return; } g.fillText(cur, x0, y); y += size * 1.45; cur = ch.trim() ? ch : ''; } else cur += ch; }
      if (cur) { g.fillText(cur, x0, y); y += size * 1.45; }
    }
    font(54, true); g.fillStyle = '#1f2a30'; g.fillText('分一筐脏衣服', L, y); y += 56;
    if (!out.ok) {
      font(42, true); g.fillStyle = '#b23b2e'; g.fillText('还算不了', L, y + 20); y += 90;
      out.errors.slice(0, 10).forEach(function (e) { wrap('· ' + e.message, 28, '#4b5960', false, 2); y += 6; }); y += 30; wrap('改好标红的地方，会自动重算。', 26, '#85929a');
      return cv;
    }
    var o = out, P = o.P, s = o.ev.sol;
    font(26); g.fillStyle = '#85929a'; g.fillText(clip(P.name + ' · ' + o.ev.pieces + ' 件 · ' + A.kg(o.ev.w) + ' 公斤 · ' + A.kg(P.capG) + ' 公斤洗衣机', maxW), L, y); y += 110;
    font(84, true); g.fillStyle = '#1f6e8c'; g.fillText((s.proven ? '最少 ' : '') + s.L + ' 缸', L, y);
    font(32); g.fillStyle = '#4b5960'; g.fillText(clip(A.hm(P.start) + ' 开始 → ' + A.hm(s.loads[s.loads.length - 1].t1) + ' 洗完', maxW - 420), L + 420, y - 10); y += 60;
    /* 每缸一行：色块 + 程序 + 装满条 + 衣服。地方够用大行（三行字），不够用一行紧凑排；还放不下就写「还有几缸见 CSV」 */
    var avail = H - 170 - y - (o.actions.length ? 170 : 20), n = s.loads.length, BIG = 124, SMALL = 46;
    var mode = n * BIG <= avail ? 'big' : 'small', show = mode === 'big' ? n : Math.min(n, Math.floor(avail / SMALL));
    if (show < n) show = Math.max(1, Math.floor((avail - SMALL) / SMALL));
    function sws(l, cx, top, sz) { A.COLORS.filter(function (c) { return l.cols.indexOf(c) >= 0; }).forEach(function (c) { g.fillStyle = CC[c]; g.fillRect(cx, top, sz, sz); g.strokeStyle = '#b9c2c6'; g.lineWidth = 1; g.strokeRect(cx + .5, top + .5, sz - 1, sz - 1); cx += sz + 6; }); }
    s.loads.slice(0, show).forEach(function (l) {
      var top = y, pc = Math.min(A.pctOf(l.w, l.cap), 100), tt = A.hm(l.t0) + '–' + A.hm(l.t1);
      if (mode === 'big') {
        g.fillStyle = '#f6f8f9'; g.fillRect(L, top, maxW, BIG - 12);
        font(34, true); g.fillStyle = '#1f2a30'; g.fillText(String(l.no), L + 20, top + 46);
        sws(l, L + 70, top + 20, 26);
        font(26, true); g.fillStyle = '#1f6e8c'; g.fillText(A.PROG_NAME[l.prog] + ' · ≤' + l.temp + '℃', L + 150, top + 44);
        font(22); g.fillStyle = '#4b5960'; g.fillText(tt, Rr - 20 - g.measureText(tt).width, top + 44);
        var bx = L + 150, bw = 300;
        g.fillStyle = '#e8edef'; g.fillRect(bx, top + 58, bw, 12); g.fillStyle = '#1f6e8c'; g.fillRect(bx, top + 58, bw * pc / 100, 12);
        font(20); g.fillStyle = '#85929a'; g.fillText(A.kg(l.w) + '/' + A.kg(l.cap) + ' 公斤', bx + bw + 14, top + 70);
        font(22); g.fillStyle = '#1f2a30'; g.fillText(clip(A.listText(P, l), maxW - 170), L + 150, top + 100);
        y += BIG;
      } else {
        g.fillStyle = '#f6f8f9'; g.fillRect(L, top, maxW, SMALL - 6);
        font(22, true); g.fillStyle = '#1f2a30'; g.fillText(String(l.no), L + 14, top + 28);
        sws(l, L + 56, top + 12, 18);
        font(22, true); g.fillStyle = '#1f6e8c'; g.fillText(A.PROG_NAME[l.prog] + '≤' + l.temp + '℃', L + 140, top + 28);
        g.fillStyle = '#e8edef'; g.fillRect(L + 270, top + 17, 120, 8); g.fillStyle = '#1f6e8c'; g.fillRect(L + 270, top + 17, 120 * pc / 100, 8);
        font(19); g.fillStyle = '#4b5960'; g.fillText(clip(A.kg(l.w) + ' 公斤 · ' + tt, Rr - L - 420), L + 405, top + 28);
        y += SMALL;
      }
    });
    if (show < n) { font(22); g.fillStyle = '#85929a'; g.fillText('…还有 ' + (n - show) + ' 缸，完整清单见 CSV / MD', L, y + 26); y += SMALL; }
    y += 14;
    if (o.actions.length) { font(28, true); g.fillStyle = '#1f2a30'; g.fillText('想少洗一缸', L, y + 10); y += 52; o.actions.slice(0, 2).forEach(function (a) { wrap('→ ' + a.text, 23, '#1f6e8c', false, 2); y += 2; }); }
    y = Math.max(y + 10, H - 130);
    wrap('颜色和程序按自己填的；一缸能装多少看洗衣机说明书；不含烘干晾干。默认数字为虚构示例。', 20, '#85929a', false, 2);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (bl) { if (bl) download('分一筐脏衣服-' + tag() + '-1080x1350.png', bl); }, 'image/png'); });

  window.__hsUi = { state: function () { return clone(state); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };
  fill(); update();
})();
