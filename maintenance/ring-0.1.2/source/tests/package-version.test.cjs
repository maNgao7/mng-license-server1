const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('package validator rejects stale outer, inner and native versions before publication', () => {
    const result = spawnSync('python', ['-c', String.raw`
import io, json, sys, zipfile
sys.path.insert(0, 'tools')
from ring_package_check import validate_archive, VERSION_FILES
version = '0.1.2'
def make(overrides=None, missing=None):
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as archive:
        for name in VERSION_FILES:
            if name == missing: continue
            record = {'version': version}
            if name == VERSION_FILES[0]: record.update(game='ring', requiresSteamApp='4793540')
            record.update((overrides or {}).get(name, {}))
            archive.writestr(name, json.dumps(record))
    data.seek(0)
    return data
validate_archive(make(), version)
checks = 1
for name in VERSION_FILES:
    for package in [make({name: {'version': '0.1.0'}}), make(missing=name)]:
        try: validate_archive(package, version)
        except ValueError: checks += 1
        else: raise AssertionError('Invalid release was accepted: ' + name)
for field, value in [('game', 'another-game'), ('requiresSteamApp', '0')]:
    try: validate_archive(make({VERSION_FILES[0]: {field: value}}), version)
    except ValueError: checks += 1
    else: raise AssertionError('Wrong package identity accepted')
print(str(checks) + ' package contract checks passed')
`], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /9 package contract checks passed/);
});
