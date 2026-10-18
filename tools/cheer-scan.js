// Pass 09 (4): static check that every light / cheerful line goes through the ONE quiet-period gate in js/bus.js
// (cheerful / cheer / cheerLog / cheerToast, and fx() for floaters + milestone toasts), so a new line can't leak into the
// ~10 min after a death. Fails when:
//   1. bus.js lost the gate (cheerful, cheer, cheerLog, the floater + milestone + levelUp + promotion fx filter);
//   2. any module other than bus.js calls hushed() itself (a private hush test = a second gate that can drift);
//   3. a known light line (LIGHT below: the playtest-09 list + the earlier quips) sits on a line without cheer( / cheerLog( /
//      cheerful() (or a data line marked '// cheer-gated: ...' naming the gate) - add new light lines to LIGHT and route them
//      through cheer();
//   4. a light event case (crewmoment default, ferengi) doesn't open with the cheerful() check;
//   5. (pass 11 HOLD 2) romance.js: letterArrives doesn't defer on !cheerful(), or goOnDate returns the fade in the quiet period.
// Usage: node tools/cheer-scan.js   (exit 1 on failure)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'js');
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); } })(ROOT);
const LIGHT = [/I owe you one/, /it only makes broth again/, /names a newborn/, /slightly used/, /Asylum granted/, /weathered that\. Personally/, /About time you picked a lane/,
  /That's how my deck runs/, /crew applauds/,
  // romance (finished after pass 09): the signal, the yes, the evening's log line, the journal's yes
  /💌 \$\{o\.short\} would like a word/, /briefly, delighted/, /Then — soon\?/, /An evening with \$\{o\.short\}\. \$\{lines/, /smiling at consoles/,
  // pass 10 (2): level-up / promotion toasts, reputation praise toasts
  /LEVEL UP — Lieutenant reaches/, /PROMOTED — \$\{n\.name\}/, /\$\{ev\.toast\} — reputation \+/,
  // pass 11 HOLD 2: letters, the envelope toast and the date's fade-to-black
  /✉ A letter from \$\{a\.short\}/, /`A letter from \$\{a\.short\} at/, /the distance won, warmly/, /at the cabin door, \{S\} takes your hand/];
const GATED = /cheer\(|cheerLog\(|cheerToast\(|cheerful\(\)|\/\/ cheer-gated:/;   // or a data / in-case line marked '// cheer-gated: <where the gate is>'
const bad = [];
const bus = fs.readFileSync(path.join(ROOT, 'bus.js'), 'utf8');
for (const [name, re] of [['cheerful', /export const cheerful = /], ['cheer', /export const cheer = /], ['cheerLog', /export function cheerLog\(/], ['fx gate', /CHEER_FX = new Set\(\[[^\]]*"floater"[^\]]*"milestone"|CHEER_FX = new Set\(\[[^\]]*"milestone"[^\]]*"floater"/], ['fx gate: levelUp + promotion (pass 10)', /CHEER_FX = new Set\(\[[^\]]*"levelUp"[^\]]*"promotion"/], ['fx uses gate', /export function fx\(kind, data\) \{ if \(CHEER_FX\.has\(kind\) && hushed\(\)\) return;/]])
  if (!re.test(bus)) bad.push(`bus.js: gate piece missing: ${name}`);
let lightLines = 0;
for (const f of files) {
  const rel = path.relative(path.join(ROOT, '..'), f), src = fs.readFileSync(f, 'utf8'), lines = src.split('\n');
  lines.forEach((ln, i) => {
    const code = ln.replace(/\/\/.*$/, '');
    if (rel !== 'js/bus.js' && /\bhushed\(\)/.test(code) && !/^\s*export const hushed\s*=/.test(code)) bad.push(`${rel}:${i + 1}: calls hushed() directly - use the bus.js cheer gate`);
    for (const re of LIGHT) if (re.test(ln)) { lightLines++; if (!GATED.test(ln)) bad.push(`${rel}:${i + 1}: light line ${re} not routed through cheer()`); }
  });
  if (rel === 'js/romance.js') {   // pass 11 HOLD 2: a letter waits for the gate (deferred, not dropped); a quiet date has no fade
    if (!/function letterArrives\(\) \{[\s\S]{0,400}?if \(!cheerful\(\)\) return;/.test(src)) bad.push('js/romance.js: letterArrives must defer with if (!cheerful()) return; before a letter is written');
    if (!/fade: cheerful\(\) \? /.test(src)) bad.push('js/romance.js: goOnDate must return fade only while cheerful()');
    if (/date_quiet[^\n]*not writing the rest down/.test(fs.readFileSync(path.join(ROOT, 'plog.js'), 'utf8'))) bad.push('js/plog.js: date_quiet must not use the coy line');
  }
  if (rel === 'js/events.js') {
    if (!/case "ferengi": \{\s*\n\s*if \(!cheerful\(\)\)/.test(src)) bad.push('js/events.js: ferengi case must open with if (!cheerful())');
    if (!/default:\s*\n\s*if \(!cheerful\(\)\)/.test(src)) bad.push('js/events.js: crewmoment (default) case must open with if (!cheerful())');
  }
}
console.log(JSON.stringify({ files: files.length, lightLines, bad }, null, 1));
if (lightLines < LIGHT.length) bad.push(`only ${lightLines} light lines found for ${LIGHT.length} patterns - a line was renamed: update LIGHT`);
console.log(bad.length ? 'CHEER SCAN FAIL' : 'CHEER SCAN PASS'); process.exit(bad.length ? 1 : 0);
