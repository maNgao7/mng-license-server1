# TikMnG 7.0.27 launcher preview

Apply these launcher files to the complete 7.0.26 source. The Hapisten Kaç guide
uses the existing YouTube link handling. The license card uses the active license's
existing expiry timestamp and warns during the final 30 minutes.

Run the existing launcher release gate, then run
`node --test tests/license-countdown.playwright.cjs` with `PLAYWRIGHT_MODULE`
and `MNG_QA_ELECTRON` set to the local Playwright module and Electron executable.
The preview test uses a synthetic license and isolated profile.
