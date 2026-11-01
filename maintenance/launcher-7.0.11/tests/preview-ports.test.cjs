'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const net=require('node:net');
const {assertPreviewPortsAvailable}=require('../lib/preview-ports.cjs');
test('preview never takes an occupied port and can use a freed port',async t=>{
    const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>server.close());const port=server.address().port;
    await assert.rejects(assertPreviewPortsAvailable([port]),/Normal launcher/);assert.equal(server.listening,true);
    await new Promise(resolve=>server.close(resolve));await assertPreviewPortsAvailable([port,port]);
});
