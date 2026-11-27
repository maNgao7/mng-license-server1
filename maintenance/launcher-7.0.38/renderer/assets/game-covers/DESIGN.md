# Game Library Artwork and UI Reference Lock

## Persistent User Preference

All current and future games receive an original concept-based cover, never a
game screenshot. The user may request replacements after seeing the collection.
See the project AGENTS.md before adding games.

Desktop navigation belongs on the RIGHT, with the header and content on the
left. Keep the rail compact and use a left divider. On mobile, retain the top
horizontal scrolling menu without page overflow or overlapping controls.
Preserve the original TikMnG identity, logo and neutral charcoal/turquoise theme;
do not turn the launcher into a TikOyun clone.

## Reference Lock

Primary structural reference: the user's supplied game-library screenshot on
2026-10-21. Preserve a compact charcoal sidebar on the right, large image-first tiles, small
installed badges, a title overlay, search, and installed-first grouping.
Borrow the existing TikMnG turquoise/pink accents and logo, not the reference
product's artwork or branding. Live Refero research was unavailable due to the
service's subscription response; bundled craft guidance and the user's concrete
reference supply the design constraints.

## Decision Ledger

| Decision | Source | Role |
| --- | --- | --- |
| Charcoal canvas and quiet controls | User reference | Interface chrome |
| Right desktop rail; header and content on the left; top scrolling mobile menu | Explicit user preference | Navigation placement |
| Original TikMnG identity, not a TikOyun clone | Explicit user requirement | Brand and visual language |
| Independent full-bleed game art | Explicit user requirement | Library and detail media |
| Turquoise selection and primary command | Existing TikMnG brand | Action emphasis only |
| Installed games above available games | Explicit user requirement | Library ordering |
| Cover opens details; install/play stay on details | Explicit user requirement | Navigation contract |
| Restrained cover motion and reduced-motion support | Reference + craft guidance | Hover/focus feedback |
| Title rendered as text, not baked into art | Crisp small text + localization | Accessible naming |

## Assets

Each `*-v3.png` is generated separately using the built-in image tool. Original
outputs remain under the Codex generated-images directory; copies ship in this
folder. No asset is extracted from a game or borrowed from another launcher.

## Entry and Media Iteration, 2026-10-22

- Entry sequence: user's two-column sign-in reference. Preserve username then
  license, but use original TikMnG charcoal/teal and unframed full-bleed artwork.
- Artwork v1/v2 were rejected. Current candidate `streamer-entry-v3.png` follows
  the user's explicit female/male creators at separate desks and visible LIVE
  gift/chat theme. It is generated artwork, not another product's screenshot.
- Media editing: user's trim/gift example supplies interaction requirements,
  not its exact composition. Keep dark letterboxing, numeric and drag controls,
  independent per-game links, and native modal focus isolation.
- Hover gifts stay within the focused tile; adjacent games never blur. Respect
  reduced-motion preferences and leave primary controls unobstructed.
- Craft reference: Refero bundled `craft-details.md`, visible keyboard focus,
  editable form values, and responsive dimensions. Live styles lookup again
  returned NO_SUBSCRIPTION; no unverified live Refero references are claimed.
