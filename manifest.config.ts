import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  background: {
    "service_worker": "background.js"
  },
  permissions: [
    'contentSettings',
    'activeTab',
    'scripting',
    'storage',
    'tabs',
    'cookies',
    'alarms',
  ],
  host_permissions: ['*://*.eptrade.cn/*'],
  content_scripts: [{
    js: ['src/content/features/index.ts'],
    matches: ['https://www.eptrade.cn/*'],
  }],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
