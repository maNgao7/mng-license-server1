'use strict';
const ID = 'royal-widgets-20261028';
const KEY = 'widget_announcements_v1';
function createWidgetAnnouncements(store) {
    return {
        pending() { return store.get(KEY, {})[ID] ? [] : [{ id: ID, widgets: ['raconking', 'streambeauty', 'streamhandsome'] }]; },
        dismiss(id) {
            if (id !== ID) throw new Error('Duyuru bulunamadi.');
            store.set(KEY, { ...store.get(KEY, {}), [ID]: true });
            return { ok: true };
        }
    };
}
module.exports = { ID, KEY, createWidgetAnnouncements };
