import { defineManifest } from '@crxjs/vite-plugin';
import basePackageJson from '../extension/package.json' assert { type: 'json' };

const EDGE_MINIMUM_VERSION = '118.0.2088.61';

export default defineManifest(async () => ({
  manifest_version: 3,
  name: 'Scrollwise Tracker for Microsoft Edge',
  description: 'Track your scrolling energy and receive playful wellness insights tuned for Edge.',
  version: basePackageJson.version,
  permissions: ['storage', 'tabs', 'scripting', 'alarms', 'activeTab'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Scrollwise on Edge'
  },
  icons: {
    16: 'public/icon-16.png',
    32: 'public/icon-32.png',
    48: 'public/icon-48.png',
    128: 'public/icon-128.png'
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
  ],
  browser_specific_settings: {
    edge: {
      minimum_edge_version: EDGE_MINIMUM_VERSION
    }
  }
}));
