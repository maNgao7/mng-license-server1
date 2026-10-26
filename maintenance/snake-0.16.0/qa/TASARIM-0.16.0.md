# Snake Control Center Reference Lock

Designing the native B control center for TikMnG streamers. Goal: identify waiting/battle/paused state, select a real participant and measure an effect without guessing. Keep the existing Minecraft font, native focusable controls and TikMnG mint/gold identity.

Refero live research was attempted; the service returned NO_SUBSCRIPTION. Local craft references reviewed: typography (compact scanning hierarchy), craft-details (labelled fields, never block paste), motion (feedback, not decoration). Existing native SnakeScreens is the primary product reference; the provided MNG Orbit rules screenshot supplies the secondary labelled two-column numeric layout.

| Decision | Source | Role | Reason |
|---|---|---|---|
| Charcoal canvas, mint active state, gold pending state | Existing SnakeScreens | State and primary action only | Preserve native game identity |
| Two-column B navigation and separate telemetry workspace | Craft scanning hierarchy | Compact operational layout | Reach tests and connection without nested menus |
| Explicit battle state and start command | Human manual O-start rule | Primary command | Waiting cannot be mistaken for broken AI |
| Target name, before/after mass, measured speed and travelled distance | Human test request | Results, not decorative counters | Validate the actual arena participant |
| Native editable fields and button focus | Minecraft existing UI / craft forms | Input | Keyboard/paste remains supported |
| Thick mint/gold/magenta trails above the mesh, short growth pulse | Existing effect tiers / human request / motion feedback | Action confirmation only | Readable from overview without persistent particles |

Reject marketing cards, decorative gradients, hero-size headings and mock telemetry. Render and check 800x450 and smaller GUI dimensions. Keep O battle start, Tab publisher and existing saved rules.
