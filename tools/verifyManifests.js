const fs = require('fs');
const path = require('path');

function checkDist(distPath) {
  if (!fs.existsSync(distPath)) {
    console.error('Dist path missing:', distPath);
    process.exit(2);
  }

  const items = fs.readdirSync(distPath);
  const manifestFiles = items.filter(f => f.toLowerCase() === 'manifest.json');
  if (manifestFiles.length === 0) {
    console.error('No manifest.json found in', distPath);
    return false;
  }
  if (manifestFiles.length > 1) {
    console.error('Multiple top-level manifest.json files found in', distPath);
    return false;
  }

  // Also ensure there is not a .vite/manifest.json leftover that would cause duplicates when zipping
  const viteManifest = path.join(distPath, '.vite', 'manifest.json');
  if (fs.existsSync(viteManifest)) {
    console.error('.vite/manifest.json found inside', distPath, 'this may create a duplicate manifest in zips. Remove it from the output or run cleanup.');
    return false;
  }

  // Ensure there are no SVG icon files in the public output - stores may reject svg images
  const publicDir = path.join(distPath, 'public');
  if (fs.existsSync(publicDir)) {
    const publicFiles = fs.readdirSync(publicDir);
    const svgFiles = publicFiles.filter(f => f.toLowerCase().endsWith('.svg'));
    if (svgFiles.length > 0) {
      console.error('SVG files found in', publicDir, '- some store checks reject SVG icons. Remove or convert them to PNG before packaging. Files:', svgFiles.join(', '));
      return false;
    }
  }

  console.log('OK:', distPath, 'contains a single manifest.json and no .vite manifest.');
  return true;
}

const roots = [
  path.resolve(__dirname, '..', 'extension', 'dist'),
  path.resolve(__dirname, '..', 'extension-edge', 'dist')
];

let ok = true;
for (const r of roots) {
  const res = checkDist(r);
  ok = ok && res;
}

if (!ok) process.exit(1);
process.exit(0);
