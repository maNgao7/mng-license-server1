const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { Readable } = require('node:stream');

const root = path.resolve(__dirname, '../..');
const releaseDir = path.join(root, 'release-v6.5.10');
const repo = 'maNgao7/mng-license-server1';
const tag = 'v6.5.10';
const files = [
  ['zombie-war.zip', path.join(releaseDir, 'zombie-war.zip')],
  ['manifest-6.5.10.json', path.join(releaseDir, 'manifest-6.5.10.json')]
];

const credential = cp.spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }
});
const token = credential.stdout?.split('\n').find(line => line.startsWith('password='))?.slice(9);
if (!token) throw Error('GitHub kimlik doğrulaması gerekli.');
const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'TikMnG-zombie-hotfix', Accept: 'application/vnd.github+json' };

async function api(url, method = 'GET') {
  const response = await fetch(`https://api.github.com/repos/${repo}${url}`, { method, headers });
  if (!response.ok) throw Error(`GitHub ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

(async () => {
  const release = await api(`/releases/tags/${tag}`);
  for (const [name, file] of files) {
    const existing = release.assets.find(asset => asset.name === name);
    if (existing) await api(`/releases/assets/${existing.id}`, 'DELETE');
    const size = fs.statSync(file).size;
    const url = `${release.upload_url.split('{')[0]}?name=${encodeURIComponent(name)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) },
      body: Readable.toWeb(fs.createReadStream(file)), duplex: 'half'
    });
    if (!response.ok) throw Error(`${name}: ${response.status} ${await response.text()}`);
    console.log(`Uploaded ${name} ${size}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
