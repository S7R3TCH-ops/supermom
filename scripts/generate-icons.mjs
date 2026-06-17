import sharp from 'sharp';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const sourceIcon = join(__dirname, '../public/branding/supermom_icon_transparent.png');
const iconsDir = join(__dirname, '../public/icons');

// Maskable icons (transparent, OS applies rounding + safe-zone)
const maskableSizes = [192, 512];

// Any-purpose icons (pink brand background, white icon — used for app drawer/home screen)
const pinkBgSizes = [192, 512];

// Non-maskable fallback sizes (white background for older devices)
const nonMaskableSizes = [96, 144, 180, 256, 384];

async function generateIcons() {
  console.log('🎨 Generating app icons...\n');

  const pink = { r: 252, g: 70, b: 147, alpha: 1 };

  // Generate maskable icons: pink bg + artwork at 75% safe zone (OS crops to shape)
  for (const size of maskableSizes) {
    const outputPath = join(iconsDir, `icon-${size}x${size}-maskable.png`);
    const artworkSize = Math.round(size * 0.75);
    const offset = Math.round((size - artworkSize) / 2);
    const artwork = await sharp(sourceIcon)
      .resize(artworkSize, artworkSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: pink } })
      .composite([{ input: artwork, left: offset, top: offset }])
      .png()
      .toFile(outputPath);
    console.log(`✓ Maskable ${size}x${size}: ${outputPath}`);
  }

  // Generate any-purpose icons (pink brand background #FC4693, artwork fills space)
  for (const size of pinkBgSizes) {
    const outputPath = join(iconsDir, `icon-${size}.png`);
    const artwork = await sharp(sourceIcon)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: pink } })
      .composite([{ input: artwork, left: 0, top: 0 }])
      .png()
      .toFile(outputPath);
    console.log(`✓ Any-purpose (pink bg) ${size}x${size}: ${outputPath}`);
  }

  // Generate non-maskable icons (white background)
  for (const size of nonMaskableSizes) {
    const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(sourceIcon)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(outputPath);
    console.log(`✓ Non-maskable ${size}x${size}: ${outputPath}`);
  }

  // Generate apple-touch-icon (180x180, pink bg for iOS home screen)
  const applePath = join(iconsDir, 'apple-touch-icon.png');
  const appleArtwork = await sharp(sourceIcon)
    .resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: pink } })
    .composite([{ input: appleArtwork, left: 20, top: 20 }])
    .png()
    .toFile(applePath);
  console.log(`✓ Apple touch icon: ${applePath}`);

  // Generate favicon backup (SVG stays, but have a PNG too)
  const faviconPath = join(iconsDir, 'favicon-192.png');
  await sharp(sourceIcon)
    .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(faviconPath);
  console.log(`✓ Favicon PNG: ${faviconPath}`);

  console.log('\n✅ Icon generation complete!');
}

generateIcons().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
