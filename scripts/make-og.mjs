// Renders public/og.png (1200×630) from public/og.svg with the portrait on the right.
// Run after editing og.svg or the portrait: node scripts/make-og.mjs
import sharp from 'sharp';

const portrait = await sharp('src/assets/portrait.jpg').resize(420, 560, { fit: 'cover', position: 'top' }).toBuffer();
const mask = Buffer.from('<svg width="420" height="560"><rect width="420" height="560" rx="28" fill="#fff"/></svg>');
const rounded = await sharp(portrait).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

await sharp('public/og.svg')
  .resize(1200, 630)
  .composite([{ input: rounded, left: 716, top: 35 }])
  .png()
  .toFile('public/og.png');
console.log('OK public/og.png');
