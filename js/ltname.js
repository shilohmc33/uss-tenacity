// The player's Lieutenant has a name (Oct 24). Additive on save v17: G.lt.name = { first, last } and G.lt.nameDone (asked
// once: a new game at the start, an older save on its next load). Names are sanitised on entry AND on load (letters of any
// script, combining marks, spaces, hyphens, apostrophes; spaces collapsed; 20 characters each), and every renderer escapes
// them (esc() / textContent) anyway. A blank surname -> DEFAULT_LAST.
import { G, saveSoon } from "./state.js";
import { addHardener, addr } from "./progression.js";

export const DEFAULT_LAST = "Marlowe";   // the Starfleet default when the player leaves the surname blank
export const NAME_MAX = 20;
export function cleanName(s) {
  let t = String(s == null ? "" : s).normalize("NFC").replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u2010-\u2013]/g, "-");
  t = t.replace(/<[^>]*>?/g, "").replace(/[^\p{L}\p{M} '\-]/gu, "").replace(/\s+/g, " ").replace(/^[\s'\-]+|[\s'\-]+$/g, "");
  t = Array.from(t).slice(0, NAME_MAX).join("").replace(/[\s'\-]+$/g, "");
  return t;
}
const N = () => (G.lt && G.lt.name) || { first: "", last: "" };
export const ltLast = () => N().last || DEFAULT_LAST;
export const ltFirst = () => N().first || "";
export const ltFull = () => (ltFirst() ? ltFirst() + " " : "") + ltLast();
export const nameDue = () => !!G.lt && G.lt.nameDone !== true;
export function setName(first, last) {
  if (!G.lt) return null;
  const f = cleanName(first), l = cleanName(last) || DEFAULT_LAST;
  G.lt.name = { first: f, last: l }; G.lt.nameDone = true; saveSoon("name");
  return G.lt.name;
}
// crew-voiced address: mostly the rank word, every third line rank + surname (deterministic, never two in a row)
let addrN = 0;
export function ltAddr() { addrN++; return addrN % 3 === 0 ? `${addr()} ${ltLast()}` : addr(); }
export const ltNamed = () => `${addr()} ${ltLast()}`;   // always with the surname (welcome back, the Shift Report)
export const _resetAddr = () => { addrN = 0; };   // tools only
addHardener(() => {
  const L = G.lt; if (!L || typeof L !== "object") return;
  const n = L.name && typeof L.name === "object" && !Array.isArray(L.name) ? L.name : {};
  L.name = { first: typeof n.first === "string" ? cleanName(n.first) : "", last: typeof n.last === "string" ? cleanName(n.last) : "" };
  L.nameDone = L.nameDone === true;
  if (L.nameDone && !L.name.last) L.name.last = DEFAULT_LAST;
});
