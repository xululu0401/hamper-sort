'use strict';
/* 注入测试：对 core.js 做一处小改动，看核心测试能不能抓到。跑完自动还原。
 * 首轮 25/30：4 处等价变异已删（易掉色那行删了也会落到最后的 return false；额定按 100 克取整、比例是整数，floor 与 round 恒等；
 * 衣服按程序从温和到粗排序，放进已开缸时缸的程序总 ≥ 这件，max 恒等；开关已开时改法本来就不会少缸）；额定 20 公斤上限 → 补测。 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const F=path.join(__dirname,'../core.js'),src=fs.readFileSync(F,'utf8');
const M=[
["if (k === 'dw') return false;","if (k === 'dw') return P.ld;"],
["if (k === 'lw') return P.wl;","if (k === 'lw') return true;"],
["if (k === 'dl') return P.ld;","if (k === 'dl') return P.wl;"],
["if (ld.w + pc.w > P.cap[np]) return -1;","if (ld.w + pc.w >= P.cap[np]) return -1;"],
["for (var qq = 0; qq < l.prog; qq++) r += l.bp[qq];","for (var qq = 0; qq <= l.prog; qq++) r += l.bp[qq];"],
["if (L < best.L || (L === best.L && R < best.R)) snap(L, R);","if (L < best.L) snap(L, R);"],
["if (L + extra > best.L || (L + extra === best.L && R >= best.R)) return;","if (L + extra >= best.L) return;"],
["if (L + 1 > best.L) return;","if (L + 1 >= best.L) return;"],
["var from = (i > 0 && pieces[i - 1].ti === pc.ti) ? assign[i - 1] : 0;","var from = (i > 0 && pieces[i - 1].ti === pc.ti) ? assign[i - 1] + 1 : 0;"],
["l.temp = Math.min.apply(null,","l.temp = Math.max.apply(null,"],
["l.t0 = t; l.t1 = t + l.minutes; t = l.t1 + P.gap;","l.t0 = t; l.t1 = t + l.minutes; t = l.t1;"],
["out.sort(function (a, b) { return a.colKey - b.colKey || a.prog - b.prog || b.w - a.w; });",""],
["weightLB: Math.ceil(st.w / P.capG)","weightLB: Math.floor(st.w / P.capG)"],
["if (ok && s.length > best)","if (ok && s.length >= best)"],
["var r = Math.floor((g + 5) / 10);","var r = Math.floor(g / 10);"],
["return Math.floor((w * 100 + cap / 2) / cap);","return Math.floor(w * 100 / cap);"],
["(d === 1 ? '次日 ' :","(d === 1 ? '' :"],
["if (s && s.L < base.L) { hi = mid; got = s; } else lo = mid + 1;","if (s && s.L < base.L) { hi = mid; got = s; } else lo = mid + 2;"],
["if (s && s.L < base.L) { a.after = s;","if (s && s.L <= base.L) { a.after = s;"],
["if (left <= 0) s.items.splice(a.row, 1); else it.c = String(left);","it.c = String(Math.max(left, 0));"],
["if (pieces > MAX_PIECES)","if (pieces >= MAX_PIECES)"],
["if (x.w > P.cap[x.prog]) errs.push(","if (x.w > P.capG) errs.push("],
["if (/^[=+\\-@]/.test(x) && !/^-\\d+(\\.\\d+)?$/.test(x)) x = \"'\" + x;",""],
["return { best: best, nodes: nodes, cut: cut, n: n };","return { best: best, nodes: nodes, cut: false, n: n };"],
["if (g < 1000 || g > 20000)","if (g < 1000 || g > 30000)"],
["if (!tm || +tm[1] > 23 || +tm[2] > 59)","if (!tm || +tm[2] > 59)"],
];
let caught=0;const rows=[];
for(const [a,b] of M){
  if(src.indexOf(a)<0){rows.push('✗ 找不到原文：'+a.slice(0,80));continue;}
  fs.writeFileSync(F,src.replace(a,b));
  let ok=true;try{execFileSync('node',['--test',path.join(__dirname,'core.test.cjs')],{stdio:'pipe',timeout:120000});}catch(e){ok=false;}
  rows.push((ok?'✗ 没抓到':'✓ 抓到')+'：'+a.slice(0,70)+' → '+b.slice(0,70));if(!ok)caught++;
}
fs.writeFileSync(F,src);
console.log(rows.join('\n'));console.log('合计 '+caught+'/'+M.length);
