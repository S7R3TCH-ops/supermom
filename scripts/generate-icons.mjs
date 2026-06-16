import sharp from 'sharp';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const sourceIcon = join(__dirname, '../public/branding/supermom_icon_transparent.png');
const iconsDir = join(__dirname, '../public/icons');

// Maskable icons (transparent, OS applies rounding)
const maskableSizes = [192, 512];

// Non-maskable fallback sizes (white background for older devices)
const nonMaskableSizes = [96, 144, 180, 256, 384];

async function generateIcons() {
  console.log('🎨 Generating app icons...\n');

  // Generate maskable icons (transparent background)
  for (const size of maskableSizes) {
    const outputPath = join(iconsDir, `icon-${size}x${size}-maskable.png`);
    await sharp(sourceIcon)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
    console.log(`✓ Maskable ${size}x${size}: ${outputPath}`);
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

  // Generate apple-touch-icon (180x180, non-maskable)
  const applePath = join(iconsDir, 'apple-touch-icon.png');
  await sharp(sourceIcon)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
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
