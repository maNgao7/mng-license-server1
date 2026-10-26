# TikMnG 7.0.5 Urgent Repair

## Changed

- Vak Vak Jump 7.0.5: repeated 100 likes award 50 meters; follows award 50 meters by default. Like packets use likeCount/count, not gift repeatCount. Busy effects and open menus no longer discard queued social movement. Separate backward toggles and distances survive restart. Save success waits for the server acknowledgement.
- Sesli Surus 0.6.12: 13 approved gift IDs, GG and ice cream one second. Legacy incomplete editor rows receive missing defaults with an exact backup. Real custom gift assignments and explicit duration choices are retained. Removed the incorrect hard-coded cowboy warning.
- Launcher 7.0.5: checks while open, after reconnect and focus. A failed check is not presented as confirmed up-to-date. If the normal updater cannot load, official GitHub metadata and its SHA-256 installer digest provide a verified fallback.
- The selected urgent game is updated before play. Unrelated installed games, saves, licenses and media assignments remain unchanged.
- Login fields no longer get blocked by a hidden new-game modal. The announcement opens only after login; deferring it does not dismiss it. Native edit context menus expose cut/copy/paste/select-all.

## Existing 7.0.1 / 7.0.2 Users

Some old installations lack the semver runtime dependency used by their updater. Publishing a new feed cannot repair code that is already unable to check it. Run the current Setup once over the existing installation. Do not uninstall or delete game/settings folders. Future checks then use the corrected implementation.

## Approval

Gift IDs in order: 5879, 6064, 5827, 6427, 6104, 17473, 5658, 5655, 5319, 5282, 5269, 5994, 8913.
The publisher explicitly retained the red 10-coin heart 5282 and the 20-coin flower bouquet 17473. Similar-name alternatives 6247, 10994 and 13913 were not assigned.

## Verification

- Browser integration: connector-shaped likes 100/200/300 produce 50/100/150 meters, follow adds 50, backward settings subtract 50, busy queue recovers, reload preserves settings.
- Packaged driving backend: all 13 gift IDs route to the expected commands with their saved parameters; save/restart retains edits; all approved catalog PNGs return successfully.
- Isolated native driving game: all 13 saved gift bindings executed successfully in the actual Unity game, including 500-meter movements. Cage release subtracts the configured one second. QA input is isolated from real keyboard shortcuts. These were local gift tests, not purchased live gifts.
- Real Electron login test: clicking both fields, keyboard copy/paste, native context menu and native paste succeeded. Hidden announcements cannot intercept login input; their post-login dismissal remains effective.
- Isolated tests cover old placeholder recovery, exact backup, custom mapping preservation, update fallback validation, independent game installs and launch lifecycle.
- Full launcher regression suite: 968 passed, zero failed. Packaged 7.0.5 startup reports 16 games and 285 media records. Windows NSIS path tests passed for fresh, existing and explicitly selected installation paths.
- Public GitHub game downloads: both SHA-256 values verified, both packages installed, saved settings survived, updating the second game left the first game's active pointer and settings unchanged. Reopening the library retained both paths. Browser social-action tests also passed against the publicly downloaded Vak Vak Jump package.
- Real read-only TikTok observation on serkanwstt: connected; 17 like packets, one gift packet and comments received in the bounded observation. No gifts or comments were sent.
- A second read-only observation also received follows and streak gifts: 21 like packets, one follow and four raw gift packets (two forwarded after streak deduplication), with no connection errors.
- Published launcher download: all 245,163,489 bytes downloaded successfully. SHA-256 matched the official GitHub asset digest; SHA-512 matched the public latest.yml feed. Packaged 7.0.4 detected 7.0.5 and displayed its update dialog without installing anything or touching the user's profile.
- Synthetic gift injection is not evidence of 13 distinct purchased live gifts. Long-term uptime and every possible external network failure cannot be guaranteed by this test.

## Delivery

Game assets: game-hotfix-7.0.5. Launcher: v7.0.5. Content catalog revision: 5.
Google Drive upload and final Render deployment are the publisher's last steps. Do not announce Render as updated before its live version and catalog are checked.
