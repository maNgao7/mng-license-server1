import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { applyGift, createDuelState, startRound } from '../src/core.mjs';

test('replayed gift sequences score each completed gift only once on its own side', () => {
  const gift = fc.record({
    eventId: fc.integer({ min: 1, max: 12 }).map(id => `gift-${id}`),
    giftId: fc.constantFrom(5655, 5269),
    coins: fc.integer({ min: 1, max: 100 }),
  });

  fc.assert(fc.property(fc.array(gift, { minLength: 1, maxLength: 40 }), gifts => {
    const state = createDuelState({ owner: { username: 'host' }, opponent: { username: 'guest' } });
    assert.equal(startRound(state, { now: 1000 }).ok, true);
    const firstById = new Map();
    for (const item of gifts) {
      if (!firstById.has(item.eventId)) firstById.set(item.eventId, item);
      applyGift(state, item, 2000);
    }
    const expected = { left: 0, right: 0 };
    for (const item of firstById.values()) {
      expected[item.giftId === 5655 ? 'left' : 'right'] += item.coins;
    }
    assert.deepEqual(state.scores, expected);
  }), { numRuns: 1000, seed: 20261115 });
});
