// Generates the static portrait variants served from /img.
import sharp from 'sharp';

for (const w of [240, 480]) {
  await sharp('src/assets/portrait.jpg').resize({ width: w }).webp({ quality: 80 }).toFile(`public/img/portrait-${w}.webp`);
  console.log('wrote', w);
}
