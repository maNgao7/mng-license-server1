# Turkish Forza 0.5.4

- The desktop launcher owns the live session. Its shared event feed sends authorized loopback events to the native bridge. Gift streak deltas use the event group, viewer and gift identifiers. Portrait events do not award coins.
- Portrait lookup uses the shared launcher cache and the live event's available image sizes. PNGs are written below the active Forza data directory in `control/live/portraits`; late portraits attach to the same viewer identity. Steam runtime files are excluded from the published game archive.
- Race records use the existing versioned and atomic results store under the game data directory. The starting grid still requires a manual start.
- The release gate passed. Native QA observed seven moving cars, a change from seventh to first after the gift boost, headlights, a finish view within 200 metres, and a clean reset. A separate native fixture verified late portrait delivery and preservation across another gift. An additional live TikTok session produced a gift racer with a visible portrait.
- The Windows start lock was tested with stale and active processes. The affected customer's computer was unavailable for direct testing. The 0.5.3 to 0.5.4 library update was verified after reopening it.
