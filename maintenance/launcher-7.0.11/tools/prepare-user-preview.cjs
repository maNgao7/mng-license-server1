'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const Store = require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/electron-store');
const root = 'D:/TikMnG-Update-QA-20261030', profile = path.join(root, 'admin-preview-profile');
const source = path.join(process.env.APPDATA, 'TikMnG-Test-6.5.17/mng-config.json');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = digest(source);
fs.mkdirSync(profile, { recursive: true });
if (!fs.existsSync(path.join(profile, 'mng-config.json'))) {
    fs.copyFileSync(source, path.join(profile, 'mng-config.json'));
    const store = new Store({ cwd: profile, name: 'mng-config', encryptionKey: 'mng-electron-secret-key-2024' });
    for (const [key, value] of Object.entries({ preview_initialized_v1: true, library_root_v1: path.join(root, 'admin-preview-games'),
        library_previous_paths_v1: {}, media_root_v1: path.join(root, 'admin-preview-media'),
        entry_video_root_v1: path.join(root, 'admin-preview-entry'), chatterbox_root_v1: path.join(root, 'admin-preview-voices'),
        media_studio_v1: { version: 1, items: [] }, entry_videos_v1: { version: 2, rules: [], sessions: {} },
        media_background_downloads_enabled: false, tiktok_active_account: '', tiktok_accounts: [],
        overlay_installation_v1: crypto.randomBytes(16).toString('hex') })) store.set(key, value);
    store.delete('widget_access_key');
}
if (digest(source) !== before) throw new Error('Original administrator settings changed');
console.log(JSON.stringify({ profile, originalUntouched: true, port: 31987 }));
