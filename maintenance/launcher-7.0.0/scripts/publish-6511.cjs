const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { Readable } = require('node:stream');
const root = path.resolve(__dirname, '../..');
const releaseDir = path.join(root, 'release-v6.5.11');
const repo = 'maNgao7/mng-license-server1';
const tag = 'v6.5.11';
const files = [
  ['TikMnG-Setup-6.5.11.exe', path.join(root, 'launcher', 'dist', 'TikMnG Setup 6.5.11.exe')],
  ['TikMnG-6.5.11-Portable.exe', path.join(root, 'launcher', 'dist', 'TikMnG 6.5.11.exe')],
  ['zombie-war.zip', path.join(releaseDir, 'zombie-war.zip')],
  ['KONTROL-RAPORU.md', path.join(releaseDir, 'KONTROL-RAPORU.md')],
  ['manifest-6.5.11.json', path.join(releaseDir, 'manifest-6.5.11.json')]
];
const credential = cp.spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } });
const token = credential.stdout?.split('\n').find(line => line.startsWith('password='))?.slice(9);
if (!token) throw Error('GitHub kimlik doğrulaması gerekli.');
const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'TikMnG-release', Accept: 'application/vnd.github+json' };
async function api(url, method = 'GET', data) {
  const response = await fetch(`https://api.github.com/repos/${repo}${url}`, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  if (!response.ok) throw Error(`GitHub ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
(async () => {
  let release;
  try { release = await api(`/releases/tags/${tag}`); } catch (error) { if (!String(error.message).includes('404')) throw error; }
  if (!release) release = await api('/releases', 'POST', {
    tag_name: tag, target_commitish: 'release/tikmng-6.5.11', name: 'TikMnG 6.5.11', draft: true,
    body: 'Zombie War oyun paketi güncellemesi. 100 beğeni artık yayın genelinde birlikte sayılır. Takip ve standart hediyeler doğru adetleri üretir. Bölgesel hediye kimliği değişiklikleri hediye adıyla güvenli biçimde eşleştirilir. Diğer oyun paketleri yeniden indirilmez.'
  });
  for (const [name, file] of files) {
    const existing = release.assets.find(asset => asset.name === name);
    if (existing) await api(`/releases/assets/${existing.id}`, 'DELETE');
    const size = fs.statSync(file).size;
    const response = await fetch(`${release.upload_url.split('{')[0]}?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) }, body: Readable.toWeb(fs.createReadStream(file)), duplex: 'half' });
    if (!response.ok) throw Error(`${name}: ${response.status} ${await response.text()}`);
    console.log(`Uploaded ${name} ${size}`);
  }
  release = await api(`/releases/${release.id}`, 'PATCH', { target_commitish: 'release/tikmng-6.5.11', draft: false, make_latest: 'true' });
  console.log(release.html_url);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
