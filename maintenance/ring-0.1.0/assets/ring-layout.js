'use strict';

// Dimensions in the renderer's Y-up world. Physics uses X and -Z for the mat.
const ringLayout = Object.freeze({ centerX: -0.5, centerZ: 4, halfRing: 9, halfDeck: 20.5, cornerInset: 2.1 });
if (typeof module === 'object' && module.exports) module.exports = ringLayout;
else globalThis.TikMngRingLayout = ringLayout;
