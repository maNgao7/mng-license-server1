(function(root){
    'use strict';
    function group(catalog,query=''){
        const q=String(query).trim().toLocaleLowerCase('tr'),groups=new Map();
        for(const gift of [...catalog].sort((a,b)=>Number(a.coins)-Number(b.coins)||Number(a.id)-Number(b.id))){
            const key=String(gift.visualGroup||gift.id);
            if(!groups.has(key))groups.set(key,[]);
            groups.get(key).push(gift);
        }
        return [...groups.values()].map(variants=>{
            const matching=variants.filter(gift=>[gift.name,gift.originalName,gift.id,gift.coins].join(' ').toLocaleLowerCase('tr').includes(q));
            return matching.length?{...matching[0],variants}:null;
        }).filter(Boolean).sort((a,b)=>Number(a.coins)-Number(b.coins)||Number(a.id)-Number(b.id));
    }
    const api={group};
    if(typeof module==='object'&&module.exports)module.exports=api;
    else root.TikMNGGiftCatalog=api;
})(typeof window==='object'?window:globalThis);
