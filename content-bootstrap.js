import { isDeepStrictEqual } from 'node:util';

export function upgradedBootstrapState(state, legacy, current, { allowReleasedBaseline = false } = {}) {
    if ((!allowReleasedBaseline && legacy.revision !== 0) || current.revision <= legacy.revision ||
        !isDeepStrictEqual(state.draft, legacy) || !isDeepStrictEqual(state.published, legacy)) return null;
    return { draft: structuredClone(current), published: structuredClone(current) };
}
