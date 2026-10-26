const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { Readable } = require('node:stream');
const root = path.resolve(__dirname, '../..');
const releaseDir = path.join(root, 'release-v6.5.13');
const repo = 'maNgao7/mng-license-server1';
const tag = 'v6.5.13';
const manifest = JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest-6.5.13.json'), 'utf8'));
const files = [
  ['TikMnG-Setup-6.5.13.exe', path.join(root, 'launcher', 'dist', 'TikMnG Setup 6.5.13.exe')],
  ['TikMnG-6.5.13-Portable.exe', path.join(root, 'launcher', 'dist', 'TikMnG 6.5.13.exe')],
  ['zombie-war.zip', path.join(releaseDir, 'zombie-war.zip')],
  ['KONTROL-RAPORU.md', path.join(releaseDir, 'KONTROL-RAPORU.md')],
  ['manifest-6.5.13.json', path.join(releaseDir, 'manifest-6.5.13.json')]
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
    tag_name: tag, target_commitish: 'release/tikmng-6.5.13', name: 'TikMnG 6.5.13', draft: true,
    body: 'Zombie War: TikTok v3 gift.type ve like.count alanları okunur. Tüm hediyelerde seri ilerlemesi ve bitişi aynı toplamdan sayılır; yinelenen mesajlar tekrar uygulanmaz. Her izleyicinin her 100 beğenisi yeniden kayıtlı eylemi tetikler. Takip tekrarları tekilleştirilir. Yalnızca Zombie War paketi yenilenir. Ayrıntılı doğrulama KONTROL-RAPORU.md içindedir.'
  });
  for (const [name, file] of files) {
    const existing = release.assets.find(asset => asset.name === name);
    const expected = manifest.files.find(item => item.name === name);
    if (existing && expected && existing.state === 'uploaded' && existing.size === expected.bytes && existing.digest === `sha256:${expected.sha256}`) {
      console.log(`Already verified ${name}`);
      continue;
    }
    if (existing) await api(`/releases/assets/${existing.id}`, 'DELETE');
    const size = fs.statSync(file).size;
    const response = await fetch(`${release.upload_url.split('{')[0]}?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) }, body: Readable.toWeb(fs.createReadStream(file)), duplex: 'half' });
    if (!response.ok) throw Error(`${name}: ${response.status} ${await response.text()}`);
    console.log(`Uploaded ${name} ${size}`);
  }
  release = await api(`/releases/${release.id}`, 'PATCH', { target_commitish: 'release/tikmng-6.5.13', draft: false, make_latest: 'true' });
  console.log(release.html_url);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
