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
