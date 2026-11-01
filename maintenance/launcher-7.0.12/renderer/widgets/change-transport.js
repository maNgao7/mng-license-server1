(() => {
    'use strict';
    const nativeFetch=window.fetch.bind(window),cache=new Map(),requests=new Set();
    const preview=new URLSearchParams(location.search).get('preview')==='1';let disposed=false;
    function response(body){return new Response(body,{status:200,headers:{'Content-Type':'application/json; charset=utf-8'}});}
    function stateURL(input,options){
        if(options?.method&&options.method.toUpperCase()!=='GET'||typeof input!=='string'&&!(input instanceof URL))return null;
        try{const url=new URL(input,location.href),pathname=url.pathname.replace(/^\/overlays\/[A-Za-z0-9_-]{43}(?=\/)/,'');
            return url.origin===location.origin&&/^\/(?:api\/)?widget\/(?:state|(?:top-gift|top-likes|leaderboard|activity)\/state)$/.test(pathname)?url:null;
        }catch{return null;}
    }
    window.fetch=async(input,options={})=>{
        const url=stateURL(input,options);if(!url)return nativeFetch(input,options);
        if(disposed)throw new DOMException('Source closed','AbortError');
        const controller=new AbortController(),abort=()=>controller.abort();requests.add(controller);
        if(options.signal?.aborted)controller.abort();else options.signal?.addEventListener('abort',abort,{once:true});
        const timeout=setTimeout(abort,14000);
        try{
            if(preview&&document.hidden)await new Promise((resolve,reject)=>{
                const clear=()=>{document.removeEventListener('visibilitychange',visible);controller.signal.removeEventListener('abort',canceled);};
                const visible=()=>{if(!document.hidden){clear();resolve();}};
                const canceled=()=>{clear();reject(new DOMException('Preview suspended','AbortError'));};
                document.addEventListener('visibilitychange',visible);controller.signal.addEventListener('abort',canceled,{once:true});if(controller.signal.aborted)canceled();
            });
            url.searchParams.delete('t');const key=url.href,previous=cache.get(key);
            url.searchParams.set('transport','changes');if(previous)url.searchParams.set('after',previous.revision);
            const result=await nativeFetch(url.href,{...options,signal:controller.signal});
            if(result.status===204&&previous)return response(previous.body);
            if(!result.ok)return result;
            const value=await result.clone().json();
            if(/^[a-f0-9]{32}$/.test(value?.__stateRevision||'')){
                const body=JSON.stringify(value);if(body.length<512*1024){cache.delete(key);cache.set(key,{revision:value.__stateRevision,body});while(cache.size>4)cache.delete(cache.keys().next().value);}
            }
            return result;
        }finally{clearTimeout(timeout);requests.delete(controller);options.signal?.removeEventListener('abort',abort);}
    };
    if(preview)document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const controller of requests)controller.abort();});
    addEventListener('pagehide',()=>{disposed=true;for(const controller of requests)controller.abort();cache.clear();},{once:true});
})();
