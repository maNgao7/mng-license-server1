const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {editMenuTemplate,attachEditContextMenu}=require('../lib/edit-context-menu.cjs');
test('editable fields expose native paste and selection without executing renderer JavaScript',()=>{
    const template=editMenuTemplate({isEditable:true,editFlags:{canPaste:true,canCopy:false}});
    assert.equal(template.find(item=>item.role==='paste').enabled,true);
    assert.equal(template.find(item=>item.role==='copy').enabled,false);
    assert.ok(template.some(item=>item.role==='selectAll'));
    assert.ok(template.every(item=>!item.click));
    assert.deepEqual(editMenuTemplate({isEditable:false}),[]);
});
test('right-click invokes the native menu on the owning live window',()=>{
    const webContents=new EventEmitter(),window={webContents,isDestroyed:()=>false};let popup;
    attachEditContextMenu(window,{buildFromTemplate:template=>({popup:options=>{popup={template,options};}})});
    webContents.emit('context-menu',{}, {isEditable:true,editFlags:{canPaste:true}});
    assert.equal(popup.options.window,window);assert.equal(popup.template.find(item=>item.role==='paste').label,'Yapıştır');
});
