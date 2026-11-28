'use strict';
const hud = document.querySelector('iframe');
const send = (type, value) => hud.contentWindow.postMessage({ type, value }, '*');
window.addEventListener('message', async event => {
  if (event.source !== hud.contentWindow) return;
  if (event.data?.type === 'initial') send('initial', await window.nativeHud.state());
  if (event.data?.type === 'catalog') send('catalog', await window.nativeHud.catalog());
});
window.nativeHud.onState(value => send('state', value));
window.nativeHud.onView(value => send('view', value));
