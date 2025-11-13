import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const sourceLogo = path.join(repoRoot, 'logo.png');
const targets = [
  path.join(repoRoot, 'extension', 'public'),
  path.join(repoRoot, 'extension-edge', 'public')
];
const iconSizes = [16, 32, 48, 128, 256, 512];

async function ensureSourceLogo() {
  try {
    const stats = await fs.stat(sourceLogo);
    if (!stats.isFile()) {
      throw new Error(`logo.png at ${sourceLogo} is not a file`);
    }
  } catch (error) {
    throw new Error(`logo.png not found at ${sourceLogo}. Please add the source logo before building.`);
  }
}

async function purgeLegacyIcons(targetDir) {
  const entries = await fs.readdir(targetDir).catch(() => []);
  const removals = entries.filter(name => {
    const lower = name.toLowerCase();
    return (
      lower === 'logo.svg' ||
      /^icon-(16|32|48|128|256|512)\.svg$/i.test(lower) ||
      /^icon-(16|32|48|128|256|512)\.png$/i.test(lower)
    );
  });

  await Promise.all(
    removals.map(async name => {
      const filePath = path.join(targetDir, name);
      await fs.rm(filePath, { force: true });
    })
  );
}

async function generateIconsFor(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  await purgeLegacyIcons(targetDir);

  const copyTarget = path.join(targetDir, 'logo.png');
  await fs.copyFile(sourceLogo, copyTarget);

  await Promise.all(
    iconSizes.map(async size => {
      const destination = path.join(targetDir, `icon-${size}.png`);
      await sharp(sourceLogo)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({ compressionLevel: 9 })
        .toFile(destination);
    })
  );
}

async function main() {
  await ensureSourceLogo();
  await Promise.all(targets.map(target => generateIconsFor(target)));
}

main().catch(error => {
  console.error('[generate-icons] failed:', error);
  process.exit(1);
});
