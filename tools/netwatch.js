// Preload for older shot tools that don't count failed requests themselves:
//   NODE_OPTIONS="--require ./tools/netwatch.js" node tools/<tool>.js
// Hooks every new page (playwright-core) and prints "NETWATCH console=<n> failed=<n>" (+ the first few) at exit.
const pw = require('playwright-core'); const bad = [], con = [];
const hook = ctx => { ctx.on('page', p => {
  p.on('requestfailed', r => { const f = r.failure() && r.failure().errorText; if (!/ERR_ABORTED/.test(f || '')) bad.push(`failed ${r.url()} ${f}`); });
  p.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  p.on('console', m => { if (m.type() === 'error') con.push(m.text()); }); p.on('pageerror', e => con.push(e.message)); }); return ctx; };
const L = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => { const b = await L(...a); const nc = b.newContext.bind(b), np = b.newPage.bind(b);
  b.newContext = async (...x) => hook(await nc(...x)); b.newPage = async (...x) => { const pg = await np(...x); hook(pg.context()); return pg; }; return b; };
process.on('exit', () => console.log(`NETWATCH console=${con.length} failed=${bad.length}`, JSON.stringify([...con.slice(0, 3), ...bad.slice(0, 5)])));
