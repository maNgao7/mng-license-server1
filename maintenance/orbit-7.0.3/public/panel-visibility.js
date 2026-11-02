(() => {
  'use strict';
  const key = 'mng_orbit_panel_visibility_v1';
  const panels = { gifts: 'orbitSideSpecials', winners: 'orbitWinnersPanel', ranking: 'orbitRankingPanel', timer: 'roundTimer' };
  const trigger = document.getElementById('panelVisibilityButton');
  const menu = document.getElementById('panelVisibilityMenu');
  const state = Object.fromEntries(Object.keys(panels).map(name => [name, true]));
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved === 'object') {
      for (const name of Object.keys(panels)) if (typeof saved[name] === 'boolean') state[name] = saved[name];
    }
  } catch { /* Display controls also work when browser storage is unavailable. */ }
  function apply() {
    for (const [name, id] of Object.entries(panels)) {
      document.getElementById(id).classList.toggle('orbit-panel-hidden', !state[name]);
      menu.querySelector(`[data-orbit-panel="${name}"]`).checked = state[name];
    }
    trigger.classList.toggle('has-hidden-panels', Object.values(state).includes(false));
  }
  function close() { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }
  trigger.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    trigger.setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu.addEventListener('change', event => {
    const name = event.target.dataset.orbitPanel;
    if (!Object.hasOwn(panels, name)) return;
    state[name] = event.target.checked;
    apply();
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { }
  });
  document.addEventListener('pointerdown', event => {
    if (!menu.contains(event.target) && !trigger.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { close(); trigger.focus(); }
  });
  apply();
})();
