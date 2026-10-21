# Zombie War Gift Standards v11

The 15 mappings in `standard-gifts.json` are the requested distribution defaults.
The PNG is the user's unmodified 8091 x 4695 image. Its SHA-256 is
`9c8fab556afa507002232f1ef99e0c5b5edde0aaf35e5c74c95fcabf7dce7f52`.

| Gift | ID | Action |
| --- | --- | --- |
| Gul | 5655 | 2 zombies |
| Blue Bead | 5319 | 5 zombies, not the previous 10 |
| Donat | 5879 | 3 helpers |
| Parfum | 5658 | Flash, existing 5-second duration |
| Buket | 17473 | Infinite ammunition, existing 300-second duration |
| Rosa | 8913 | Upgrade weapon |
| Cay | 5303 | Voice fire, 180 seconds |
| Kalp | 5282 | Downgrade weapon |
| Mishka Bear | 5486 | Mutant |
| Sapka ve Biyik | 6427 | Chaos |
| Para Tabancasi | 7168 | Voice fire, 300 seconds |
| Turk kahvesi | 5994 | 5 spiders |
| Corgi | 6267 | Clear enemies |
| Galaksi | 11046 | Voice fire, 600 seconds |
| Beni Sev | 7934 | 1 helper |

On the first load of settings older than v11, only `gift:` rules are replaced.
Existing like/follow/share rules, map, player health and weapon preferences remain.
The migrated settings are saved by the existing atomic settings writer. The migration
does not repeat on later launches, so subsequent user edits remain saved.

The original game source tree is no longer available at its old build path. The patch
therefore preserves the original JAR and every class except a small config-load hook.
`StandardGiftRules.java` implements the migration as an ordinary compiled Java class.
`PatchGiftStandards.java` replaces the embedded download image and adds the hook at
both return paths of the original `GameConfig.load`. It refuses unfamiliar method
layouts, signed archives, duplicate entries, or an already-patched mod.

## Rebuild And Verify

Run `build-gift-patch.ps1` with an existing complete game directory and a new output
directory. Java 17-compatible bytecode is compiled. The actual patched `GameConfig`
is tested with isolated fixture directories, never the user's live configuration:

- Fresh install: exactly 15 gifts, correct amounts, targets and 180/300/600 timings.
- Existing v10 settings: extra gift mappings disappear; other settings survive.
- Restart: v11 remains saved and later user edits are not overwritten.
- The downloadable PNG resource exists in the mod at its original export path.

`install-gift-patch.ps1` checks hashes and makes a recoverable backup before replacing
the local mod. It refuses a running game or a different original mod version.

Publishing source does not update the previously released `zombie-war.zip`. A new
game package and catalog entry must be published separately after verification.
The launcher release must not be marked as available without a real installer.
