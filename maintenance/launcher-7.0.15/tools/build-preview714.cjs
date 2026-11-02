'use strict';
const config=require('../package.json').build;
module.exports={...config,appId:'com.mng.tiktokgame.preview',productName:'TikMnG Update Preview',
 directories:{output:'D:/TikMnG-Maintenance-714-preview'},
 extraMetadata:{version:'7.0.14-preview.1'},publish:null,
 files:[...config.files,'!lib/portrait-engine/**/*','!node_modules/onnxruntime-node/**/*'],
 extraResources:[{from:'tools/preview714.json',to:'tikmng-preview.json'}]};
