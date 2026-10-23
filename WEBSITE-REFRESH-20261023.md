# Website refresh reference lock

Primary target: the existing TikMnG launcher, its current original cover artwork,
charcoal surfaces, turquoise commands and coral status accents. The user's current
site and requested larger full-bleed hero remain the visual foundation.

Refero live research was attempted and returned NO_SUBSCRIPTION. The bundled
craft-details guide supplies keyboard focus, input and responsive control rules.
The user-provided competitor reference informs discovery, not visual identity.

## Decisions

- Keep the existing hero bitmap full bleed, TikMnG as the first-viewport headline,
  and a hint of the next section visible on desktop and mobile.
- Replace emoji-led game panels with 15 original launcher covers, three columns
  on desktop, two on tablet and one on mobile. Preserve natural image proportions.
- Use flat full-width bands for announcements and the gift designer entry.
- Keep admin login visible in the top navigation. Do not modify authentication,
  license endpoints or admin data.
- Show actual game mechanics and external Steam requirements. Do not claim that
  7.0.0 is already published, that every older game is newly launched, or that
  third-party base games are included.
- Filter and search without hiding games from initial HTML. Native dialogs provide
  game details, keyboard focus containment and Escape dismissal.
- Serve the same gift designer code, model, fonts and catalog as the launcher;
  preserve locally saved designs. Cache versions are refreshed together.
- No new generative artwork needed: reuse the approved concept-based covers,
  mechanically resized to WebP for efficient web delivery.

## Verification

Run tools/qa-website.cjs for catalogue parity, links, cover decoding, filtering,
dialog focus, screenshots and mobile overflow. Run the launcher's
tools/qa-gift-designer.cjs against this web root for saved designs and PNG export.
