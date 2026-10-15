# Contributing

Use Node 22+, Xcode 27 and Python 3. Run `npm ci`, `npm run check`, `npm test` and, on a Mac, `npm run build:mac` before submitting changes. CI uses synthetic fixtures only. The web extension has no runtime npm dependencies.

For Gmail adapter issues, include a minimized **synthetic** DOM fixture and Gmail UI language, never your inbox HTML or screenshots containing private messages. Preserve the default no-history baseline, account separation, reply deduplication, timestamp eligibility, pause invalidation and daily reservation behavior.

For Jev changes, read the current official TypeSafe API contract and Noul guidance. Keep user instructions separate from untrusted email data. Retain raw probabilities; test threshold changes against labeled examples rather than assuming one threshold works universally. Pin models when publishing validation results.

Do not add remote code, telemetry, broad host permissions, plaintext key storage, implicit provider requests on page load or Google private endpoints. Document any new data transmission. Before stable publication, complete [RELEASE.md](docs/RELEASE.md).
