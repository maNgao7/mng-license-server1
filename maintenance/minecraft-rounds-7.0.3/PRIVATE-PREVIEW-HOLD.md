# Private Acceptance Hold

## Approval Received (2026-10-27)

The user has now approved publishing only the two game updates. The private
acceptance run completed on the actual administrator launcher: both native
arenas loaded, both connected to the authorized broadcaster, 10/16 saved gift
rules and settings were retained, and the stable launcher/pointers were unchanged.
The previous hold below is historical, not an instruction to block this approval.

No launcher UI update is authorized or included. The existing launcher shows
"Oyunu guncelle" when updateAvailable is true. Its existing Play button behavior
is intentionally unchanged. The launcher remains 7.0.6.

The approved release will activate catalog revision 7 after server deployment.
Public asset and deployed-catalog checks are recorded separately; publication of
GitHub assets alone is not evidence that Render has deployed the new catalog.

## Previous Hold

The user requested administrator-preview testing before the public game update.
The public content defaults therefore remain exactly at revision 6, with both
Minecraft games at 7.0.2. Restarting/deploying the server must not promote these
two candidate packages. The public launcher remains 7.0.6.

The GitHub minecraft-rounds-20261027 release has been returned to draft. Its
assets are retained for approval, not distributed through the public catalog.
The earlier public-download report records a historical check before this hold.

The candidate catalog is retained under qa/catalog-candidate.json for later
explicit publication only after the user approves private testing.

Local administrator game versions: 7.0.3-preview.1 (both games).
Their package metadata belongs only to the private launcher's admin-games.json.
The user's stable launcher program and stable game activation pointers must not
be modified while installing this private preview.
