const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const root = __dirname;
const runtime = path.join(root, 'runtime');
const game = path.join(root, 'game-instance');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));

function launchArguments(bridgePort = 43821) {
  const profile = read(path.join(runtime, 'profile.json'));
  const libraries = profile.libraries.filter(item => !item.rules?.length || item.rules.reduce((allowed, rule) => {
    const matches = !rule.os?.name || rule.os.name === 'windows';
    return matches ? rule.action === 'allow' : allowed;
  }, false)).map(item => {
    const artifact = item.downloads?.artifact || item.artifact;
    return artifact?.path ? path.join(runtime, 'libraries', artifact.path.replace(/^libraries[\\/]/, '')) : null;
  }).filter(Boolean);
  const missing = libraries.filter(file => !fs.existsSync(file));
  if (missing.length) throw new Error('Oyun motoru dosyaları eksik. Zombie War paketini yeniden kurun.');
  const nativeDir = path.join(runtime, 'natives');
  const variables = {
    natives_directory: nativeDir, library_directory: path.join(runtime, 'libraries'),
    classpath: [...libraries, path.join(runtime, 'client.jar')].join(path.delimiter),
    classpath_separator: path.delimiter, launcher_name: 'TikMnG', launcher_version: '6.5.14',
    version_name: 'TikMnG-Zombie-War', version_type: 'release',
    auth_player_name: 'TikMnG', auth_uuid: '00000000000000000000000000000000', auth_access_token: '0',
    clientid: '', auth_xuid: '', user_type: 'legacy',
    game_directory: game, assets_root: path.join(runtime, 'assets'),
    assets_index_name: profile.assetIndex.id, resolution_width: '1600', resolution_height: '900'
  };
  const rulesAllow = rules => !rules?.length || rules.reduce((allowed, rule) => {
    const os = rule.os;
    const matches = (!os?.name || os.name === 'windows') && !rule.features;
    return matches ? rule.action === 'allow' : allowed;
  }, false);
  const expand = entries => entries.flatMap(entry => {
    if (typeof entry === 'string') return [entry];
    if (!rulesAllow(entry.rules)) return [];
    const value = entry.value ?? entry.values;
    return Array.isArray(value) ? value : value ? [value] : [];
  }).map(value => value.replace(/\$\{([^}]+)\}/g, (_, key) => variables[key] ?? ''));
  const jvm = expand(profile.arguments.jvm).map(arg => arg.startsWith('-DignoreList=') ? arg + ',client.jar' : arg);
  let selectedMap = 'dust2';
  try { const selected = read(path.join(game, 'config', 'mng-zombie-strike.json')).selectedMap; if (['dust2','office','fighting_arena','romanya'].includes(selected)) selectedMap = selected; } catch {}
  return ['-Xms1G', '-Xmx4G', `-Dmng.bridge.port=${bridgePort}`, `-Dmng.node.path=${process.execPath}`,
    `-Dmng.node.electron=${process.env.ELECTRON_RUN_AS_NODE === '1'}`, ...jvm, profile.mainClass,
    ...expand(profile.arguments.game), '--width', '1600', '--height', '900', '--quickPlaySingleplayer', selectedMap];
}

function reserveBridgePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const selected = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(selected));
    });
  });
}

async function startBridge(bridgePort) {
  const logPath = path.join(root, 'live-bridge', 'bridge.log');
  const errorPath = path.join(root, 'live-bridge', 'bridge-error.log');
  const bridge = spawn(process.execPath, [path.join(root, 'live-bridge', 'server.js')], {
    cwd: path.join(root, 'live-bridge'), windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', MNG_BRIDGE_PORT: String(bridgePort) },
    stdio: ['ignore', fs.openSync(logPath, 'a'), fs.openSync(errorPath, 'a')]
  });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(resolve => setTimeout(resolve, 250));
    if (bridge.exitCode !== null) break;
    try {
      const health = await fetch(`http://127.0.0.1:${bridgePort}/health`).then(r => r.json());
      if (health.version === '9') { ready = true; break; }
    } catch {}
  }
  if (!ready) { bridge.kill(); throw new Error('Canlı yayın servisi başlatılamadı. Oyunu launcher üzerinden yeniden açın.'); }
  return bridge;
}

async function main() {
  const java = path.join(runtime, 'java', 'bin', 'java.exe');
  if (!fs.existsSync(java)) throw new Error('Java oyun motoru eksik. Zombie War paketini yeniden kurun.');
  const bridgePort = await reserveBridgePort();
  const args = launchArguments(bridgePort);
  if (process.argv.includes('--check')) { console.log(JSON.stringify({ ok: true, libraries: read(path.join(runtime, 'profile.json')).libraries.length, arguments: args.length })); return; }
  const bridge = await startBridge(bridgePort);
  const argumentFile = path.join(game, 'launch-args.txt');
  fs.writeFileSync(argumentFile, args.map(value => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join('\n'));
  const child = spawn(java, ['@' + argumentFile], { cwd: game, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
  const smoke = process.argv.includes('--smoke');
  let smokePassed = false;
  const smokeTimer = smoke ? setTimeout(() => { console.error('Minecraft dünya yükleme kontrolü zaman aşımına uğradı.'); child.kill(); }, 120000) : null;
  const log = fs.createWriteStream(path.join(game, 'launch.log'));
  child.stdout.on('data', chunk => {
    log.write(chunk);
    if (/Created:.*atlas|Setting user|Starting integrated minecraft server/i.test(String(chunk))) console.log('MNG_GAME_READY');
    if (smoke && !smokePassed && /PlayerList.*logged in with entity id/i.test(String(chunk))) {
      smokePassed = true; console.log('MNG_WORLD_LOADED'); clearTimeout(smokeTimer);
      setTimeout(() => child.kill(), 2500);
    }
  });
  child.stderr.on('data', chunk => log.write(chunk));
  child.on('error', error => { bridge?.kill(); console.error(error.message); process.exitCode=1; });
  child.on('exit', code => { clearTimeout(smokeTimer); bridge?.kill(); log.end(); if(code&&!smokePassed)console.error('Zombie War açılamadı. game-instance/launch.log kaydını kontrol edin.'); process.exitCode=smokePassed?0:smoke?(code||1):(code||0); });
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
module.exports={launchArguments};
