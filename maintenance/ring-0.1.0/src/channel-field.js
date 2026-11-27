'use strict';

// Both desktop views use the same persistent Electron profile.
window.bindChannelField = function bindChannelField(input) {
  const key = 'hediye-box.last-channel.v1';
  const valid = /^[a-z0-9_.]{1,64}$/;
  const normalize = value => value.trim().replace(/^@/, '').toLowerCase();
  const saved = localStorage.getItem(key);
  let edited = saved === '' || (saved !== null && valid.test(saved));
  if (edited) input.value = saved;

  function remember() {
    edited = true;
    const name = normalize(input.value);
    if (valid.test(name) || input.value.trim() === '') localStorage.setItem(key, name);
  }
  input.addEventListener('input', remember);
  input.form.addEventListener('submit', remember);
  return function showCurrentChannel(name) {
    if (!edited && name) input.value = name;
  };
};
