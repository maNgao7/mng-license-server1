import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { LiveSession } from './live-session.js';
import { fixtureSession, emitGift, emitLike, follow } from './proto-fixtures.js';

const require = createRequire(import.meta.url);
const root = path.resolve(process.argv[2]);
const { launchArguments } = require(path.join(root, 'launch-game.cjs'));
const sockets = new Set();
let live, connection;
const server = http.createServer(async (req, res) => {
  console.log('CHECK_HTTP', req.method, req.url);
  const reply = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (req.url === '/health') return reply({ version: '9', ...live?.snapshot() });
  if (req.url === '/disconnect') { live?.disconnect(); return reply({ ok: true }); }
  if (req.url === '/connect') {
    let body = ''; for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    const h = await fixtureSession();
    connection = h.connection;
    h.session.disconnect();
    live = new LiveSession(() => connection, [['gift', 'gift'], ['like', 'like'], ['follow', 'follow']], event => {
      for (const ws of sockets) if (ws.readyState === 1) {
        ws.send(JSON.stringify(event));
        // Deliberately replay the local transport too; Java must reject it.
        if (event.type !== 'status') ws.send(JSON.stringify(event));
      }
    });
    await live.connect(payload.username, payload.session);
    return reply({ ok: true });
  }
  if (!req.url.startsWith('/fixture/') || !connection) return reply({}, 404);
  const key = req.url.slice('/fixture/'.length);
  async function oneGift(id, group, viewer) {
    await emitGift(connection, id, group, 1, false, group + '1', viewer);
    await emitGift(connection, id, group, 1, true, group + '2', viewer);
    await emitGift(connection, id, group, 1, true, group + '3', viewer);
  }
  if (key === 'rose') await oneGift('5655', '101', 'rose_viewer');
  if (key === 'rose-again') await oneGift('5655', '102', 'rose_viewer');
  if (key === 'blue') await oneGift('5319', '103', 'blue_viewer');
  if (key === 'likes99') await emitLike(connection, 99, 999);
  if (key === 'likes1') await emitLike(connection, 1, 1000);
  if (key === 'likes100') { await emitLike(connection, 100, 1100); await emitLike(connection, 100, 1100); }
  if (key === 'likes300') await emitLike(connection, 300, 1400);
  if (key === 'follow') { connection.emit('follow', follow('801')); connection.emit('follow', follow('802')); }
  if (key === 'spider') await oneGift('5994', '104', 'spider_viewer');
  reply({ ok: true });
});
const wss = new WebSocketServer({ server, path: '/events' });
wss.on('connection', ws => { sockets.add(ws); ws.on('close', () => sockets.delete(ws)); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const args = ['-Dmng.verify.live=true', ...launchArguments(port)];
const argumentFile = path.join(root, 'game-instance', 'verify-args.txt');
fs.writeFileSync(argumentFile, args.map(v => '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join('\n'));
const child = spawn(path.join(root, 'runtime/java/bin/java.exe'), ['@' + argumentFile], { cwd: path.join(root, 'game-instance'), windowsHide: true });
const log = fs.createWriteStream(path.join(root, 'game-instance', 'live-verification.log'));
let passed = false;
const timer = setTimeout(() => { console.error('Live check timed out'); child.kill(); }, 180000);
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
  log.write(chunk);
  const data = String(chunk);
  if (/MNG_LIVE_CHECKS_PASSED/.test(data)) passed = true;
  for (const line of data.split('\n')) if (/MNG_LIVE_CHECK|MNG live apply|logged in with entity/.test(line)) console.log(line);
});
child.on('exit', () => {
  clearTimeout(timer); log.end();
  for (const ws of sockets) ws.terminate();
  wss.close(); server.close();
  process.exitCode = passed ? 0 : 1;
});
