const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const root = __dirname;
const project = 'C:\\Users\\User\\Desktop\\MNG-TikTok-Game';
const bundled = fs.existsSync(path.join(root, 'runtime', 'profile.json'));
const runtime = bundled ? path.join(root, 'runtime') : path.join(project, 'apps', 'battle-royale', 'prototype', 'runtime');
const bridgeEntry = bundled ? path.join(root, 'live-bridge', 'server.js') : path.join(project, 'apps', 'battle-royale', 'prototype', 'live-bridge', 'server.js');
const liveQA=process.argv.some(v=>/^--live-qa=[a-z0-9_.]{2,32}$/.test(v));
const instance = path.join(root, process.argv.includes('--smoke') ? liveQA?'qa/instance-v015-live':'qa/instance-v015' : bundled ? 'game-instance' : 'instance');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

function launchArguments(port, smoke = false, widgets = null) {
  const profile = read(path.join(runtime, 'profile.json'));
  const allow = rules => !rules?.length || rules.reduce((a, r) =>
    (!r.os?.name || r.os.name === 'windows') && !r.features ? r.action === 'allow' : a, false);
  const libraries = profile.libraries.filter(l => allow(l.rules)).map(l => {
    const item = l.downloads?.artifact || l.artifact;
    return item?.path ? path.join(runtime, 'libraries', item.path.replace(/^libraries[\\/]/, '')) : null;
  }).filter(Boolean);
  for (const file of [...libraries, path.join(runtime, 'client.jar')])
    if (!fs.existsSync(file)) throw new Error('Minecraft 1.20.1 oyun motoru eksik: ' + path.basename(file));
  const vars = {
    natives_directory: path.join(runtime, 'natives'), library_directory: path.join(runtime, 'libraries'),
    classpath: [...libraries, path.join(runtime, 'client.jar')].join(path.delimiter), classpath_separator: path.delimiter,
    launcher_name: 'TikMnG Snake Arena Prototype', launcher_version: '0.15.3', version_name: 'TikMnG-Snake-Arena', version_type: 'release',
    auth_player_name: 'TikMnG', auth_uuid: '00000000000000000000000000000000', auth_access_token: '0',
    clientid: '', auth_xuid: '', user_type: 'legacy', game_directory: instance,
    assets_root: path.join(runtime, 'assets'), assets_index_name: profile.assetIndex.id,
    resolution_width: '1600', resolution_height: '900'
  };
  const expand = values => values.flatMap(v => typeof v === 'string' ? [v] : allow(v.rules) ? [v.value ?? v.values].flat() : [])
    .filter(v => typeof v === 'string').map(v => v.replace(/\$\{([^}]+)\}/g, (_, k) => vars[k] ?? ''));
  const jvm = expand(profile.arguments.jvm).map(v => v.startsWith('-DignoreList=') ? v + ',client.jar' : v);
  return ['-Xms512M', '-Xmx3G', '-Dmng.bridge.port=' + port, ...(smoke ? ['-Dtikmng.snake.smoke=true'] : []),
    ...(smoke&&process.argv.includes('--large-qa')?['-Dtikmng.snake.largeQa=true']:[]),
    ...(widgets?['-Dmng.snake.widget.port='+widgets.port,'-Dmng.snake.widget.key='+widgets.key]:[]),
    ...(smoke && process.argv.some(v => /^--live-qa=[a-z0-9_.]{2,32}$/.test(v)) ?
      ['-Dtikmng.snake.liveQaUser=' + process.argv.find(v => v.startsWith('--live-qa=')).slice(10)] : []),
    ...jvm, profile.mainClass, ...expand(profile.arguments.game), '--width', '1600', '--height', '900'];
}
async function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(error => error ? reject(error) : resolve(port)); });
  });
}
async function main() {
  let relayContext = {};
  try { relayContext = JSON.parse(process.env.MNG_SNAKE_RELAY_CONTEXT || '{}'); } catch {}
  delete process.env.MNG_SNAKE_RELAY_CONTEXT;
  fs.mkdirSync(path.join(instance, 'mods'), { recursive: true });
  fs.mkdirSync(path.join(instance, 'config'), { recursive: true });
  const targetJar = path.join(instance, 'mods', bundled ? 'tikmng_snake_arena-0.15.3.jar' : 'tikmng_snake_arena.jar');
  const jar = bundled ? path.join(root, 'game-instance', 'mods', 'tikmng_snake_arena-0.15.3.jar') : path.join(root, 'mod', 'build', 'libs', 'tikmng_snake_arena-0.15.3.jar');
  if (!fs.existsSync(jar)) throw new Error('Yilan modu henuz derlenmemis.');
  // One stable filename prevents two versions of this mod loading together.
  if (jar !== targetJar) fs.copyFileSync(jar, targetJar);
  const username = String(process.env.MNG_TIKTOK_USER || '').trim().replace(/^@/, '').toLowerCase();
  if (!process.argv.includes('--smoke') && /^[a-z0-9_.]{2,32}$/.test(username)) {
    const configFile = path.join(instance, 'config', 'tikmng-snake-arena.json');
    const config = fs.existsSync(configFile) ? read(configFile) : {};
    config.username = username;
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  }
  const previousJar = path.join(instance, 'mods', 'tikmng_snake_arena-0.1.0.jar');
  if (fs.existsSync(previousJar)) fs.renameSync(previousJar, path.join(root, 'qa', 'tikmng_snake_arena-0.1.0.jar.backup'));
  const options = path.join(instance, 'options.txt');
  if (!fs.existsSync(options)) fs.writeFileSync(options, 'fullscreen:false\nguiScale:2\nrenderDistance:12\nsimulationDistance:5\npauseOnLostFocus:false\nmaxFps:60\nclouds:false\nfov:0.0\n');
  if (process.argv.includes('--smoke')) {
    const qaConfig = path.join(instance, 'config', 'tikmng-snake-arena.json');
    if (!fs.existsSync(qaConfig)) fs.copyFileSync(path.join(root, bundled ? 'game-instance' : 'instance', 'config', 'tikmng-snake-arena.json'), qaConfig);
  }
  const port = await reservePort(), smoke = process.argv.includes('--smoke');
  let args = launchArguments(port, smoke);
  if (process.argv.includes('--check')) { console.log(JSON.stringify({ ok: true, version: '0.15.3', runtime, instance, arguments: args.length })); return; }
  const hash = crypto.createHash('sha256').update((smoke?instance:root).toLowerCase()).digest('hex').slice(0, 20);
  const guard = net.createServer(socket => socket.end());
  if (!await new Promise((resolve, reject) => { guard.once('error', e => e.code === 'EADDRINUSE' ? resolve(false) : reject(e)); guard.listen('\\\\.\\pipe\\TikMnG-Snake-' + hash, () => resolve(true)); })) return;
  const bridgeLog = fs.openSync(path.join(root, 'bridge.log'), 'a');
  const bridge = spawn(process.execPath, [bridgeEntry], { cwd: path.dirname(bridgeEntry), windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', MNG_BRIDGE_PORT: String(port) }, stdio: ['ignore', bridgeLog, bridgeLog] });
  let child, timer, widgets;
  const cleanup = () => { clearTimeout(timer);widgets?.close(); bridge.kill(); guard.close(); };
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 250)); try { const h = await fetch(`http://127.0.0.1:${port}/health`).then(r => r.json()); if (h.ok && h.version === '13') { ready = true; break; } } catch {} }
    if (!ready) throw new Error('Yerel yayin servisi baslatilamadi. bridge.log kaydini kontrol edin.');
    const credentials = relayContext.licenseCode && relayContext.deviceId ?
      () => ({ licenseCode: relayContext.licenseCode, deviceId: relayContext.deviceId }) : undefined;
    widgets=await require('./widget-server.cjs').createWidgetServer({directory:path.join(instance,'config'),
      relay:!smoke||process.argv.includes('--widget-relay-qa'), credentials, serverURL:relayContext.serverURL});
    args=launchArguments(port,smoke,widgets);
    const argumentFile = path.join(instance, 'launch-args.txt');
    fs.writeFileSync(argumentFile, args.map(v => '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join('\n'));
    const log = fs.createWriteStream(path.join(instance, 'launch.log'));
    child = spawn(path.join(runtime, 'java', 'bin', 'java.exe'), ['@' + argumentFile], { cwd: instance, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let rules = false, rendered = false;
    child.stdout.on('data', chunk => { log.write(chunk); const s = String(chunk);
      if (s.includes('MNG_SNAKE_')) console.log(s.trim());
      if (/MNG_SNAKE_ARENA_READY\b/.test(s)) console.log('MNG_GAME_READY');
      if (/MNG_SNAKE_RULES passed=true/.test(s)) rules = true;
      if (/MNG_SNAKE_FEATURES passed=true/.test(s)) rendered = true;
      if(liveQA&&/MNG_SNAKE_LIVE_QA passed=true/.test(s))rendered=true;
    });
    child.stderr.on('data', chunk => log.write(chunk));
    child.once('error', e => { console.error(e.message); cleanup(); process.exitCode = 1; });
    child.once('exit', code => { log.end(); cleanup(); process.exitCode = smoke ? rules && rendered && code === 0 ? 0 : 1 : code || 0; });
    if (smoke) timer = setTimeout(() => { console.error('Minecraft test zaman asimi'); child.kill(); cleanup(); process.exitCode = 1; }, 480000);
    process.once('SIGINT', () => { child.kill(); cleanup(); });
    process.once('SIGTERM', () => { child.kill(); cleanup(); });
  } catch (error) { cleanup(); throw error; }
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { launchArguments, reservePort };
