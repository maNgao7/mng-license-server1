(() => {
    'use strict';

    const form = document.getElementById('licenseEntryForm');
    const username = document.getElementById('licenseUsername');
    const license = document.getElementById('licenseInput');
    const button = document.getElementById('licenseBtn');
    if (!form || !username || !license || !button) return;

    let usernameEdited = false;
    username.addEventListener('input', () => { usernameEdited = true; });

    const submit = () => {
        if (!button.disabled && !button.classList.contains('loading')) button.click();
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit();
    });

    form.addEventListener('keydown', (event) => {
        if (event.target !== username && event.target !== license) return;
        if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
        event.preventDefault();
        if (!event.repeat) submit();
    });

    async function prefillUsername() {
        try {
            const api = window.mngAPI;
            if (typeof api?.tiktokHesaplari !== 'function') return;
            const data = await api.tiktokHesaplari();
            const saved = typeof data?.active === 'string' && data.active
                ? data.active
                : (Array.isArray(data?.accounts) ? data.accounts.find(name => typeof name === 'string' && name) : '');
            // A slow account lookup must not overwrite an edit or a cleared field.
            if (!usernameEdited && !username.value && saved) username.value = saved;
        } catch {
            // Saved accounts are optional; manual entry stays available.
        }
    }

    prefillUsername();
})();
