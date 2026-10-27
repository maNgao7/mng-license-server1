const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release-v6.5.13/manifest-6.5.13.json'), 'utf8'));
const credential = cp.spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } });
const token = credential.stdout?.split('\n').find(line => line.startsWith('password='))?.slice(9);
if (!token) throw Error('GitHub authentication required');
(async () => {
  const response = await fetch('https://api.github.com/repos/maNgao7/mng-license-server1/releases/tags/v6.5.13', {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'TikMnG-release', Accept: 'application/vnd.github+json' }
  });
  if (!response.ok) throw Error(`Release lookup failed: ${response.status}`);
  const release = await response.json();
  if (release.draft) throw Error('Release is still a draft');
  for (const file of manifest.files) {
    const asset = release.assets.find(item => item.name === file.name);
    if (!asset || asset.state !== 'uploaded' || asset.size !== file.bytes) throw Error(`Asset incomplete: ${file.name}`);
    if (asset.digest !== `sha256:${file.sha256}`) throw Error(`GitHub SHA256 mismatch: ${file.name}`);
    console.log(`VERIFIED ${file.name} ${asset.size} SHA256 OK`);
  }
  console.log(release.html_url);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
