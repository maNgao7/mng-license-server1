'use strict';
async function ensureRequiredGameHotfix({gameId,state,install}){
    if(!['frog-river','caahr'].includes(gameId)||!state?.installed||!state.updateAvailable)return false;
    const result=await install(gameId);
    if(!result?.basarili)throw Error(result?.hata||'Oyun düzeltmesi indirilemedi. Eski dosyalar korunuyor; yeniden deneyin.');
    return true;
}
module.exports={ensureRequiredGameHotfix};
