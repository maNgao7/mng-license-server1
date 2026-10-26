'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../main.js'),'utf8');
const fn=source.slice(source.indexOf('function oyunAnaDosyalariVar('),source.indexOf('function oyunKlasoruBul('));
test('Snake package validation accepts an older active JAR but never duplicate mod versions',()=>{
    const context={path,fs:{existsSync:()=>true,readdirSync:()=>context.jars},OYUN_TANIMLARI:{'minecraft-snake-arena':{minecraft:true,modFile:'tikmng_snake_arena-0.15.1.jar'}},jars:[]};
    vm.createContext(context);vm.runInContext(fn,context);
    for(const jar of ['tikmng_snake_arena-0.15.0.jar','tikmng_snake_arena-0.15.1.jar','tikmng_snake_arena.jar']){
        context.jars=[jar];assert.equal(context.oyunAnaDosyalariVar('D:/synthetic','minecraft-snake-arena'),true);
    }
    for(const jars of [[],['other.jar'],['tikmng_snake_arena-0.15.0.jar','tikmng_snake_arena-0.15.1.jar']]){
        context.jars=jars;assert.equal(context.oyunAnaDosyalariVar('D:/synthetic','minecraft-snake-arena'),false);
    }
    context.fs.existsSync=()=>false;context.jars=['tikmng_snake_arena.jar'];assert.equal(context.oyunAnaDosyalariVar('D:/synthetic','minecraft-snake-arena'),false);
});
test('advertised native mod file actually exists in each local preview package',()=>{
    const manifest=require('../lib/admin-games.json');
    for(const game of manifest.games.filter(g=>g.definition?.minecraft&&g.package?.localRoot))assert.ok(fs.existsSync(path.join(game.package.localRoot,'game-instance/mods',game.definition.modFile)),game.id+' required mod');
});
