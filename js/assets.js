import { IMAGES, WALK_MASKS } from "./data.js";
export const IMG = {};
export const missing = [];
// Preload every plate/atlas/backdrop up front (no black frames on deck switch), plus the PNG walk masks.
export function preload(onProgress) {
  let done = 0;
  const all = [...IMAGES.map(k => [k, "webp"]), ...WALK_MASKS.map(k => [k, "png"])];
  return Promise.all(all.map(([key, ext]) => new Promise(res => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => { (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => { IMG[key] = im; done++; onProgress && onProgress(done / all.length); res(); }); };
    im.onerror = () => { IMG[key] = null; missing.push(key); done++; onProgress && onProgress(done / all.length); res(); };
    im.src = `assets/${key}.${ext}`;
  })));
}
