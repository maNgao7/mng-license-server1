import { TikTokLiveConnection as Direct, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import shared from './launcher-live-client.cjs';
export function TikTokLiveConnection(username, options) {
    if (process.env.MNG_SHARED_LIVE_URL) return shared.createGameLiveClient(username);
    return new Direct(username, options);
}
export { WebcastEvent, ControlEvent };
