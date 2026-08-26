import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16201C"/>
      <stop offset="0.55" stop-color="#14181B"/>
      <stop offset="1" stop-color="#101315"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="118" cy="96" r="150" fill="#1E5C43" opacity="0.55"/>
  <circle cx="412" cy="430" r="132" fill="#FF7A2F" opacity="0.28"/>
  <text x="256" y="336" font-family="Liberation Serif, Georgia, serif" font-size="300"
        font-weight="300" fill="#EDE4D2" text-anchor="middle">T</text>
</svg>`;

const targets = [
  ["public/apple-touch-icon.png", 180],
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
];

for (const [out, size] of targets) {
  await sharp(Buffer.from(svg(size)))
    .resize(size, size)
    .png()
    .toFile(out);
  console.log("wrote", out, size);
}
