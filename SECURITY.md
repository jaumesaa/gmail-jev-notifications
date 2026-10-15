# Security policy

This is pre-release software. Do not use it as an emergency, security incident or guaranteed-delivery alerting system.

Report potential vulnerabilities privately to the repository owner via a GitHub private vulnerability report if available, or request a private contact channel without including secrets. Never put API keys, private emails or screenshots of private inboxes in public issues.

## Trust boundaries

- Gmail text is untrusted data. User notification criteria are separate instructions. Prompt injection remains a model limitation; a hostile preview could influence a relevance decision. The model cannot execute code, navigate links or read secrets.
- Key commands require an extension-origin sender; Gmail-origin messages are restricted to bounded email previews and heartbeat data. Content scripts cannot call native messaging directly under Safari's model.
- Native requests only reach the official TypeSafe HTTPS endpoint. Redirects are rejected, response bodies are bounded before parsing and no provider error body is reflected into the UI.
- UI output uses textContent, not innerHTML. Extension CSP disallows remote scripts, direct fetch/connect and object content. There is no remotely downloaded executable code.
- Keychain secrets are never returned to JavaScript. A compromised extension UI or local machine remains outside this protection boundary.
- The daily automatic allowance caps calls, not currency. Manual connection tests and ambiguous network retries can still consume provider credits.

- The `gmailjev://notice` scheme accepts bounded notification payloads and Gmail-only destinations, but is not an authenticated channel. Other local software or a site invoking the scheme can spoof a card. Do not treat a card as proof of an authentic sender or verified Jev decision. The scheme cannot read keys/mail, call TypeSafe or change settings.

## Distribution

Build locally from audited source when possible. The generated development app is ad-hoc signed, not notarized and not verified by Apple. Permitting unsigned extensions weakens Safari's normal extension trust requirement for that session. Do not disable Gatekeeper globally or remove security controls automatically. A stable consumer release requires signed/notarized artifacts and a completed release checklist.
