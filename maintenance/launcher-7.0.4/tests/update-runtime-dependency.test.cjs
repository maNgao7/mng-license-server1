'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('update version comparison is a production dependency, not only a nested dev package',()=>{
    const pkg=require('../package.json'),lock=require('../package-lock.json');
    assert.equal(pkg.dependencies.semver,'7.7.4');
    assert.equal(lock.packages[''].dependencies.semver,pkg.dependencies.semver);
    assert.notEqual(lock.packages['node_modules/semver'].dev,true);
    const semver=require('semver');assert.equal(semver.gt('7.0.3','7.0.1'),true);assert.equal(semver.gt('7.0.3','7.0.3'),false);
});
