# Release and production readiness

## 0.1.0 pre-release validation

Validated on the development Mac:

- JavaScript syntax and manifest/asset checks.
- 31 automated tests covering observation fixtures, timestamps, deduplication, replies, navigation, trusted senders, request construction, probability validation, network failures, daily budget and pause during an outstanding request.
- Universal macOS app builds for arm64 and x86_64 with local ad-hoc signing.
- Native setup app opens through macOS UI and displays the expected controls.
- Safari recognizes the packaged extension, grants Gmail-only access and the popup successfully reads native key status/configuration.
- Local signature verification.
- Direct native floating-window test: panel visible in accessibility and confirmed by the user. Extension-to-app handoff also verified: native diagnostics confirm panel visibility and system acceptance. Visible macOS banner/sound still need user confirmation.
- Live Gmail inbox heartbeat and row extraction verified after adding nested thread-ID lookup.
- Classic background bundle emits ASCII Unicode escapes; a regression test verifies Spanish notification accents. Live accent confirmation remains pending.

**Still required before calling the release production-ready:**

- [x] Enable the packaged extension in Safari and confirm native messaging works.
- [ ] Complete temporary background reading and restoration validation. A real arrival was detected and opened, but the original asynchronous reader response failed; the message was manually restored to unread. Reader-initiated completion and a pending-reader retry are now implemented and await the live retest.
- [x] Save a real TypeSafe key through the extension; confirm native Keychain status (deletion remains covered by code review, not a destructive live test).
- [x] Run a synthetic live API connection test and confirm its typed response. The original sample returned 31%; the improved prompt/sample needs another measurement.
- [ ] Complete new-arrival and inbox-category checks. Current live inbox selectors and Spanish date parsing produce a healthy heartbeat; English date parsing is fixture-tested.
- [ ] Confirm notification authorization is shared correctly between app and extension, delivery, sound and click-to-Gmail behavior.
- [ ] Observe background-tab suspension, Safari restart, duplicate tabs, empty inbox, offline recovery and fresh-session baselines in live Safari.
- [ ] Measure false positives/negatives against opt-in representative sanitized emails in English and Spanish; tune threshold if necessary.
- [ ] Test on macOS 14+ target versions rather than relying only on the deployment target.
- [ ] Review a final privacy/security diff; verify no keys or real email fixtures are included.
- [ ] Sign/notarize a consumer binary or submit to the App Store with authorized Apple credentials if easy consumer installation is required.

Publishing a GitHub repository does not complete these checks. Do not label a pre-release as stable or imply that a user can install the web folder alone while retaining native features.

## Reproducible source build

`npm ci && npm run check && npm test && npm run build:mac`.

Xcode 27's packager generates the Xcode project under ignored `build/`. The script installs the reviewed Swift sources, enables outbound networking for both sandboxed targets, sets macOS 14 as deployment target and builds both architectures. Generated projects contain local absolute build paths and are not committed. The complete source and lockfile are committed.

`dist/GmailJev-macOS.zip` and `dist/SHA256SUMS.txt` are local artifacts. Rebuild after any code change. The build is reproducible in procedure, not bit-for-bit due to generated IDs, build metadata and signatures. Do not upload local debug logs or generated user metadata.

## GitHub

The public repository contains source, docs, tests and CI. Pre-release binary publication is optional and must explicitly disclose ad-hoc signing, unsigned-extension requirements and remaining validation. No Apple certificates or provider keys belong in the repository or release assets.
