import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json' assert { type: 'json' };

export default defineManifest(async () => ({
  manifest_version: 3,
  name: 'Scrollwise Tracker',
  description: 'Track your scrolling energy and receive playful wellness insights.',
  version: packageJson.version,
  permissions: ['storage', 'tabs', 'scripting', 'alarms', 'activeTab'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Scrollwise'
  },
  icons: {
    16: 'public/icon-16.svg',
    32: 'public/icon-32.svg',
    48: 'public/icon-48.svg',
    128: 'public/icon-128.svg'
  },
  options_page: 'src/options/index.html',
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    }
  ],
  web_accessible_resources: [
    {
      resources: ['public/*'],
      matches: ['<all_urls>']
    }
  ]
}));
