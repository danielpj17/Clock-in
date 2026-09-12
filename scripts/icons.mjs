// Generates the PWA icons in public/icons from an inline SVG. Run: npm run icons
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#2563eb"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 0.86})">
    <circle r="180" fill="none" stroke="#fff" stroke-width="28"/>
    <circle r="16" fill="#fff"/>
    <path d="M0 0 L0 -118" stroke="#fff" stroke-width="28" stroke-linecap="round"/>
    <path d="M0 0 L84 48" stroke="#fff" stroke-width="28" stroke-linecap="round"/>
    <path d="M132 -132 l28 -28" stroke="#bfdbfe" stroke-width="28" stroke-linecap="round"/>
  </g>
</svg>`;

await mkdir("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-512-maskable.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];
for (const [name, size, pad] of out) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log("wrote", name);
}
