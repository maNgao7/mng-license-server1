'use strict';
function editMenuTemplate(params){
    const flags=params.editFlags||{};
    if(!params.isEditable)return params.selectionText?[{label:'Kopyala',role:'copy',enabled:flags.canCopy!==false}]:[];
    return [
        {label:'Geri al',role:'undo',enabled:Boolean(flags.canUndo)},
        {label:'Yinele',role:'redo',enabled:Boolean(flags.canRedo)},
        {type:'separator'},
        {label:'Kes',role:'cut',enabled:Boolean(flags.canCut)},
        {label:'Kopyala',role:'copy',enabled:Boolean(flags.canCopy)},
        {label:'Yapıştır',role:'paste',enabled:Boolean(flags.canPaste)},
        {type:'separator'},
        {label:'Tümünü seç',role:'selectAll'}
    ];
}
function attachEditContextMenu(window,Menu){
    window.webContents.on('context-menu',(_event,params)=>{
        const template=editMenuTemplate(params);
        if(template.length&&!window.isDestroyed())Menu.buildFromTemplate(template).popup({window});
    });
}
module.exports={editMenuTemplate,attachEditContextMenu};
