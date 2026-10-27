'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {isDeepStrictEqual} = require('node:util');
const presets = {
    'snow-war': ['mng_snow_war', 'mng-snow-war.json', 'snow-war.json', 16],
    'battle-royale': ['mng_battle_royale', 'mng-battle-royale.json', 'battle-royale.json', 10]
};

function standardRules(id) {
    const [namespace,, resource, count] = presets[id] || [];
    if (!namespace) throw new Error('Unsupported game: ' + id);
    const file = path.join(__dirname, id, 'mod/src/main/resources/assets', namespace, 'defaults', resource);
    const rules = JSON.parse(fs.readFileSync(file, 'utf8')).giftRules;
    if (rules.length !== count || new Set(rules.map(r=>r.giftId)).size !== count)
        throw new Error('Invalid standard gift preset');
    return rules;
}

function applyProfile(id, file, {apply = false} = {}) {
    file = path.resolve(file);
    if (path.basename(file) !== presets[id]?.[1]) throw new Error('Unexpected configuration filename');
    const before = fs.readFileSync(file);
    const config = JSON.parse(before.toString('utf8').replace(/^\uFEFF/, ''));
    if (!config || Array.isArray(config) || typeof config !== 'object') throw new Error('Invalid config object');
    const rules = standardRules(id);
    const result = {id, file, rules:rules.length, changed:!isDeepStrictEqual(config.giftRules, rules), applied:false};
    if (!result.changed || !apply) return result;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = crypto.randomUUID();
    const backup = file + '.before-standard-gifts-' + stamp + '-' + suffix + '.bak';
    const temporary = file + '.' + suffix + '.tmp';
    fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    if (!fs.readFileSync(file).equals(before)) throw new Error('Config changed while preparing backup');
    config.giftRules = rules;
    try {
        fs.writeFileSync(temporary, JSON.stringify(config,null,2)+'\n', {flag:'wx'});
        fs.renameSync(temporary, file);
    } finally {
        fs.rmSync(temporary, {force:true});
    }
    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isDeepStrictEqual(persisted, config)) throw new Error('Saved config mismatch');
    return {...result, applied:true, backup};
}

function libraryProfiles(root) {
    const results = [];
    for (const id of Object.keys(presets)) {
        const meta = path.join(root, '.game-library', id);
        const pointer = path.join(meta, 'active.json');
        if (!fs.existsSync(pointer)) continue;
        const active = JSON.parse(fs.readFileSync(pointer, 'utf8'));
        if (active.removed) continue;
        if (active.schema !== 1 || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(active.directory))
            throw new Error('Unsafe active game pointer');
        const file = path.join(meta, 'versions', active.directory, 'game-instance/config', presets[id][1]);
        if (!fs.existsSync(file)) throw new Error('Active game config missing: ' + file);
        results.push([id, file]);
    }
    return results;
}

if (require.main === module) {
    const args = process.argv.slice(2), targets = [];
    let apply = false, report;
    for (let i=0; i<args.length; i++) {
        if (args[i] === '--apply') apply = true;
        else if (args[i] === '--library') targets.push(...libraryProfiles(path.resolve(args[++i])));
        else if (args[i] === '--profile') targets.push([args[++i], path.resolve(args[++i])]);
        else if (args[i] === '--report') report = path.resolve(args[++i]);
        else throw new Error('Unexpected argument: ' + args[i]);
    }
    if (!targets.length) throw new Error('Specify an explicit --library or --profile');
    const unique = [...new Map(targets.map(t=>[t[1].toLowerCase(),t])).values()];
    const results = unique.map(([id,file])=>applyProfile(id,file,{apply}));
    const body = JSON.stringify({checkedAt:new Date().toISOString(), results},null,2)+'\n';
    if (report) fs.writeFileSync(report, body);
    console.log(body);
}

module.exports = {standardRules, applyProfile, libraryProfiles};
