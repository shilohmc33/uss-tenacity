// Art batch 2: Commander Okafor is a woman (she/her). Static scan of all game copy (js/**, index.html): every line that
// names Okafor (or her board/roster entries), plus the line after it, must carry no he / him / his / himself; and the
// data flags (START_PRONOUNS.okafor, boards.js she: true) must say she. Exit 1 on any hit.   node tools/okafor-pronoun-scan.js
const fs = require('fs'), path = require('path');
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.js$/.test(f)) files.push(p); } })('js'); files.push('index.html');
const MALE = /\b(he|him|his|himself|he's|he'll|he'd)\b/i; let lines = 0, hits = [];
for (const f of files) { const L = fs.readFileSync(f, 'utf8').split('\n');
  L.forEach((ln, i) => { if (!/okafor/i.test(ln)) return; lines++; for (const [k, t] of [[i, ln], [i + 1, L[i + 1] || '']]) {
    // only string content (quoted), not code comments about the Lt
    const strs = (t.match(/(["'`])(?:\\.|(?!\1).)*\1/g) || []).filter(q => !/^.(he|she|they)\W?.$/i.test(q)).join(' ');   // pronoun-table values ("he") are data, not copy
    if (MALE.test(strs) && /okafor|chief|commander/i.test(strs + ln)) hits.push(`${f}:${k + 1}: ${t.trim().slice(0, 160)}`); } }); }
const roster = fs.readFileSync('js/roster.js', 'utf8'), boards = fs.readFileSync('js/boards.js', 'utf8');
const flags = { startPronoun: /okafor:\s*"she"/.test(roster), boardShe: /okafor:\s*\{[^}]*she:\s*true/.test(boards) };
console.log(JSON.stringify({ okaforLines: lines, hits: hits.length, flags }, null, 1)); hits.forEach(h => console.log('  ' + h));
const ok = !hits.length && flags.startPronoun && flags.boardShe; console.log(ok ? 'OKAFOR PRONOUNS PASS' : 'OKAFOR PRONOUNS FAIL'); process.exit(ok ? 0 : 1);
