const fs = require('node:fs');
const path = require('node:path');

const rate = 22050;
const output = path.join(__dirname, '..', 'mod', 'src', 'main', 'resources', 'assets', 'mng_snow_war', 'sounds');
fs.mkdirSync(output, { recursive: true });

function wav(file, seconds, sample) {
  const count = Math.round(seconds * rate);
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample(i / rate))) * 32767), 44 + i * 2);
  fs.writeFileSync(path.join(output, file + '.wav'), bytes);
}

// christmas.ogg is a downloaded piano performance, not a generated sound.
// Keep it intact when regenerating wind. Source, rights, and checksum are in
// assets/mng_snow_war/sounds/AUDIO-PROVENANCE.md beside the recording.
console.log('Christmas recording preserved; generating wind.wav only.');

let noise = 7;
const wind = new Float32Array(rate * 8);
let low = 0;
for (let i = 0; i < wind.length; i++) {
  noise = (noise * 1664525 + 1013904223) >>> 0;
  low = low * .992 + ((noise / 0xffffffff) * 2 - 1) * .008;
  wind[i] = low * (.25 + .12 * Math.sin(i / rate * Math.PI / 4));
}
wav('wind', 8, time => wind[Math.min(wind.length - 1, Math.floor(time * rate))]);
