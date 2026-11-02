const fs = require('node:fs');
const path = require('node:path');
const library = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/lucide';
const { PanelsTopLeft } = require(library);
const root = path.resolve(__dirname, '../public/icons');
fs.mkdirSync(root, { recursive: true });
const body = PanelsTopLeft.map(([tag, attrs]) => '<' + tag + ' ' + Object.entries(attrs).map(([key, value]) => key + '=' + JSON.stringify(value)).join(' ') + '/>').join('');
fs.writeFileSync(path.join(root, 'panels-top-left.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd6ef" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>');
fs.copyFileSync(path.join(library, 'LICENSE'), path.join(root, 'lucide-LICENSE.txt'));
