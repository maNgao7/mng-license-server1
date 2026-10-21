# TikMnG Launcher Project Rules

## Game Cover Artwork

- Every existing game and every newly added game must have its own original cover.
- Base the cover on the game's mechanics, setting and experience. Do not use a
  gameplay, settings, login or loading-screen screenshot as cover artwork.
- Generate polished raster key art with a clear focal subject, readable at tile
  size. Keep the title in the launcher UI so it stays crisp and editable.
- Use separate artwork for distinct games, including games sharing one package.
- Preserve a landscape composition and a stable image slot in the library.
- A new game is not visually complete until its dedicated cover is connected to
  its library tile and detail page and verified in the rendered application.
- Replace a cover when the user asks; preserve a versioned source and its prompt.
- The user will identify covers they want changed. Do not require approval for
  every cover before continuing the rest of the work.

## Existing User Data

- Preserve saved gift/action assignments, license state, installed games and
  individual game settings during launcher changes and updates.
- Use isolated profiles and synthetic data for automated UI tests.

## Launcher Identity and Preview Delivery

- Desktop navigation belongs on the right. Preserve the original TikMnG brand;
  a reference launcher's workflow is not permission to clone its visual design.
- Deliver large launcher updates first as a separate local test application and
  desktop shortcut. Do not publish a stable update until the user approves it.
- Preview builds have their own application identity, user-data directory, media
  library and widget port. They must never force-close the stable app's services.

## Independent Updates

- Launcher and game versions are independent. A game-only release must not bump
  or reinstall the launcher, clear its profile, or reinstall unrelated games.
- Game metadata is published through the content catalog. Install only the
  selected package, validate hashes, preserve mutable settings/saves and switch
  its active version only after successful validation.
- Keep game/media storage outside the application install directory. Launcher
  updates must retain the game pointers, configured paths and account settings.
- Games sharing one physical package share an update lock and active version;
  never represent one alias as independently installed from its shared package.
- Exercise a two-game regression test before changing update behavior: upgrading
  one package leaves the other package bytes, settings and active pointer intact.
