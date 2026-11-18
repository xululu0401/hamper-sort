/* 封面 cover.svg（1200×1200）：读数来自 core.js 同一次 compute；再用浏览器截成 cover.png。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState()), P = o.P, s = o.ev.sol;
if (!o.ok || s.L !== 5 || !s.proven) throw new Error('默认场景不对');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
const CC = { w: '#f4f4f1', l: '#e9dcc4', d: '#3b4a63', b: '#c4473a' };
const rows = s.loads.map((l, k) => {
  const y = 470 + k * 108, pc = Math.min(A.pctOf(l.w, l.cap), 100);
  const sw = A.COLORS.filter((c) => l.cols.includes(c)).map((c, j) => `<rect x="${215 + j * 40}" y="${y + 22}" width="32" height="32" rx="5" fill="${CC[c]}" stroke="#b9c2c6"/>`).join('');
  return `<rect x="140" y="${y}" width="920" height="92" rx="12" fill="#f6f8f9"/>
  <text x="170" y="${y + 52}" font-family="${F}" font-size="40" font-weight="800" fill="#1f2a30">${l.no}</text>${sw}
  <text x="310" y="${y + 50}" font-family="${F}" font-size="34" font-weight="700" fill="#1f6e8c">${A.PROG_NAME[l.prog]}</text>
  <rect x="420" y="${y + 33}" width="300" height="14" rx="7" fill="#e8edef"/><rect x="420" y="${y + 33}" width="${(300 * pc / 100).toFixed(1)}" height="14" rx="7" fill="#1f6e8c"/>
  <text x="1030" y="${y + 50}" text-anchor="end" font-family="${F}" font-size="28" fill="#4b5960">${A.kg(l.w)} / ${A.kg(l.cap)} kg</text>`;
}).join('\n  ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#eef1f2"/>
  <rect x="60" y="60" width="1080" height="1080" rx="18" fill="#ffffff"/>
  <text x="140" y="230" font-family="${F}" font-size="120" font-weight="800" fill="#1f2a30">分一筐脏衣服</text>
  <text x="140" y="305" font-family="${F}" font-size="40" fill="#4b5960">白的深的掉色的、要轻柔的，最少洗几缸</text>
  <text x="140" y="420" font-family="${F}" font-size="58" font-weight="800" fill="#1f6e8c">最少 ${s.L} 缸<tspan fill="#85929a" font-size="34" font-weight="400">　${o.ev.pieces} 件 · ${A.kg(o.ev.w)} 公斤 · ${A.kg(P.capG)} 公斤洗衣机</tspan></text>
  ${rows}
  <text x="140" y="1090" font-family="${F}" font-size="24" fill="#85929a">颜色与程序按自己填的 · 数字是虚构示例 · 容量看洗衣机说明书</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
fs.writeFileSync('cover-shot.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body>' + svg + '</body></html>');
console.log('cover.svg', svg.length);
