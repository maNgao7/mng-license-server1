'use strict';
const array = value => Array.isArray(value) ? value : [];
const descending = rows => rows.sort((a,b)=>(Number(b.value)||0)-(Number(a.value)||0));
const people = (items,metric,unit='') => descending(array(items).filter(item=>item&&typeof item==='object').map(item=>({
    id:item.id||item.username||item.uniqueId||item.name,name:item.nickname||item.name||item.username||item.uniqueId||item.id,
    avatar:item.avatar||item.profilePictureUrl||item.profile,value:item[metric],unit
})));
const event = (type,key='entries') => (data,state) => data.type===type&&Array.isArray(data[key]) ? {...state,[key]:data[key]} : null;
const teams = data => descending(Object.entries(data||{}).map(([id,value])=>({id,name:id,value,unit:'gol'})));

module.exports = {
    orbit:{modes:{ranking:'En Büyükler',winners:'Kazananlar'},accept(data,state){
        if(data.type==='leaderboard'&&Array.isArray(data.entries))return {...state,entries:data.entries};
        if(['winner','winner-update'].includes(data.type)&&Array.isArray(data.winnersList))return {...state,winners:data.winnersList};
        return null;
    },rows:(state,mode)=>people(mode==='winners'?state.winners:state.entries,mode==='winners'?'count':'mass',mode==='winners'?'x':'kütle')},
    'crowd-control':{modes:{ranking:'Destekçiler ve Elemeler'},accept(data,state){
        if(data.type==='leaderboard'&&Array.isArray(data.entries))return {...state,entries:data.entries};
        if(data.type==='killers'&&Array.isArray(data.entries))return {...state,killers:data.entries};
        return null;
    },rows:state=>array(state.killers).length?people(state.killers,'kills','x'):people(state.entries,'pts','puan')},
    'battle-game':{modes:{armies:'Ordular',winners:'Turnuva Kazananları'},accept(data,state){
        if(data.type==='army-leaderboard'&&Array.isArray(data.entries))return {...state,armies:data.entries};
        if(data.type==='tournament-winners'&&Array.isArray(data.entries))return {...state,winners:data.entries};
        return null;
    },rows:(state,mode)=>people(mode==='winners'?state.winners:state.armies,mode==='winners'?'count':'soldiers',mode==='winners'?'x':'asker')},
    'duck-hunt':{modes:{survivors:'Hayatta Kalanlar',victims:'Avlananlar'},accept(data){
        return data.type==='leaderboard'&&Array.isArray(data.victims)&&Array.isArray(data.survivors)?{victims:data.victims,survivors:data.survivors}:null;
    },rows:(state,mode)=>people(state[mode],mode==='victims'?'deathCount':'escapeCount','x')},
    'pony-life':{http:'/api/widget-state',modes:{ranking:'Yarış Sıralaması',winners:'Kazananlar'},accept(data){
        return Array.isArray(data.players)&&Array.isArray(data.wins)?data:null;
    },rows:(state,mode)=>people(mode==='winners'?state.wins:state.players,mode==='winners'?'count':'distance',mode==='winners'?'x':'m')},
    'penalty-kick':{modes:{ranking:'Penaltı Sıralaması',keepers:'Kaleciler',teams:'Takımlar'},accept(data){
        return ['init-leaderboard','sync-leaderboard'].includes(data.type)&&Array.isArray(data.goalkeepers)&&data.teams&&typeof data.teams==='object'?data:null;
    },rows:(state,mode)=>mode==='teams'?teams(state.teams):people(state.goalkeepers,'saves','kurtarış')},
    'tightrope-balance':{http:'/api/leaderboard',modes:{left:'Sol Destekçiler',right:'Sağ Destekçiler',top:'En Büyük Destekçiler',both:'Tüm Destekçiler'},accept(data){
        return Array.isArray(data.left)&&Array.isArray(data.right)?data:null;
    },rows(state,mode){
        const rows=side=>array(state[side]).filter(item=>Array.isArray(item)&&item[1]&&typeof item[1]==='object').map(([id,item])=>({id,...item}));
        return people(mode==='left'?rows('left'):mode==='right'?rows('right'):[...rows('left'),...rows('right')],'totalKg','kg');
    }},
    vs:{modes:{vs:'VS Skorları',winners:'VS Kazananları'},accept:(data)=>data.type==='battleState'&&data.state&&typeof data.state==='object'?data.state:null,
        rows(state,mode){
            if(mode==='winners'){
                const counts=new Map();for(const row of [...array(state.leftTally),...array(state.rightTally)]){const name=String(row?.name||'');if(name)counts.set(name,(counts.get(name)||0)+1);}
                return descending([...counts].map(([name,value])=>({id:name,name,value,unit:'x'})));
            }
            return ['left','right'].filter(side=>state[side+'Username']).map(side=>({id:side,name:state[side+'Username'],value:state[side+'Score'],avatar:state[side+'PhotoUrl'],unit:'puan'}));
        }},
    puanlama:{modes:{profile:'Puanlanan Profil',leaderboard:'En Çok Coin Gönderenler'},accept(data,state){
        if(data.type==='puanlamaState'&&data.state&&typeof data.state==='object')return {...state,profile:data.state};
        if(data.type==='giftState'&&Array.isArray(data.entries))return {...state,entries:data.entries};
        return null;
    },
        rows(state,mode,shared){
            if(mode==='leaderboard')return shared?people(shared.topGifters,'totalCoins','coin'):people(state.entries,'coins','coin');
            const user=state.profile?.gosterilenKullanici;if(!user)return [];
            const votes=array(state.profile.oylar);const value=votes.length?votes.reduce((sum,row)=>sum+(Number(row.puan)||0),0)/votes.length:0;
            return people([{...user,ortalama:Math.round(value*10)/10}],'ortalama','puan');
        }}
};
