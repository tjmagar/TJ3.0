import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#F5F2EA"/>
  <text x="256" y="336" font-family="Liberation Serif, Georgia, serif" font-size="300"
        font-weight="300" fill="#1D1C19" text-anchor="middle">T</text>
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
