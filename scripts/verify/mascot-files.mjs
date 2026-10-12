// Checks the six mascot poses exist as 256×256 images with an alpha channel.
import sharp from 'sharp';

const fails = [];
for (const pose of ['idle', 'wave', 'think', 'type', 'point', 'sleep']) {
  try {
    const { width, height, hasAlpha } = await sharp(`public/mascot/${pose}.webp`).metadata();
    if (width !== 256 || height !== 256 || !hasAlpha) fails.push(`${pose} ${width}x${height} alpha=${hasAlpha}`);
  } catch (e) {
    fails.push(`${pose} ${e.message}`);
  }
}
if (fails.length) {
  console.log('FAIL mascot\n' + fails.join('\n'));
  process.exitCode = 1;
} else console.log('OK mascot');
