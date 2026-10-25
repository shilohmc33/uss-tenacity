// Bigger wins #10: "Do this next": one goal at a time in the #alertPill strip (no second element), and the info-layout tabs.
// nextGoal() order (notes/2026-10-24-bigger-wins-plan.md): red alert -> medical -> the top duty item (fault, deck task) -> odd job
// -> promotion board / specialisation -> day 1 "first repair" -> DS9 Promenade (while docked) -> readinessHint() -> nominal.
// Judgment call: the DS9 suggestion sits above the readiness hint (that hint is almost always there, so below it DS9 would never
// show; docking is the time-bound one). act = a key the HUD maps to an action (ui/hud.js goalAct).
import { G, saveSoon } from "../state.js";
import { addHardener, readinessHint, readinessVisible, xpToNext } from "../progression.js";
import { dutyItems } from "../faults.js";
import * as MD from "../injuries.js";
import * as BD from "../boards.js";
import { atDS9 } from "../crewcare.js";

export const TABS = ["orders", "duty", "crew", "log"];
addHardener(p => { const t = p.ui && typeof p.ui === "object" && !Array.isArray(p.ui) ? p.ui.tab : null; p.ui = { tab: TABS.includes(t) ? t : "orders" }; });   // v17: G.prog.ui.tab
export const tabOf = () => (G.prog && G.prog.ui && TABS.includes(G.prog.ui.tab) ? G.prog.ui.tab : "orders");
export function applyTab() { const b = document.body, t = tabOf(); if (b.classList.contains("itab-" + t)) return; b.className = b.className.replace(/\s?itab-\w+/g, "") + " itab-" + t;
  document.querySelectorAll("#infoTabs [data-itab]").forEach(x => x.classList.toggle("on", x.dataset.itab === t)); }
export function setTab(t) { if (!TABS.includes(t) || !G.prog) return false; G.prog.ui = { ...(G.prog.ui || {}), tab: t }; applyTab(); saveSoon("ui"); return true; }
export const promUI = { open: null, shown: () => false };   // set by ui/promenade.js
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const firstPart = s => String(s || "").split(" — ")[0];
export const firstWatch = () => !!G.prog && !(G.prog.milestones || {}).firstRepair && (G.prog.playDays | 0) < 1;
export function nextGoal() {
  const p = G.prog, SP = G.sp;
  if (SP.alert || SP.battle) return { k: "alert", text: "RED ALERT", act: "alert" };
  const mi = MD.alertInjury(), ms = MD.sceneOf();
  if (mi || (ms && ms.phase === "surgery")) return { k: "medical", text: "MEDICAL ALERT", act: "medical" };
  const items = dutyItems();
  if (items.length) { const top = items[0]; return top.kind === "job" ? { k: "job", text: `ODD JOB — ${top.job.label}`, act: "duty" } : { k: "duty", text: top.kind === "task" ? "CAPTAIN — Deck task" : `FAULT — ${top.id}`, act: "duty" }; }
  if (BD.boardWaiting()) return { k: "board", text: "NEXT · Your promotion board is waiting — tap to sit it", act: "board" };
  if (BD.specPending() > 0) return { k: "spec", text: "NEXT · A specialisation pick is waiting — tap to choose", act: "spec" };
  if (firstWatch()) return { k: "first", text: "FIRST WATCH · Tap here when the first fault shows", act: "duty" };
  if (atDS9() && SP.promSeen && !promUI.shown()) return { k: "ds9", text: "DS9 · Spend shore time on the Promenade ▸", act: "prom" };
  if (readinessVisible()) { const h = readinessHint(); if (h && (h.act || h.hint)) return { k: "ready", text: `NEXT · ${cap1(firstPart(h.act || h.hint))}`, act: "crew" }; }
  if (p.level < 200) { const need = Math.max(0, xpToNext(p.level) - p.xp); return { k: "ready", text: `NEXT · Level ${p.level + 1}: ${need} XP to go`, act: "crew" }; }
  return { k: "nominal", text: "All systems nominal", act: null };
}
