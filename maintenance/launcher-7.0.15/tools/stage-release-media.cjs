'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const runFile = promisify(execFile);

const OUTPUT = 'D:/TikMnG-Release-7.0.0-media';
const BASE_URL = 'https://github.com/maNgao7/mng-license-server1/releases/download/media-7.0.0/';
const SOURCES = [
    { id: 'archive-20261021', root: 'D:/TikMNG-Medya-Arsivi-2026-10-21' },
    { id: 'new-videos-20261023', root: 'D:/TikMnG-Yeni-Videolar-2026-10-23' },
    { id: 'viral-sounds-20261023', root: 'D:/TikMnG-Viral-Sesler-2026-10-23' },
    { id: 'extra-sounds-20261023', root: 'D:/TikMnG-Viral-Sesler-Ek-2026-10-23' }
];
const PROVENANCE_FIELDS = [
    'sourcePage', 'sourceFileTitle', 'sourceDownloadUrl', 'sourceDownloadPageUrl',
    'downloadUrl', 'resolvedDownloadUrl', 'publicPreviewUrl', 'sourceName',
    'author', 'publisher', 'originalTitle', 'turkishTitle', 'sourceTermsUrl',
    'downloadPermission', 'license', 'licenseUrl', 'licenseTermsUrl', 'licenseKnown',
    'commercialRedistributionCleared', 'commercialRightsCleared', 'intendedUse',
    'attribution', 'attributionRequired', 'shareAlikeRequired', 'changes', 'licenseLimits'
];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');

async function hashFile(file) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

function within(root, file) {
    const relative = path.relative(root, file);
    return relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}

function inferMedia(probe) {
    const streams = probe.streams || [];
    const video = streams.some(s => s.codec_type === 'video' && !Number(s.disposition?.attached_pic || 0));
    const audio = streams.some(s => s.codec_type === 'audio');
    assert(video || audio, 'No audio or moving-video stream found');
    const kind = video ? 'video' : 'audio';
    const formats = String(probe.format?.format_name || '').split(',');
    let extension, mime;
    if (formats.includes('mp3') && !video) [extension, mime] = ['.mp3', 'audio/mpeg'];
    else if (formats.includes('wav') && !video) [extension, mime] = ['.wav', 'audio/wav'];
    else if (formats.includes('ogg')) [extension, mime] = [video ? '.ogv' : '.ogg', kind + '/ogg'];
    else if (formats.includes('webm')) [extension, mime] = ['.webm', kind + '/webm'];
    else if (formats.includes('mp4') || formats.includes('mov')) [extension, mime] = [video ? '.mp4' : '.m4a', kind + '/mp4'];
    else throw new Error('Unsupported detected media container: ' + formats.join(','));
    const duration = Number(probe.format?.duration);
    return { kind, mime, extension, durationSeconds: Number.isFinite(duration) ? duration : null };
}

function chooseLabel(rows) {
    const clarity = row => {
        const title = row.title.trim();
        const stem = path.posix.basename(row.relativePath, path.posix.extname(row.relativePath));
        return Number(title !== stem) + Number(!/^(?:video|audio|clip|sound|untitled|\d+)$/i.test(title));
    };
    return [...rows].sort((a, b) => clarity(b) - clarity(a)
        || compare(a.title, b.title) || compare(a.category, b.category)
        || compare(a.sourceId, b.sourceId) || compare(a.relativePath, b.relativePath))[0];
}

async function readSources() {
    const rows = [], sources = [], notices = [];
    for (const source of SOURCES) {
        const root = await fsp.realpath(source.root);
        const manifestFile = path.join(root, 'manifest.json');
        const raw = await fsp.readFile(manifestFile);
        const entries = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
        assert(Array.isArray(entries), 'Expected manifest array: ' + manifestFile);
        sources.push({ id: source.id, archiveName: path.basename(root), manifestSha256: sha256(raw),
            rowCount: entries.length, declaredBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0) });
        for (const [index, entry] of entries.entries()) {
            const relative = entry.relativePath;
            assert(typeof relative === 'string' && !/[\\:\x00]/.test(relative)
                && relative.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe source path');
            assert(typeof entry.title === 'string' && entry.title.trim()
                && typeof entry.category === 'string' && entry.category.trim(), 'Missing title/category');
            assert(/^[a-f0-9]{64}$/i.test(entry.sha256) && Number.isSafeInteger(entry.bytes) && entry.bytes > 0,
                'Invalid declared hash/bytes: ' + relative);
            const file = await fsp.realpath(path.resolve(root, relative));
            assert(within(root, file), 'Source escapes archive root: ' + relative);
            const stat = await fsp.stat(file);
            assert(stat.isFile() && stat.size === entry.bytes, 'Source size mismatch: ' + relative);
            assert(await hashFile(file) === entry.sha256.toLowerCase(), 'Source SHA-256 mismatch: ' + relative);
            rows.push({ sourceId: source.id, sourceRow: index + 1, originalId: entry.id ?? null,
                relativePath: relative, file, title: entry.title, category: entry.category,
                sha256: entry.sha256.toLowerCase(), bytes: stat.size,
                provenance: Object.fromEntries(PROVENANCE_FIELDS.filter(key => Object.hasOwn(entry, key))
                    .map(key => [key, entry[key]])) });
        }
        const documents = source.id === 'new-videos-20261023' ? ['ATTRIBUTIONS.md']
            : source.id === 'extra-sounds-20261023' ? ['combined-verification.json'] : [];
        for (const name of documents) {
            const bytes = await fsp.readFile(path.join(root, name));
            const content = name.endsWith('.json') ? JSON.parse(bytes.toString('utf8')) : bytes.toString('utf8');
            notices.push({ sourceId: source.id, file: name, sha256: sha256(bytes), recordedContent: content });
        }
    }
    return { rows, sources, notices };
}

async function pool(values, work, concurrency = 4) {
    const result = new Array(values.length);
    let next = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
        while (next < values.length) {
            const index = next++;
            result[index] = await work(values[index], index);
        }
    }));
    return result;
}

async function sameOrAbsent(file, bytes, expectedHash) {
    let stat;
    try { stat = await fsp.lstat(file); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    assert(stat.isFile() && !stat.isSymbolicLink(), 'Existing output is not an ordinary file: ' + file);
    assert(stat.size === bytes && await hashFile(file) === expectedHash,
        'Existing output differs; preserved without overwriting: ' + file);
    return true;
}

async function verifyOutput(output) {
    const manifest = JSON.parse(await fsp.readFile(path.join(output, 'manifest.json'), 'utf8'));
    const expected = new Set(['manifest.json', 'upload-files.txt', ...manifest.media.map(item => item.filename)]);
    const existing = await fsp.readdir(output);
    assert(existing.length === expected.size && existing.every(name => expected.has(name)), 'Unexpected staging contents');
    const hashes = new Set(), ids = new Set();
    let bytes = 0;
    for (const item of manifest.media) {
        assert(!hashes.has(item.sha256) && !ids.has(item.id), 'Duplicate catalog hash or ID');
        hashes.add(item.sha256); ids.add(item.id);
        assert(/^[a-f0-9]{64}\.[a-z0-9]+$/.test(item.filename), 'Unsafe upload filename');
        assert(item.filename.startsWith(item.sha256 + '.') && item.url === BASE_URL + item.filename, 'Invalid filename/URL mapping');
        assert(await sameOrAbsent(path.join(output, item.filename), item.bytes, item.sha256), 'Missing staged media');
        bytes += item.bytes;
    }
    const upload = await fsp.readFile(path.join(output, 'upload-files.txt'), 'utf8');
    assert(upload === [...manifest.media.map(item => item.filename), 'manifest.json'].join('\n') + '\n', 'Upload list mismatch');
    assert(bytes === manifest.summary.mediaBytes && manifest.media.length === manifest.summary.distinctFiles, 'Aggregate mismatch');
    assert(manifest.media.reduce((sum, item) => sum + item.origins.length, 0) === manifest.summary.sourceRows, 'Source map incomplete');
    return { verified: true, output, sourceRows: manifest.summary.sourceRows, mediaFiles: manifest.media.length,
        mediaBytes: bytes, videoFiles: manifest.media.filter(item => item.kind === 'video').length,
        audioFiles: manifest.media.filter(item => item.kind === 'audio').length,
        totalStagingFiles: existing.length, published: false };
}

async function main() {
    if (process.argv.includes('--verify')) return console.log(JSON.stringify(await verifyOutput(OUTPUT), null, 2));
    const { rows, sources, notices } = await readSources();
    const groups = new Map();
    for (const row of rows) {
        if (!groups.has(row.sha256)) groups.set(row.sha256, []);
        groups.get(row.sha256).push(row);
    }
    assert(rows.length === 346 && groups.size === 285, 'Source inventory changed; review expected 346 rows / 285 distinct hashes');
    console.log('Verified 346 source rows. Probing 285 distinct files.');
    const hashes = [...groups.keys()].sort(compare);
    const media = await pool(hashes, async hash => {
        const origins = groups.get(hash).sort((a, b) => compare(a.sourceId, b.sourceId) || a.sourceRow - b.sourceRow);
        const selected = chooseLabel(origins);
        const { stdout, stderr } = await runFile(process.env.FFPROBE || 'ffprobe', [
            '-v', 'error', '-show_entries', 'stream=codec_type,codec_name:stream_disposition=attached_pic:format=format_name,duration',
            '-of', 'json', selected.file
        ], { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
        const detected = inferMedia(JSON.parse(stdout));
        const filename = hash + detected.extension;
        const labels = [...new Map(origins.map(row => [JSON.stringify([row.title, row.category]),
            { title: row.title, category: row.category }])).values()];
        return { id: 'media-' + hash.slice(0, 24), title: selected.title, category: selected.category,
            sha256: hash, bytes: selected.bytes, filename, url: BASE_URL + filename,
            kind: detected.kind, mime: detected.mime, durationSeconds: detected.durationSeconds,
            probeReportedDiagnostics: Boolean(stderr.trim()),
            alternateLabels: labels.filter(label => label.title !== selected.title || label.category !== selected.category),
            origins: origins.map(({ file, sha256, bytes, ...origin }) => origin) };
    });
    assert(new Set(media.map(item => item.id)).size === media.length, 'ID prefix collision');
    const summary = { sourceRows: rows.length, distinctFiles: media.length, deduplicatedRows: rows.length - media.length,
        sourceBytes: rows.reduce((sum, row) => sum + row.bytes, 0), mediaBytes: media.reduce((sum, item) => sum + item.bytes, 0),
        videoFiles: media.filter(item => item.kind === 'video').length, audioFiles: media.filter(item => item.kind === 'audio').length,
        alternateLabelAssets: media.filter(item => item.alternateLabels.length).length,
        explicitlyUnclearedSourceRows: rows.filter(row => row.provenance.commercialRedistributionCleared === false
            || row.provenance.commercialRightsCleared === false).length };
    assert(summary.mediaBytes === 693684608, 'Unique source bytes changed; review before staging');
    const manifest = { schemaVersion: 1, version: '7.0.0', tag: 'media-7.0.0', plannedBaseUrl: BASE_URL,
        publicationStatus: 'staged-unpublished', rightsAssessment: 'Not performed; existing source notices retained without clearance claims.',
        deduplication: 'One catalog row and one file per SHA-256; exact Turkish labels retained; every source row mapped in origins.',
        selectionPolicy: 'Prefer a descriptive title over a filename/generic label; code-point and source-key tie-breaks.',
        verification: 'Every source row checked against bytes/SHA-256; distinct media stream-probed; copied files rehashed. No full decode or rights review.',
        summary, sources, sourceNotices: notices, media };
    const manifestBytes = json(manifest);
    const uploadBytes = Buffer.from([...media.map(item => item.filename), 'manifest.json'].join('\n') + '\n', 'utf8');
    await fsp.mkdir(OUTPUT, { recursive: true });
    const expected = new Set(['manifest.json', 'upload-files.txt', ...media.map(item => item.filename)]);
    assert((await fsp.readdir(OUTPUT)).every(name => expected.has(name)), 'Unrecognized existing staging files preserved; review output');
    // Check all existing targets before adding anything; never replace files on reruns.
    for (const item of media) await sameOrAbsent(path.join(OUTPUT, item.filename), item.bytes, item.sha256);
    for (const [name, bytes] of [['manifest.json', manifestBytes], ['upload-files.txt', uploadBytes]]) {
        await sameOrAbsent(path.join(OUTPUT, name), bytes.length, sha256(bytes));
    }
    let copied = 0;
    for (const item of media) {
        const target = path.join(OUTPUT, item.filename);
        if (!await sameOrAbsent(target, item.bytes, item.sha256)) {
            await fsp.copyFile(chooseLabel(groups.get(item.sha256)).file, target, fs.constants.COPYFILE_EXCL);
            copied++;
        }
    }
    for (const source of sources) {
        const root = SOURCES.find(item => item.id === source.id).root;
        assert(await hashFile(path.join(root, 'manifest.json')) === source.manifestSha256, 'Source manifest changed during staging');
    }
    for (const [name, bytes] of [['manifest.json', manifestBytes], ['upload-files.txt', uploadBytes]]) {
        if (!await sameOrAbsent(path.join(OUTPUT, name), bytes.length, sha256(bytes))) {
            await fsp.writeFile(path.join(OUTPUT, name), bytes, { flag: 'wx' });
        }
    }
    console.log(JSON.stringify({ ...await verifyOutput(OUTPUT), copied, deduplicatedRows: summary.deduplicatedRows,
        explicitlyUnclearedSourceRows: summary.explicitlyUnclearedSourceRows }, null, 2));
}

module.exports = { chooseLabel, inferMedia, verifyOutput };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
