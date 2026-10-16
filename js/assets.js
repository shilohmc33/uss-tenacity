import { IMAGES } from "./data.js";
export const IMG = {};
export const missing = [];
// Preload every plate/atlas/backdrop up front (no black frames on deck switch).
export function preload(onProgress) {
  let done = 0;
  return Promise.all(IMAGES.map(key => new Promise(res => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => { (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => { IMG[key] = im; done++; onProgress && onProgress(done / IMAGES.length); res(); }); };
    im.onerror = () => { IMG[key] = null; missing.push(key); done++; onProgress && onProgress(done / IMAGES.length); res(); };
    im.src = `assets/${key}.webp`;
  })));
}
