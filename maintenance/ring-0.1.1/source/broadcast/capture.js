'use strict';
const stage = document.querySelector('main');
const video = document.querySelector('video');
const statusText = document.querySelector('p');
const hud = document.querySelector('iframe');
const sendHud = (type, value) => hud.contentWindow.postMessage({type, value}, '*');
window.addEventListener('message', async event => {
  if (event.source !== hud.contentWindow) return;
  if (event.data?.type === 'initial') sendHud('initial', await window.hediyeBox.getState());
  if (event.data?.type === 'catalog') sendHud('catalog', await window.hediyeBox.getGiftCatalog());
});
window.hediyeBox.onState(value => sendHud('state', value));
window.hediyeBox.onView(value => sendHud('view', value));
let geometry, stream, timer, closing = false;
function layout() {
  if (!geometry || !video.videoWidth || !video.videoHeight) return;
  const { width, height } = geometry.bounds;
  const frame = geometry.frame;
  const vw = video.videoWidth, vh = video.videoHeight;
  // Some capture backends include the Windows title bar, others return just the client.
  const cropped = frame && Math.abs(vw / vh - frame.width / frame.height) < Math.abs(vw / vh - width / height);
  const scale = Math.min(innerWidth / width, innerHeight / height);
  stage.style.width = width * scale + 'px';
  stage.style.height = height * scale + 'px';
  video.style.width = (cropped ? frame.width : width) * scale + 'px';
  video.style.height = (cropped ? frame.height : height) * scale + 'px';
  video.style.left = (cropped ? -frame.clientX * scale : 0) + 'px';
  video.style.top = (cropped ? -frame.clientY * scale : 0) + 'px';
}
async function openRing() {
  if (closing) return;
  try {
    const source = await window.ringCapture.source();
    geometry = source.geometry;
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: source.id, maxFrameRate: 60 },
    } });
    if (closing) { stream.getTracks().forEach(track => track.stop()); return; }
    stream.getVideoTracks()[0].addEventListener('ended', retry, { once: true });
    video.srcObject = stream;
    await video.play();
    layout(); stage.hidden = false; statusText.hidden = true;
  } catch { retry(); }
}
function retry() {
  if (closing) return;
  clearTimeout(timer);
  stream?.getTracks().forEach(track => track.stop());
  stage.hidden = true; statusText.hidden = false;
  statusText.textContent = 'Ring görüntüsü alınamadı. Oyun penceresi açıldığında yeniden bağlanılacak.';
  timer = setTimeout(openRing, 2500);
}
window.ringCapture.onGeometry(value => { if (value?.bounds) { geometry = value; layout(); } });
video.addEventListener('resize', layout);
window.addEventListener('resize', layout);
window.addEventListener('pagehide', () => {
  closing = true; clearTimeout(timer); stream?.getTracks().forEach(track => track.stop());
});
void openRing();
