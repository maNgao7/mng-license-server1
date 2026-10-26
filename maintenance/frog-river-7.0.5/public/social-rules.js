export function socialSettings(saved = {}) {
  const integer = (value, fallback, max) => Number.isFinite(Number(value)) && Number(value) >= 1 ? Math.min(max, Math.floor(Number(value))) : fallback;
  return {
    followEnabled: saved.followEnabled !== false,
    followDistance: integer(saved.followDistance, 50, 5000),
    followBackwardEnabled: saved.followBackwardEnabled === true,
    followBackwardDistance: integer(saved.followBackwardDistance, 50, 5000),
    likeEnabled: saved.likeEnabled !== false,
    likeThreshold: integer(saved.likeThreshold, 100, 10000),
    likeDistance: integer(saved.likeDistance, 50, 5000),
    likeBackwardEnabled: saved.likeBackwardEnabled === true,
    likeBackwardDistance: integer(saved.likeBackwardDistance, 50, 5000)
  };
}

export class SocialActions {
  constructor() { this.likes = 0; this.queue = []; }
  accept(event, config) {
    if (!['follow', 'like'].includes(event.event)) return;
    let repeats = 1;
    if (event.event === 'like') {
      const count = Number(event.count);
      if (!Number.isFinite(count) || count < 1 || (!config.likeEnabled && !config.likeBackwardEnabled)) return;
      this.likes += Math.floor(count);
      repeats = Math.floor(this.likes / config.likeThreshold);
      this.likes %= config.likeThreshold;
    }
    if (!repeats) return;
    const prefix = event.event;
    for (const [enabled, distance, direction] of [
      [config[prefix + 'Enabled'], config[prefix + 'Distance'], 1],
      [config[prefix + 'BackwardEnabled'], config[prefix + 'BackwardDistance'], -1]
    ]) {
      if (!enabled) continue;
      const action = { distance: direction * distance * repeats, username: event.username };
      const last = this.queue.at(-1);
      if (last && Math.sign(last.distance) === direction) last.distance += action.distance;
      else this.queue.push(action);
    }
  }
  reset() { this.likes = 0; this.queue = []; }
}
