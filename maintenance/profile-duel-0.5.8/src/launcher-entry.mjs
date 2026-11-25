import { createProfileDuelController } from './launcher-adapter.mjs';
import { mountDuelWidget } from '../web/widget-view.mjs';

/**
 * Host adapter for a launcher-owned session. Pass the launcher's existing event
 * subscription and synchronous portrait-cache lookup; this module opens neither.
 */
export function mountProfileDuel({
  channel,
  subscribeSharedEvents,
  getCachedProfile,
  root = null,
  onSnapshot = () => {},
  opponent = null,
} = {}) {
  if (typeof subscribeSharedEvents !== 'function') {
    throw new TypeError('Launcher shared-event subscription is required.');
  }

  const view = root ? mountDuelWidget(root) : null;
  const publishSnapshot = snapshot => {
    view?.render(snapshot);
    onSnapshot(snapshot);
  };
  const controller = createProfileDuelController({
    channel,
    subscribe: subscribeSharedEvents,
    getProfile: getCachedProfile,
  });
  const unsubscribeSnapshot = controller.subscribe(publishSnapshot);
  if (opponent) controller.chooseOpponent(opponent);

  return {
    controller,
    destroy() {
      unsubscribeSnapshot();
      controller.close();
      view?.destroy();
    },
  };
}
