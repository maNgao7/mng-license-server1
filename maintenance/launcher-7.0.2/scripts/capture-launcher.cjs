const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  await win.webContents.executeJavaScript(`
    document.getElementById('launcher').style.display='flex';
    document.getElementById('licensePage').style.display='none';
    document.getElementById('loadingOverlay').style.display='none';
  `);
  await new Promise(resolve => setTimeout(resolve, 900));
  const image = await win.webContents.capturePage();
  const output = path.join(__dirname, "..", "dist", "launcher-6.5.10-preview.png");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, image.toPNG());
  console.log(output);
  app.quit();
});
