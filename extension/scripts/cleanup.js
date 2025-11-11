const { rm, stat } = require('node:fs/promises');
const path = require('node:path');

const distPath = path.resolve(process.cwd(), 'dist');
const viteArtifacts = path.join(distPath, '.vite');

const ensureSingleManifest = async () => {
  try {
    const stats = await stat(viteArtifacts);
    if (stats.isDirectory()) {
      await rm(viteArtifacts, { recursive: true, force: true });
    }
  } catch (error) {
    const code = error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined;
    if (code !== 'ENOENT') {
      throw error;
    }
  }
};

ensureSingleManifest().catch(error => {
  console.error('[cleanup] failed to prune .vite artifacts', error);
  process.exitCode = 1;
});

// Remove SVG icon files from dist/public because some Chromium store checkers reject SVG image types.
const removeSvgIcons = async () => {
  const publicPath = path.join(distPath, 'public');
  try {
    // try reading public dir; if missing, nothing to do
    const files = await require('node:fs').promises.readdir(publicPath);
    const svgFiles = files.filter(f => f.toLowerCase().endsWith('.svg'));
    await Promise.all(svgFiles.map(f => rm(path.join(publicPath, f), { force: true })));
  } catch (error) {
    const code = error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined;
    if (code !== 'ENOENT') {
      console.error('[cleanup] failed to remove svg icons', error);
      process.exitCode = 1;
    }
  }
};

removeSvgIcons().catch(() => {
  // errors handled inside
});
