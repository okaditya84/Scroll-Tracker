import type { Config } from 'tailwindcss';
import baseConfig from '../extension/tailwind.config';
import path from 'node:path';

const edgeConfig: Config = {
  ...baseConfig,
  content: [path.resolve(__dirname, '../extension/src/**/*.{ts,tsx,html}')]
};

export default edgeConfig;
