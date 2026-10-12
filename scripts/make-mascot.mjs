// Builds the six mascot poses served from /mascot as 256×256 WebP with transparency.
// Default: trims and fits the generated images in .secrets/mascot-raw/<pose>.png.
// --fallback: crops the portrait into a circle and writes it under every pose name.
import fs from 'node:fs';
import sharp from 'sharp';

const POSES = ['idle', 'wave', 'think', 'type', 'point', 'sleep'];
const SIZE = 256;
const fallback = process.argv.includes('--fallback');

fs.mkdirSync('public/mascot', { recursive: true });

const circle = Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}"/></svg>`);
const avatar = fallback
  ? await sharp('src/assets/portrait.jpg')
      .resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toBuffer()
  : null;

for (const pose of POSES) {
  const image = avatar
    ? sharp(avatar)
    : sharp(await sharp(`.secrets/mascot-raw/${pose}.png`).ensureAlpha().trim().toBuffer()).resize(SIZE, SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
  await image.ensureAlpha().webp({ quality: 85, alphaQuality: 100 }).toFile(`public/mascot/${pose}.webp`);
  console.log('wrote', pose);
}
