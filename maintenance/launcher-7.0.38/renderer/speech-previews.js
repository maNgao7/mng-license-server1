(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.MNGSpeechPreviews = api;
})(typeof window === 'object' ? window : globalThis, function () {
    'use strict';
    const text = "Tik MNG Game Launcher'a hoş geldiniz. Canlı yayın sohbetini sesli okuyabilirim.";
    const spokenText = "Tik. Em. En. Ge. Geym lonçır'a hoş geldiniz. Canlı yayın sohbetini sesli okuyabilirim.";
    const ids = ['d2-00331','d2-00919','d1-00525','d1-02311','d1-02057','d2-00703','d1-01027','d1-00884','d1-00781','d1-00727'];
    const files = Object.fromEntries(ids.map(id => ['chatterbox:' + id, id + '.wav']));
    files['offline:okur-tr-v1:default'] = 'okur-tr-v1.wav';
    files['offline:ema-tr-v1:default'] = 'ema-tr-v1.wav';
    Object.freeze(files);
    const fastVoices = [{id:'okur-tr-v1',name:'Okur',voiceURI:'offline:okur-tr-v1:default'},{id:'ema-tr-v1',name:'EMA',voiceURI:'offline:ema-tr-v1:default'}];
    return { text, spokenText, files, fastVoices, source: uri => Object.hasOwn(files, uri) ? 'assets/voice-previews/' + files[uri] : null };
});
