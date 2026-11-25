import { mountDuelWidget } from './widget-view.mjs';
import { mountProfilePicker } from './profile-picker.mjs';

const view = mountDuelWidget(document);
const picker=mountProfilePicker({render:state=>{view.render(state);picker.render(state);}});
const render=state=>{view.render(state);picker.render(state);};
let receivedStreamState = false;
const eventSource = new EventSource('./api/events');
eventSource.onmessage = event => {
  try {
    const state = JSON.parse(event.data);
    receivedStreamState = true;
    render(state);
  } catch {}
};
fetch('./api/state', { cache: 'no-store' }).then(response => response.json()).then(state => {
  if (!receivedStreamState) render(state);
}).catch(() => {});

window.addEventListener('pagehide', () => {
  eventSource.close();
  view.destroy();
  picker.destroy();
}, { once: true });
