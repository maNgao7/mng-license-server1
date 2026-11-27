'use strict';

const hiddenConcepts = new Set(['coinring', 'followsteps', 'sharebridge', 'giftthermometer', 'hypewave', 'communitywall', 'giftmeteor', 'giftreceipt', 'combocounter', 'combotower', 'likegauge', 'likeorbit', 'likecards', 'likebloom', 'memberportal', 'memberticket', 'firstarrival', 'sharecomet', 'sharewave', 'submarquee', 'subseal', 'subconstellation', 'goalodometer', 'communityquest', 'chatspotlight', 'chatpoll', 'keywordrace', 'hypereactor', 'hypeequalizer', 'giftpusher']);
const retiredPK = new Set(['platinum', 'rainbow']);
const pkMotifs = [
    ['gloves', 'Boks Eldivenleri', 'bottom', 'top', 'glove'],
    ['dragon', 'Ejderha', 'left', 'right', 'multiplier'],
    ['wolf', 'Kurt', 'top', 'bottom', 'multiplier'],
    ['lion', 'Aslan', 'right', 'left', 'multiplier'],
    ['serpent', 'Yilan', 'bottom', 'left', 'multiplier'],
    ['floral', 'Cicek Taclari', 'top', 'right', 'multiplier'],
    ['flame', 'Ates', 'left', 'top', 'multiplier'],
    ['crystal', 'Kristal', 'right', 'bottom', 'multiplier'],
    ['rainbow', 'Gokkusagi', 'bottom', 'right', 'multiplier'],
    ['platinum', 'Platin', 'top', 'left', 'multiplier'],
    ['butterfly', 'Mavi Kelebek', 'bottom', 'top', 'both'],
    ['turtle', 'Deniz Kaplumbagasi', 'bottom', 'top', 'both'],
    ['rabbit', 'Kar Tavsani', 'bottom', 'top', 'both'],
    ['floral-rose', 'Gul Bahcesi', 'bottom', 'top', 'both'],
    ['floral-lotus', 'Lotus Cicegi', 'bottom', 'top', 'both']
];
const entrances = [['bottom', 'Alttan'], ['top', 'Ustten'], ['left', 'Soldan'], ['right', 'Sagdan'], ['burst', 'Ortadan']];
const pkScenes = pkMotifs.map(([motif, label, entrance, _second, notification]) => ({
    id: `pk-${motif}`, baseId: 'pkhub', name: label,
    category: 'pk', catalogHidden: retiredPK.has(motif), defaults: { motif, entrance: 'bottom', notification: 'both', profileLayout: 'split', portraitStyle: 'cloud' }
}));
// Published directional links remain valid, but are no longer separate catalog designs.
const legacyPKScenes = pkMotifs.flatMap(([motif, label, first, second, notification]) => [first, second].map(entrance => ({
    id: `pk-${motif}-${entrance}`, baseId: 'pkhub', name: `${label} / ${entrances.find(([id]) => id === entrance)[1]}`,
    category: 'pk', catalogHidden: true, defaults: { motif, entrance, notification, profileLayout: 'split', portraitStyle: 'cloud' }
})));
const effectScenes = [
    ['effect-fountain', 'likefountain', 'Kalp Fiskiesi', 'fountain'],
    ['effect-rain', 'likefountain', 'Kalp Yagmuru', 'rain'],
    ['effect-spiral', 'likefountain', 'Kalp Sarmali', 'spiral'],
    ['effect-wings', 'likefountain', 'Kalp Kanatlari', 'wings'],
    ['effect-burst', 'likefountain', 'Kalp Patlamasi', 'burst'],
    ['effect-trail', 'likefountain', 'Kalp Izleri', 'trail'],
    ['effect-aura', 'likefountain', 'Kalp Halesi', 'aura'],
    ['effect-sweep', 'likefountain', 'Kalp Gecidi', 'sweep'],
    ['effect-double-spiral', 'likefountain', 'Cift Kalp Sarmali', 'double-spiral'],
    ['effect-heartstorm', 'likefountain', 'Kalp Firtinasi', 'heartstorm'],
    ['effect-confetti', 'firework', 'Hediye Konfetisi', 'confetti'],
    ['effect-coin-rain', 'coindrop', 'Altin Coin Yagmuru', 'coin-rain'],
    ['effect-coin-vortex', 'coindrop', 'Coin Girdabi', 'coin-vortex'],
    ['effect-firework', 'firework', 'Hediye Havai Fisekleri', 'firework']
].map(([id, baseId, name, effectStyle]) => ({ id, baseId, name, category: 'effects', defaults: { effectStyle } }));
const chatScenes = ['whatsapp', 'instagram', 'telegram', 'snapchat', 'tiktok'].map(chatTheme => ({
    id: `chat-${chatTheme}`, baseId: 'chatbubble', name: `${chatTheme[0].toUpperCase()}${chatTheme.slice(1)} Sohbeti`,
    category: 'chat', defaults: { chatTheme }
}));
const jarScenes = [
    ['classic', 'Klasik Cam Kavanoz', '#b7edf2', 'none'],
    ['bell', 'Cam Fanus', '#dcf2ff', 'none'],
    ['lantern', 'Fener Kavanoz', '#f7d9a0', 'none'],
    ['cat', 'Pofuduk Kedi Kavanozu', '#f2c5d8', 'cat'],
    ['bear', 'Yumusak Ayi Kavanozu', '#c5e6c9', 'bear'],
    ['butterfly', 'Kelebek Kavanozu', '#c5d4ff', 'butterfly'],
    ['duck', 'Yavru Ordek Kavanozu', '#ffe19a', 'duck'],
    ['chicken', 'Yumurtlayan Tavuk Kavanozu', '#f6d6af', 'chicken']
].map(([jarStyle, name, jarTint, jarMascot]) => ({ id: `jar-${jarStyle}`, baseId: 'coinjar', name, category: 'jars', defaults: { jarStyle: ({cat:'classic',bear:'bell',butterfly:'crystal',duck:'flask',chicken:'lantern'})[jarStyle] || jarStyle, jarTint, jarMascot } }));
const legacyJarScenes = [['flask', 'Cam Balon Kavanoz', '#f2c5d8'], ['urn', 'Vazo Kavanoz', '#c5e6c9'], ['crystal', 'Kristal Kavanoz', '#c5d4ff']]
    .map(([jarStyle, name, jarTint]) => ({ id: `jar-${jarStyle}`, baseId: 'coinjar', name, category: 'jars', catalogHidden: true, defaults: { jarStyle, jarTint, jarMascot: 'none' } }));
const notificationScenes = require('./portrait-frames.cjs').frames.map(frame => ({
    id: `notification-${frame.id}`, baseId: 'myactions', name: `${frame.name} Bildirimi`, category: 'portraits', defaults: { portraitFrame: frame.id }
}));
const unboxScenes = [['reel', 'Hediye Ruleti'], ['case', 'Kasa Acilisi'], ['pack', 'Kart Paketi Acilisi']].map(([unboxStyle, name]) => ({ id: `gift-open-${unboxStyle}`, baseId: 'giftunbox', name, category: 'Hediye', defaults: { unboxStyle } }));
const choice = (key, label, value, options) => ({ key, label, value, options, type: 'select', hidden: true });
const visualFields = new Set(['theme', 'motif', 'effectStyle', 'chatTheme', 'portraitFrame', 'frameStyle', 'jarStyle', 'jarMascot']);
const baseStateKeys = { pkhub: [], topgift: ['topGift'], coinjar: ['activities', 'jarGifts', 'stats'], myactions: ['activities'], likefountain: ['activities'], coindrop: ['activities'], firework: ['activities'] };

function createSceneCatalog(definitions) {
    const bases = new Map(definitions.filter(item => !item.baseId).map(item => [item.id, item]));
    const specs = [...pkScenes, ...legacyPKScenes, ...effectScenes.map(scene => ({ ...scene, catalogHidden: scene.id === 'effect-coin-vortex' })), ...chatScenes, ...jarScenes, ...legacyJarScenes, ...notificationScenes, ...unboxScenes];
    for (const base of bases.values()) {
        if (hiddenConcepts.has(base.id) || specs.some(item => item.baseId === base.id)) continue;
        // Palette changes stay inside the existing design; only real visual assets become scenes.
        for (const key of ['portraitFrame', 'frameStyle']) {
            const visual = base.fields.find(item => item.key === key);
            if (visual) for (const [value, label] of visual.options) specs.push({ id: `${base.id}-frame-${value}`, baseId: base.id, name: `${base.name} / ${label}`, defaults: { [key]: value } });
        }
    }
    const catalog = specs.map(spec => {
        const base = bases.get(spec.baseId);
        if (!base) throw new RangeError('Missing scene engine: ' + spec.baseId);
        const defaults = { ...spec.defaults };
        const extra = spec.baseId === 'pkhub' ? [
            choice('motif', 'Motif', defaults.motif, pkMotifs.map(([id, label]) => [id, label])),
            { ...choice('entrance', 'Animasyonun gelis yonu', defaults.entrance, entrances), hidden: false },
            { ...choice('notification', 'Bildirim turu', defaults.notification, [['glove', 'Eldiven'], ['multiplier', 'Carpan'], ['both', 'Eldiven ve carpan']]), hidden: false },
            { ...choice('profileLayout', 'Profillerin konumu', defaults.profileLayout, [['split', 'Sol ve sag'], ['corners', 'Yayin ekranlarinin koseleri'], ['center', 'Ortada'], ['left', 'Solda'], ['right', 'Sagda']]), hidden: false },
            { ...choice('portraitStyle', 'Profil cercevesi', defaults.portraitStyle, [['auto', 'Tasarima ozel'], ['cloud', 'Bulut'], ['metal', 'Metal'], ['floral', 'Cicek']]), hidden: false }
        ] : spec.defaults.effectStyle ? [choice('effectStyle', 'Efekt', defaults.effectStyle, effectScenes.map(item => [item.defaults.effectStyle, item.name]))]
            : spec.defaults.chatTheme ? [choice('chatTheme', 'Sohbet', defaults.chatTheme, chatScenes.map(item => [item.defaults.chatTheme, item.name]))]
                : spec.defaults.jarTint ? [choice('jarStyle', 'Kavanoz', defaults.jarStyle, [['classic', 'Klasik cam'], ['flask', 'Cam balon'], ['urn', 'Vazo'], ['crystal', 'Kristal'], ['bell', 'Cam fanus'], ['lantern', 'Fener']])]
                    : spec.defaults.unboxStyle ? [choice('unboxStyle', 'Acilis', defaults.unboxStyle, unboxScenes.map(item => [item.defaults.unboxStyle, item.name]))] : [];
        const fields = structuredClone(base.fields).map(field => ({ ...field, ...(visualFields.has(field.key) ? { hidden: true } : {}), ...(Object.hasOwn(defaults, field.key) ? { value: defaults[field.key] } : {}) }));
        for (const field of extra) {
            const index = fields.findIndex(item => item.key === field.key);
            if (index < 0) fields.push(field);else fields[index] = field;
        }
        // Frame notifications own a single scene slot, independent of the legacy eight screens.
        if (spec.baseId === 'myactions') fields.find(field => field.key === 'screen').hidden = true;
        return { ...structuredClone(base), ...spec, category: spec.category || base.category, preset: false, scenePreset: true, catalogHidden: spec.catalogHidden === true,
            stateKeys: structuredClone(base.stateKeys || baseStateKeys[base.id] || []),
            eventTypes: structuredClone(base.eventTypes || [base.id === 'likefountain' ? 'like' : 'gift']),
            defaults, fields };
    });
    const replaced = new Set(catalog.map(item => item.baseId));
    for (const definition of definitions) {
        if (definition.id === 'pk' || hiddenConcepts.has(definition.baseId || definition.id) || replaced.has(definition.id)) definition.catalogHidden = true;
        if (['activityrail', 'socialticker', 'broadcaststrip'].includes(definition.baseId || definition.id)) definition.category = 'flow';
        for (const field of definition.fields) if (visualFields.has(field.key)) field.hidden = true;
    }
    return catalog;
}
module.exports = { createSceneCatalog, pkScenes, legacyPKScenes, effectScenes, chatScenes, jarScenes, legacyJarScenes, notificationScenes, unboxScenes, hiddenConcepts };
