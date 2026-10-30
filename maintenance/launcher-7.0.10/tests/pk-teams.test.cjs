'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {updatePK,visiblePK}=require('../lib/pk-state.cjs');
const team=(teamId,users,total)=>({teamId,teamTotalScore:String(total),teamUser:users.map(([userId,score])=>({userId,score:String(score)}))});
const four={battleId:'123',teamArmies:[team('11',[['111',10],['222',20]],999),team('22',[['333',30],['444',40]],888)]};
test('2v2 displays official team totals, never sums member or supporter points',async()=>{
    const p=await import('tiktok-live-proto/v3');
    const wire=p.WebcastLinkMicArmies.fromPartial? p.WebcastLinkMicArmies.fromPartial(four):{...p.WebcastLinkMicArmies.decode(new Uint8Array()),...four,
        teamArmies:four.teamArmies.map(t=>({...p.BattleTeamUserArmies.decode(new Uint8Array()),...t,teamUser:t.teamUser.map(u=>({...p.BattleTeamUser.decode(new Uint8Array()),...u}))}))};
    const state=updatePK(null,p.WebcastLinkMicArmies.decode(p.WebcastLinkMicArmies.encode(wire).finish()),1000);
    assert.deepEqual(state.players.map(p=>p.score),[10,20,30,40]);
    assert.deepEqual(state.teams.map(t=>t.score),[999,888]);
    assert.deepEqual(state.teams.map(t=>t.memberIds),[['111','222'],['333','444']]);
});
test('team sides stay stable when the next packet reverses array or map order',()=>{
    let state=updatePK(null,four,1000);
    state=updatePK(state,{...four,teamArmies:[...four.teamArmies].reverse()},2000);
    assert.deepEqual(state.teams.map(t=>t.id),['11','22']);
    let duel=updatePK(null,{battleId:'4',armies:{111:{hostscore:'1'},222:{hostscore:'2'}}},1000);
    duel=updatePK(duel,{battleId:'4',armies:{222:{hostscore:'3'},111:{hostscore:'2'}}},2000);
    assert.deepEqual(duel.teams.map(t=>t.memberIds[0]),['111','222']);
});
test('four people never become guessed teams; invalid totals and overlapping rosters are rejected',()=>{
    const armies=Object.fromEntries(['111','222','333','444'].map(id=>[id,{hostscore:'10'}]));
    assert.deepEqual(updatePK(null,{battleId:'1',armies}).teams,[]);
    for(const change of [x=>x.teamArmies[0].teamTotalScore='NaN',x=>x.teamArmies[1].teamUser[0].userId='111']){
        const bad=structuredClone(four);change(bad);assert.deepEqual(updatePK(null,bad).teams,[]);
    }
});
test('team totals expire when absent in later packets and are cleared for a new match',()=>{
    let state=updatePK(null,four,1000);
    const armies=Object.fromEntries(['111','222','333','444'].map(id=>[id,{hostscore:'10'}]));
    state=updatePK(state,{battleId:'123',armies},40000);
    assert.deepEqual(visiblePK(state,40000).teams,[]);
    state=updatePK(state,{...four,battleId:'124',battleSettings:{status:0}},41000);
    assert.deepEqual(state.teams,[]);
});
