'use strict';

// These are broadcast formats of a base design, not additional widget engines.
const formats = [
    {id:'portrait',label:'Dikey',format:'portrait',items:4},
    {id:'compact',label:'Kompakt',format:'compact',items:3}
];
function createPresets(definitions) {
    return definitions.flatMap(base=>formats.map(format=>({
        ...structuredClone(base),
        id:base.id+'-'+format.id,
        baseId:base.id,
        preset:true,
        name:base.name+' / '+format.label,
        description:base.description,
        format:format.format,
        fields:base.fields.map(field=>({...structuredClone(field),
            value:field.key==='format'?format.format:field.key==='itemCount'?format.items:field.value
        }))
    })));
}
module.exports={createPresets,formats};
