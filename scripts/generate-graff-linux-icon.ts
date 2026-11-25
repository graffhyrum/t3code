#!/usr/bin/env bun
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import sharp from "sharp";

const REPO_ROOT = NodePath.resolve(import.meta.dirname, "..");
const SOURCE_PNG = NodePath.join(REPO_ROOT, "assets/prod/black-universal-1024.png");
const OUTPUT_DIR = NodePath.join(REPO_ROOT, "assets/graff");
const OUTPUT_1024 = NodePath.join(OUTPUT_DIR, "green-universal-1024.png");
const OUTPUT_ICONS_DIR = NodePath.join(OUTPUT_DIR, "icons");
const PREVIEW_PNG = NodePath.join(REPO_ROOT, "release/icon-preview.png");
const LINUX_ICON_SIZES = [16, 22, 24, 32, 48, 64, 128, 256, 512] as const;

// Dark green background (#0B3D20) replacing the black background while preserving the T3 glyph.
const BG_R = 0x0b;
const BG_G = 0x3d;
const BG_B = 0x20;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const { data, info } = await sharp(SOURCE_PNG)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const out = Buffer.from(data);
for (let i = 0; i < out.length; i += 4) {
  const r = out[i]!;
  const g = out[i + 1]!;
  const b = out[i + 2]!;
  const a = out[i + 3]!;
  if (a === 0) continue;

  const lum = (r + g + b) / 3;
  // Screen blend with #0B3D20 for background & outer rim, fading smoothly to untouched original for the T3 glyph.
  const screenR = BG_R + (1 - BG_R / 255) * r;
  const screenG = BG_G + (1 - BG_G / 255) * g;
  const screenB = BG_B + (1 - BG_B / 255) * b;
  const glyphWeight = smoothstep(80, 136, lum);

  out[i] = Math.round(screenR * (1 - glyphWeight) + r * glyphWeight);
  out[i + 1] = Math.round(screenG * (1 - glyphWeight) + g * glyphWeight);
  out[i + 2] = Math.round(screenB * (1 - glyphWeight) + b * glyphWeight);
}

await NodeFSP.mkdir(OUTPUT_ICONS_DIR, { recursive: true });
await NodeFSP.mkdir(NodePath.dirname(PREVIEW_PNG), { recursive: true });

const baseImage = sharp(out, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  },
});

const masterPng = await baseImage.png().toBuffer();
await NodeFSP.writeFile(OUTPUT_1024, masterPng);
await NodeFSP.writeFile(PREVIEW_PNG, masterPng);

for (const size of LINUX_ICON_SIZES) {
  await sharp(masterPng)
    .resize(size, size)
    .png()
    .toFile(NodePath.join(OUTPUT_ICONS_DIR, `${size}x${size}.png`));
}

console.log(
  `Generated ${OUTPUT_1024}, ${LINUX_ICON_SIZES.length} sizes in ${OUTPUT_ICONS_DIR}, and ${PREVIEW_PNG}`,
);
