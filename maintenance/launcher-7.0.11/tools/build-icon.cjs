const { nativeImage, app } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  const source = path.join(__dirname, '..', 'renderer', 'assets', 'logo-v2.png');
  const output = path.join(__dirname, '..', 'renderer', 'assets', 'icon-v2.ico');
  const sizes = [256, 128, 64, 48, 32, 16];
  const images = sizes.map(size => nativeImage.createFromPath(source).resize({ width: size, height: size, quality: 'best' }).toPNG());
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((png, index) => {
    const size = sizes[index];
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  fs.writeFileSync(output, Buffer.concat([header, ...images]));
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
