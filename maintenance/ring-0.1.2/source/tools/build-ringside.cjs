'use strict';
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('D:/TikMnG-GitHub-Araclari/runtime/npm-tools/node_modules/esbuild');
const three = 'D:/TikMnG-GitHub-Araclari/three-r170';
const root = path.resolve(__dirname, '..');
esbuild.buildSync({
  entryPoints: [path.join(root, 'spectator/ringside.mjs')],
  alias: { three: path.join(three, 'src/Three.js') },
  bundle: true, minify: true, format: 'iife', target: 'chrome120',
  outfile: path.join(root, 'spectator/ringside.bundle.js'),
});
fs.copyFileSync(path.join(three, 'LICENSE'), path.join(root, 'spectator/three-LICENSE.txt'));
