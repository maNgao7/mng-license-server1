(() => {
    'use strict';
    const nativeFetch=window.fetch.bind(window),cache=new Map(),requests=new Map(),scopes=new Map();
    const patch=typeof window.TikMnGStatePatch?.apply==='function'?window.TikMnGStatePatch:null;
    const preview=new URLSearchParams(location.search).get('preview')==='1';let disposed=false,generation=0;
    const sourcePrefix=(location.pathname||new URL(location.href).pathname).match(/^\/overlays\/[A-Za-z0-9_-]{43}(?=\/)/)?.[0]||'';
    function response(body){return new Response(body,{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
    function canceled(signal){return signal?.reason||new DOMException('Source closed','AbortError');}
    function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
    function revision(value){return typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);}
    function token(value){return revision(value);}
    function remember(request,body,value){
        if(request.controller.signal.aborted||disposed||request.generation!==request.scope.generation)return;
        cache.delete(request.key);if(request.patchKey)cache.delete(request.patchKey);
        if(body?.length<512*1024&&object(value)&&revision(value.__stateRevision)){
            const exact=patch&&token(value.__stateToken)?value.__stateToken:null;
            cache.set(exact?request.patchKey:request.key,{revision:value.__stateRevision,token:exact,body});
            while(cache.size>4)cache.delete(cache.keys().next().value);
        }
    }
    function stateURL(input,options){
        if(options?.method&&options.method.toUpperCase()!=='GET'||typeof input!=='string'&&!(input instanceof URL))return null;
        if(Object.keys(options).some(key=>!['method','cache','signal'].includes(key)))return null;
        try{const url=new URL(input,location.href),prefix=url.pathname.match(/^\/overlays\/[A-Za-z0-9_-]{43}(?=\/)/)?.[0]||'',pathname=url.pathname.slice(prefix.length);
            return url.origin===location.origin&&(!prefix||prefix===sourcePrefix)&&!['transport','after','patch','base'].some(key=>url.searchParams.has(key))&&/^\/(?:api\/)?widget\/(?:state|(?:top-gift|top-likes|leaderboard|activity)\/state)$/.test(pathname)?url:null;
        }catch{return null;}
    }
    async function exchange(url,options,key,request){
        const {controller}=request,timeout=setTimeout(()=>controller.abort(),14000);
        try{
            if(preview&&document.hidden)await new Promise((resolve,reject)=>{
                const clear=()=>{document.removeEventListener('visibilitychange',visible);controller.signal.removeEventListener('abort',canceled);};
                const visible=()=>{if(!document.hidden){clear();resolve();}};
                const canceled=()=>{clear();reject(new DOMException('Preview suspended','AbortError'));};
                document.addEventListener('visibilitychange',visible);controller.signal.addEventListener('abort',canceled,{once:true});if(controller.signal.aborted)canceled();
            });
            if(controller.signal.aborted)throw canceled(controller.signal);
            let previous=(request.patchKey&&cache.get(request.patchKey))||cache.get(key);
            for(let attempt=0;attempt<2;attempt++){
                const target=new URL(url);
                target.searchParams.set('transport','changes');if(patch)target.searchParams.set('patch','1');
                if(previous){target.searchParams.set('after',previous.revision);if(previous.token)target.searchParams.set('base',previous.token);}
                const result=await nativeFetch(target.href,{...options,signal:controller.signal});
                if(controller.signal.aborted)throw canceled(controller.signal);
                if(result.status===204&&previous)return response(previous.body);
                if(result.status!==200){
                    remember(request);
                    if(attempt)throw new Error('Widget state recovery did not return a full snapshot');
                    return result;
                }
                let body,value;
                try{
                    body=await result.clone().text();
                    if(controller.signal.aborted)throw canceled(controller.signal);
                    value=JSON.parse(body);
                }catch(error){
                    if(controller.signal.aborted)throw canceled(controller.signal);
                    remember(request);
                    if(attempt)throw error;
                    if(!patch)return result;
                    previous=null;continue;
                }
                if(object(value)&&Object.prototype.hasOwnProperty.call(value,'__statePatch')){
                    try{
                        const delta=value.__statePatch;
                        if(!patch||!previous?.token||!revision(value.__stateRevision)||!token(value.__stateToken)||
                            !object(delta)||delta.version!==1||delta.base!==previous.token||!Array.isArray(delta.operations))throw new Error('Invalid widget state patch base');
                        // Preserve the exact saved body, including metadata, across concurrent responses and failed patches.
                        const rebuilt=patch.apply(JSON.parse(previous.body),delta.operations);
                        if(!object(rebuilt))throw new Error('Invalid widget state patch result');
                        const full={...rebuilt,__stateRevision:value.__stateRevision,__stateToken:value.__stateToken};
                        delete full.__statePatch;
                        body=JSON.stringify(full);
                        if(controller.signal.aborted)throw canceled(controller.signal);
                        remember(request,body,full);
                        return response(body);
                    }catch(error){
                        if(controller.signal.aborted)throw canceled(controller.signal);
                        remember(request);
                        if(attempt)throw error;
                        previous=null;continue;
                    }
                }
                if(attempt&&!object(value)){remember(request);throw new Error('Invalid widget state recovery snapshot');}
                remember(request,body,value);
                return result;
            }
        }finally{
            clearTimeout(timeout);request.settled=true;if(requests.get(request.pendingKey)===request)requests.delete(request.pendingKey);
            if(!--request.scope.active&&scopes.get(request.scopeKey)===request.scope)scopes.delete(request.scopeKey);
        }
    }
    function subscribe(request,signal){
        request.users++;
        return new Promise((resolve,reject)=>{
            let done=false;
            const finish=()=>{
                if(done)return false;done=true;signal?.removeEventListener('abort',abort);request.users--;
                if(!request.users&&!request.settled){request.controller.abort();if(requests.get(request.pendingKey)===request)requests.delete(request.pendingKey);}
                return true;
            };
            const abort=()=>{if(finish())reject(canceled(signal));};
            signal?.addEventListener('abort',abort,{once:true});
            request.promise.then(result=>{if(finish())try{resolve(result.clone());}catch(error){reject(error);}},error=>{if(finish())reject(error);});
            if(signal?.aborted)abort();
        });
    }
    window.fetch=async(input,options={})=>{
        options=options||{};
        const url=stateURL(input,options);if(!url)return nativeFetch(input,options);
        if(disposed)throw new DOMException('Source closed','AbortError');
        if(options.signal?.aborted)throw canceled(options.signal);
        url.searchParams.delete('t');url.searchParams.sort();const key=url.href,pendingKey=key+'\n'+(options.cache||'default');
        let request=requests.get(pendingKey);
        if(!request||request.controller.signal.aborted){
            let patchKey=null;
            if(patch){const canonical=new URL(url);canonical.searchParams.delete('eventsAfter');canonical.searchParams.delete('history');patchKey='patch\n'+canonical.href;}
            const scopeKey=patchKey||key,scope=scopes.get(scopeKey)||{active:0,generation:0};
            scope.active++;scope.generation=++generation;scopes.set(scopeKey,scope);
            request={controller:new AbortController(),users:0,settled:false,pendingKey,key,patchKey,scopeKey,scope,generation};requests.set(pendingKey,request);
            request.promise=exchange(url,options,key,request);
        }
        // Interval-based legacy sources can join one long poll without sharing cancellation or bodies.
        return subscribe(request,options.signal);
    };
    if(preview)document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const request of requests.values())request.controller.abort();});
    addEventListener('pagehide',()=>{disposed=true;for(const request of requests.values())request.controller.abort();requests.clear();cache.clear();scopes.clear();},{once:true});
})();
