export function normalizeLiveEvent(type, data = {}) {
  const user = data.user || data;
  // Likes are packet deltas. repeatCount belongs only to gift streaks.
  const count = Number(type === 'like' ? data.likeCount ?? data.count : type === 'gift' ? data.repeatCount ?? data.count ?? 1 : 1);
  if (!Number.isFinite(count) || count < 1) return null;
  const gift = data.gift || data.extendedGiftInfo || {};
  return {type:'event', event:type,
    username:String(user.uniqueId || data.uniqueId || user.nickname || 'İzleyici').slice(0,60),
    giftId:String(data.giftId || gift.id || '').slice(0,40),
    giftImage:String(gift.image?.urlList?.[0] || gift.icon?.urlList?.[0] || '').slice(0,600),
    gift:String(data.giftName || gift.name || 'Hediye').slice(0,80),
    count:Math.min(1000000,Math.floor(count)),coins:Math.max(0,Number(data.diamondCount ?? gift.diamondCount) || 0)};
}
