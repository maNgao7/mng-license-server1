'use strict';
const fs = require('node:fs');
const path = require('node:path');

function preparePreviewProfile(app, resourcesPath, args = process.argv) {
    const enabled = args.includes('--tikmng-preview') || fs.existsSync(path.join(resourcesPath || '', 'tikmng-preview.json'));
    if (!enabled) return { enabled: false };
    const stable = path.join(app.getPath('appData'), 'mng-tiktok-game');
    const root = path.join(app.getPath('appData'), 'TikMnG-Test-6.5.17');
    fs.mkdirSync(root, { recursive: true });
    const destination = path.join(root, 'mng-config.json');
    const original = path.join(stable, 'mng-config.json');
    // Seed the private test profile once; never write to the stable profile.
    if (!fs.existsSync(destination) && fs.existsSync(original)) fs.copyFileSync(original, destination, fs.constants.COPYFILE_EXCL);
    app.setName('TikMnG Test');
    for (const [name, directory] of [['userData', root], ['documents', path.join(root, 'Documents')], ['videos', path.join(root, 'Videos')]]) {
        fs.mkdirSync(directory, { recursive: true });
        app.setPath(name, directory);
    }
    return { enabled: true, root, stable };
}

function initializePreviewStore(store, preview) {
    if (!preview.enabled || store.get('preview_initialized_v1', false)) return;
    store.set('library_root_v1', path.join(preview.root, 'games'));
    store.set('library_previous_paths_v1', {});
    store.set('media_root_v1', fs.existsSync('D:/') ? 'D:/TikMnG-Test-Medya' : path.join(preview.root, 'Media'));
    store.set('media_studio_v1', { version: 1, items: [] });
    store.delete('widget_access_key');
    store.set('preview_initialized_v1', true);
}

module.exports = { preparePreviewProfile, initializePreviewStore };
