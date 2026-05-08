#!/usr/bin/env node
/*
 * Generate the PWA icon set from a single inline SVG.
 *
 * Run once whenever the icon design changes:
 *   node scripts/generate-icons.mjs
 *
 * Outputs:
 *   public/icons/icon-192.png        — PWA manifest standard
 *   public/icons/icon-512.png        — PWA manifest standard
 *   public/icons/apple-touch-icon.png (180x180) — iOS home screen
 *   public/icons/maskable-512.png    — Android adaptive icon (safe zone)
 *
 * Design: solid accent-blue background + Lucide `Car` silhouette in
 * white, generously padded so the icon reads at small sizes.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ACCENT = "#0a84ff";
const FG = "#ffffff";

// Lucide `Car` icon paths (24x24 viewBox). Pulled from lucide-react v0.468.
const CAR_PATHS = [
  "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2",
  "M14 17H9",
];
const CAR_CIRCLES = [
  { cx: 6.5, cy: 17.5, r: 2.5 },
  { cx: 16.5, cy: 17.5, r: 2.5 },
];

/**
 * Build an SVG at the requested size with the car icon centered. Stroke
 * width scales with size so the line weight reads correctly at every
 * resolution. Padding is a fixed fraction of the canvas.
 */
function buildSvg({ size, maskable = false }) {
  // Maskable icons need a "safe zone" — content must fit inside a
  // 80%-diameter circle. We just shrink the icon a bit more.
  const padFrac = maskable ? 0.22 : 0.16;
  const inner = size * (1 - padFrac * 2);
  const offset = (size - inner) / 2;
  // Icon native viewBox is 24x24. Scale uniformly into the inner box.
  const scale = inner / 24;
  const stroke = 2; // matches Lucide default; the transform scales it

  const pathStr = CAR_PATHS.map(
    (d) =>
      `<path d="${d}" fill="none" stroke="${FG}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join("");
  const circleStr = CAR_CIRCLES.map(
    (c) =>
      `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="${FG}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join("");

  // Outer rect = full icon background. Inner <g> applies the offset +
  // scale so the car silhouette lands centered in the safe zone.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${ACCENT}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    ${pathStr}
    ${circleStr}
  </g>
</svg>`;
}

async function render(svg, outPath, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(outPath);
  console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
}

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "icons");

await render(buildSvg({ size: 192 }), path.join(OUT, "icon-192.png"), 192);
await render(buildSvg({ size: 512 }), path.join(OUT, "icon-512.png"), 512);
await render(
  buildSvg({ size: 180 }),
  path.join(OUT, "apple-touch-icon.png"),
  180
);
await render(
  buildSvg({ size: 512, maskable: true }),
  path.join(OUT, "maskable-512.png"),
  512
);

// Also drop the source SVG for visibility / re-rendering in other tools.
await writeFile(
  path.join(OUT, "icon.svg"),
  buildSvg({ size: 512 }),
  "utf-8"
);
console.log("done");
