'use strict';
if (window.parent !== window) {
  // Chromium otherwise paints a dark default canvas under this transparent iframe.
  document.documentElement.style.colorScheme = 'normal';
  const handlers = new Map();
  const listen = (name, callback) => {
    handlers.set(name, callback);
    return () => handlers.delete(name);
  };
  window.addEventListener('message', event => {
    if (event.source === window.parent) handlers.get(event.data?.type)?.(event.data.value);
  });
  const read = name => new Promise(resolve => {
    const stop = listen(name, value => { stop(); resolve(value); });
    window.parent.postMessage({type: name}, '*');
  });
  window.hediyeBox = {
    getState: () => read('initial'),
    getGiftCatalog: () => read('catalog'),
    onState: callback => listen('state', callback),
    onView: callback => listen('view', callback),
  };
}
