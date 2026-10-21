# TikMnG - TikTok Developer Application Draft

Prepared: 21 October 2026. This is a draft, not a submitted or approved application.
The existing portal entry was visible as **MNG TikTok Game**. Its detailed fields,
review status and rejection reasons have not been inspected: browser access was
disabled before the entry could be opened. Do not create a duplicate application.

## App Name

TikMnG

Use the same name in the desktop application, icon, website and developer portal.
The previous name includes TikTok's company name; use our own product name instead.

## Short Description

TikMnG is a Windows creator toolkit for interactive games, customizable stream overlays and local media controls.

## Detailed Description

TikMnG is an independent Windows desktop platform for livestream creators. It
organizes interactive games, configurable broadcast overlays and local video and
audio effects in a single launcher. Creators choose their own content and settings,
preview interactions before broadcasting, and control their broadcast tools from
their own computer.

We are implementing TikTok Login Kit to let creators voluntarily authenticate their
TikTok account through TikTok's authorization page. Basic profile information is
intended to identify the connected account in the launcher and show its display
name and avatar. TikMnG does not request the user's TikTok password in its own UI.

Login Kit authentication and livestream-event connectivity are separate features.
We do not claim that Login Kit grants access to LIVE gifts, comments or likes.
Any additional LIVE integration requires a separately authorized and documented
TikTok integration path. TikMnG is not an official TikTok product or an endorsed
TikTok partner.

## Requested Product And Scope

- Product: Login Kit for Desktop; use the sandbox for implementation and testing.
- Scope: `user.info.basic` only for this initial login feature.
- Intended data: TikTok open ID, display name and avatar, as authorized by the user.
- Do not request video publishing, uploads, private messages, research access,
  account statistics, or data portability for this feature.

## Scope Justification

`user.info.basic` is needed to associate the creator's TikTok authorization with
their TikMnG account and display the connected profile's name and avatar. It is not
used to post content, access private messages, purchase gifts, or obtain livestream
events. The user starts authorization themselves, can deny consent, and must be
able to disconnect the account and revoke authorization.

## Proposed Desktop Authorization Flow

Implementation requirements, not claims of a completed integration:

1. The creator selects Continue with TikTok in TikMnG.
2. TikMnG opens TikTok's official authorization page in the system browser.
3. TikTok handles sign-in and asks the user to approve `user.info.basic`.
4. A registered loopback callback receives the authorization response. A random
   anti-forgery state and a fresh PKCE verifier/challenge protect every attempt.
5. Our server exchanges the authorization code. The client secret and refresh
   tokens must not be embedded in, or exposed through, the desktop renderer.
6. The launcher displays only the connected account's name/avatar and connection
   status, and provides a disconnect action. Cancellation and expired authorization
   return a clear error without replacing a valid connection silently.

The exact callback URI must match the implemented callback and portal setting.
Do not enter an example URI as though it were an implemented endpoint.

## Website References

- Website: https://mng-license-server1.onrender.com/
- Privacy policy: https://mng-license-server1.onrender.com/privacy.html
- Terms of service: https://mng-license-server1.onrender.com/terms.html

These three public pages returned HTTP 200 on 21 October 2026. Their portal
ownership-verification state has not been inspected. The existing ownership signature
file must not be changed or replaced with an invented verification token.

## Reviewer Demonstration Plan

Record the real sandbox implementation, not a mock success page:

1. Open the current Windows application and show the TikMnG name/icon.
2. Select Continue with TikTok and show the official TikTok authorization page.
3. Show requested scope and user consent without exposing passwords or codes.
4. Return to the launcher and show the authorized display name and avatar.
5. Disconnect and demonstrate the cancellation/error path.
6. Show the public website and visible privacy/terms links.

Do not upload a demonstration that pretends the missing OAuth feature already
works. Test credentials, if requested by reviewers, must be generated specifically
for review and supplied through the intended secure channel, not committed here.

## Review Explanation Once The Sandbox Flow Is Verified

The following text is for use only after those implementation checks pass:

> TikMnG requests Login Kit for Desktop with the user.info.basic scope. The attached
> demonstration shows a creator starting authorization from our Windows launcher,
> signing in on TikTok's own authorization page, granting consent, and returning to
> TikMnG, where the authorized profile's display name and avatar identify the
> connected account. We also demonstrate disconnect and authorization cancellation.
> No content-posting, private-messaging, research, or data-portability permissions
> are requested. Login Kit is used for account authentication only, not as a claim
> of access to TikTok LIVE gifts, likes or comments. Our website provides publicly
> accessible privacy and terms pages explaining the integration and data handling.

## Remaining Submission Gates

- Inspect existing app details, product selection and the actual review response.
- Complete real Login Kit sandbox authorization and disconnect/revoke handling.
- Confirm token storage, callback validation and privacy disclosures match reality.
- Verify the website, privacy and terms URL ownership in the portal.
- Record and attach the current end-to-end sandbox demonstration.
- Review any required legal declarations before final submission.
- Submit only when the above are true. Approval remains TikTok's decision.

## Official References

- https://developers.tiktok.com/docs/en/getting-started-create-an-app
- https://developers.tiktok.com/docs/en/app-review-guidelines
- https://developers.tiktok.com/docs/en/login-kit-desktop
- https://developers.tiktok.com/docs/en/tiktok-api-scopes
