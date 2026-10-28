'use strict';
const assert = require('node:assert/strict');

const expected = {
    caahr: ['parkurun', 'izleyiciler', 'Seçili haritaya gir', 'B:', 'O:', 'W/S:', 'A/D:', 'Space:'],
    'battle-royale': ['daralan', '300', 'P:', '10 saniye', 'M:', 'Tab:', 'WASD', 'çift Space', 'E:', 'tekrar E:', 'Hedef ölünce'],
    'snow-war': ['kartop', 'katılım savaşı başlatmaz', 'Her tur', 'P tuşuna', '10 saniye', 'yeniden P', 'B:', 'E:', 'tekrar E:', 'Hedef ölünce'],
    vs: ['İki profili', 'taraflara ata', 'BAŞLAT', 'Duraklat / Devam', 'klavye kısayolu yoktur'],
    puanlama: ['ortalamaları', '0 ile 10', 'Göster', 'OYLAMAYI BAŞLAT', 'T yalnızca örnek'],
    orbit: ['küçük rakiplerini yutar', 'beğeni eşiği', 'Oyuna Başla', 'Sol tuşla sürükle', 'tekerlek', 'P:', 'sansürle'],
    'crowd-control': ['boss', 'karakterini etkiler', 'OYUNA BAŞLA', 'WASD', 'ok tuşları', 'sol tuşa basılı tut'],
    'battle-game': ['yaşayan askeri', 'kendi adlarına asker', 'Başlat', 'WASD', 'Shift', 'Space/C', 'E:', 'F:', 'V:'],
    'gelene-gecene': ['Unturned', 'yaratık', 'OYUNA BASLA', 'F1', 'Esc', 'B:', 'Tab:', 'Sol Ctrl', 'Caps Lock', 'T:'],
    'duck-hunt': ['ördekleri vur', 'katılım ayarına göre', 'OYUNA BAŞLA', 'sol tık', 'R:', 'P:', 'Esc:'],
    'pony-life': ['mini oyunda', 'piste girer', 'T tuşuna', 'Başlatma tuşu', 'sürükleyip bırak', 'P:', 'Sağ tuşla'],
    'frog-river': ['kurbağasını', 'ayrı kurbağa oluşturmaz', 'Oyuna gir', 'Bağlanmadan dene', 'WASD:', 'Space:', 'Duraklat'],
    'penalty-kick': ['kaleci modunda', 'yayıncı şutu', 'OYUNA GİR', 'sürükle', 'bırak: şut', 'WASD', 'Space: hızlı test'],
    'tightrope-balance': ['ağırlıkları dengele', 'kavanozlara', '3D OYUNA BAŞLA', 'Space, W', 'basılı', 'E veya C', 'sağ tık'],
    'zombie-war': ['yaratıkları', 'hediye/beğeni/takip', 'Glock 17', 'B:', 'P:', 'sol fare', 'otomatik doldurulur'],
    'minecraft-snake-arena': ['rakip yılanları', '300 kütle', 'Tab', 'O tuşuna', '10 saniye', 'WASD:', 'sağ tık: +10', 'B:', 'P:', 'F:']
};

const sourceEvidence = {
    caahr: ['apps/caaahr-voice/plugin/VoiceDrive.cs', 'apps/caaahr-voice/plugin/RaceMenu.cs', 'apps/caaahr-voice/plugin/CustomTrack.cs'],
    'battle-royale': ['apps/battle-royale/mod/src/main/java/com/tikmng/snowwar/client/ClientEvents.java', 'apps/battle-royale/mod/src/main/java/com/tikmng/snowwar/client/SnowWarClientConfig.java', 'apps/battle-royale/prototype/game-instance/options.txt'],
    'snow-war': ['apps/snow-war/mod/src/main/java/com/tikmng/snowwar/client/ClientEvents.java', 'apps/snow-war/mod/src/main/java/com/tikmng/snowwar/game/SnowWarEngine.java', 'apps/snow-war/prototype/game-instance/options.txt'],
    vs: ['apps/tiktok-vs/public/script.js', 'apps/tiktok-vs/public/index.html', 'apps/tiktok-vs/server.js'],
    puanlama: ['apps/tiktok-vs/public/script.js', 'apps/tiktok-vs/public/index.html', 'apps/tiktok-vs/server.js'],
    orbit: ['apps/mng-orbit/public/app.js', 'apps/mng-orbit/public/index.html'],
    'crowd-control': ['apps/crowd-control/public/app.js', 'apps/crowd-control/public/index.html'],
    'battle-game': ['apps/battle-game/public/main.js', 'apps/battle-game/public/index.html'],
    'gelene-gecene': ['C:/Users/User/.gemini/antigravity/scratch/UnturnedModStudio/UnturnedModEdition.cs'],
    'duck-hunt': ['apps/duck-hunt/public/game.js', 'apps/duck-hunt/public/index.html'],
    'pony-life': ['apps/pony-life/shared/race.js', 'apps/pony-life/server/index.js', 'apps/pony-life/dist/index.html', 'apps/pony-life/dist/assets/index-J1v4Npx_.js'],
    'frog-river': ['apps/frog-river/public/app.js', 'apps/frog-river/public/index.html'],
    'penalty-kick': ['apps/penalty-kick/public/app.js', 'apps/penalty-kick/public/js/gameplay.js', 'apps/penalty-kick/public/index.html'],
    'tightrope-balance': ['apps/tightrope-balance/public/app.js', 'apps/tightrope-balance/public/index.html'],
    'zombie-war': ['apps/snow-war/reference/zombie-war-decompiled/src/com/tikmng/zombiestrike/ClientSettings.java', 'D:/TikMNG-Zombie-War-6.5.17/zombie-war.zip!game-instance/options.txt'],
    'minecraft-snake-arena': ['D:/TikMnG-Snake-Arena-Prototype/mod/src/main/java/com/tikmng/snake/SnakePlayer.java', 'D:/TikMnG-Snake-Arena-Prototype/mod/src/main/java/com/tikmng/snake/SnakeScreens.java', 'D:/TikMnG-Snake-Arena-Prototype/mod/src/main/java/com/tikmng/snake/ArenaEngine.java']
};

const pendingGameRuntimeChecks = [
    'Snow War: E reticle targeting / third-person follow / E exit / target-death exit; separate agent runtime results required.',
    'PUBG: E reticle targeting / third-person follow / E exit / target-death exit; separate agent runtime results required.',
    'PUBG: default 300 participant limit and settings override; separate agent implementation/results required.',
    'Game controls were inspected in local source, not exercised in a real installed game by this UI fixture.',
    'Unturned movement/fire bindings depend on the user controls; their exact keys and the catalog rescue objective were not established from the available mod source.'
];

function assertGameInstructions(game, notes) {
    assert.equal(notes.length, 6, game.id + ' six preparation/instruction sections');
    assert.ok(notes[0].includes(game.requirements || 'Windows 10/11'));
    assert.ok(notes.every(note => note.trim().length > 20));
    assert.ok(notes[2].includes('TikTok'));
    const text = notes.join('\n');
    for (const phrase of expected[game.id] || []) assert.ok(text.toLocaleLowerCase('tr').includes(phrase.toLocaleLowerCase('tr')), game.id + ' missing: ' + phrase);
    assert.ok(expected[game.id], game.id + ' needs individual instruction expectations');
    assert.ok(!text.includes('tuş bilgileri henüz doğrulanmadı'), game.id + ' generic fallback used');
    return { purpose: notes[3], participation: notes[2], start: notes[4], controls: notes[5], sourceEvidence: sourceEvidence[game.id] };
}

module.exports = { assertGameInstructions, sourceEvidence, pendingGameRuntimeChecks };
