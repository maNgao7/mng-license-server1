import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const appsRoot = process.env.MNG_PACKAGED_APPS
  ? resolve(process.env.MNG_PACKAGED_APPS)
  : existsSync(resolve("dist", "win-unpacked", "resources", "apps"))
    ? resolve("dist", "win-unpacked", "resources", "apps")
    : resolve("..", "release-v6.5.9", "staging");
const games = [
  { id: "tightrope-balance", entry: "server.js", port: 45380, env: { PORT: "45380" } },
  { id: "mng-orbit", entry: "server.js", port: 45180, env: { PORT: "45180" } },
  { id: "pony-life", entry: join("server", "index.js"), port: 45190, env: { PONY_PORT: "45190", PONY_WIDGET_PORT: "45191" } },
  { id: "frog-river", entry: "server.js", port: 45275, env: { FROG_PORT: "45275" } },
  { id: "penalty-kick", entry: "server.js", port: 45350, env: { PORT: "45350" } },
  { id: "duck-hunt", entry: "server.js", port: 45340, env: { PORT: "45340" } },
  { id: "battle-game", entry: "server.js", port: 45330, env: { PORT: "45330" } }
];

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));

async function waitForHealth(port, child) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`sunucu erken kapandı (${child.exitCode})`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return response.json().catch(() => ({}));
    } catch {}
    await sleep(250);
  }
  throw new Error("20 saniyede sağlık yanıtı vermedi");
}

let tested = 0;
for (const game of games) {
  const cwd = join(appsRoot, game.id);
  const entry = join(cwd, game.entry);
  if (!existsSync(entry)) {
    console.log(`SKIP ${game.id}: bu sürüm paketinde değişmedi`);
    continue;
  }

  const child = spawn(process.execPath, [entry], {
    cwd,
    env: { ...process.env, ...game.env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let errors = "";
  child.stderr.on("data", chunk => { errors += chunk.toString(); });

  try {
    const health = await waitForHealth(game.port, child);
    tested++;
    console.log(`OK ${game.id}`, health.status || health.ok || "ready");
  } catch (error) {
    throw new Error(`${game.id}: ${error.message}\n${errors.trim()}`);
  } finally {
    child.kill();
    await sleep(150);
  }
}

if (!tested) throw new Error("Test edilecek güncel oyun paketi bulunamadı.");
console.log(`${tested} güncel oyun paketinin sunucusu çalışıyor.`);
