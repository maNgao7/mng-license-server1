import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { WebcastGiftMessage, WebcastLikeMessage, WebcastSocialMessage, Gift, User, CommonMessageData } from 'tiktok-live-proto/v3';
import { LiveSession } from './live-session.js';

function message(codec, values) {
  return codec.decode(codec.encode({ ...codec.decode(new Uint8Array()), ...values }).finish());
}
const user = name => message(User, { displayId: name, nickname: name });
const common = id => message(CommonMessageData, { msgId: id });
export const gifts = ['5655', '5319', '5879', '8913', '5303', '5282', '5486', '6427', '7168', '5994', '7934', '11046', '5658'];
export function gift(id, group, count, end, msgId, viewer = 'gift_viewer', streak = true) {
  return message(WebcastGiftMessage, { giftId: id, groupId: group, repeatCount: count, repeatEnd: end ? 1 : 0,
    gift: message(Gift, { id, type: streak ? 1 : 0, name: 'Fixture', diamondCount: 1 }), user: user(viewer), common: common(msgId) });
}
export function like(count, total, msgId = '9001', viewer = 'like_viewer') {
  return message(WebcastLikeMessage, { count, total: String(total), user: user(viewer), common: common(msgId) });
}
export function follow(msgId, viewer = 'follow_viewer') {
  return message(WebcastSocialMessage, { user: user(viewer), common: common(msgId) });
}
export async function fixtureSession(publish = () => {}) {
  let connection;
  const session = new LiveSession(() => {
    connection = new TikTokLiveConnection('fixture_streamer', { enableExtendedGiftInfo: false });
    connection.connect = async () => ({});
    connection.disconnect = () => {};
    return connection;
  }, [[WebcastEvent.GIFT, 'gift'], [WebcastEvent.LIKE, 'like'], [WebcastEvent.FOLLOW, 'follow']], publish);
  await session.connect('fixture_streamer', 'fixture-session');
  return { session, connection };
}

export async function emitGift(connection, ...args) {
  await connection.processDecodedData({ type: 'WebcastGiftMessage', data: gift(...args) });
}
export async function emitLike(connection, ...args) {
  await connection.processDecodedData({ type: 'WebcastLikeMessage', data: like(...args) });
}
