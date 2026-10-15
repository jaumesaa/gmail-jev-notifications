# Privacy

No author-operated server, analytics, tracking, advertising or telemetry is included.

When enabled, visible new Gmail inbox previews are sent to the **official TypeSafe API**: sender names/email addresses, subject, received timestamp, unread state and up to 2,000 characters of preview, together with your notification criteria. In the default full-reading mode it also sends the latest message body (up to 12,000 characters, with a truncation flag) and up to 30 available recipient addresses. This is a disclosure to a third-party provider. Read [TypeSafe's policies](https://docs.typesafe.ai/legal) and your account's contractual terms; this project does not promise zero retention by TypeSafe.

The full mailbox, attachments, cookies and Gmail passwords are not collected. Individual message bodies are collected in the default reading mode; choose preview-only mode to avoid opening/reading them. A preview or body can contain sensitive information. There is no automated sensitive-data redaction; decide whether your mailbox is appropriate for this use before activating.

Your TypeSafe key is entered in an extension-owned settings page, transmitted to the native handler and stored in macOS Keychain. The Gmail content script cannot request it. Status returns only whether a key exists; evaluation uses it directly in native code. Saving the key does not validate it against TypeSafe; the explicit connection-test button does.

Local browser storage contains:

- criteria, active session, model, threshold and daily allowance;
- up to 50 queued preview records, with a 15-minute eligibility window (expired records are pruned when the queue next runs, not by an always-running deletion service);
- up to 2,000 SHA-256 deduplication fingerprints;
- up to 40 activity records containing timestamps, status, probability and answered model;
- daily counters and Gmail heartbeat metadata (account slot paths, not account email addresses);
- temporary reader-job metadata (tab ID, thread ID, token, original unread state and the bounded original preview record, so an interrupted read can be retried). Interrupted jobs remain for diagnosis; the temporary tab is left open if restoration cannot be confirmed. Body text is not persisted by the project, though Gmail itself loads it in its tab.

Pausing clears pending previews. Editing/saving criteria starts a new session and clears pending previews. Deleting the key pauses the filter. Use Clear local activity to remove activity records; browser-managed extension storage is separate from the Keychain item. The Keychain item must be deleted before uninstall, or later via Keychain Access (`GmailJev.TypeSafe`). It is not synchronized intentionally by the project. The shared Keychain entry is the same for all Safari profiles using this native extension; criteria/state remain under Safari's storage behavior.

Notifications contain original subjects and senders, which may be visible on the lock screen depending on your macOS notification preferences. Notification content is not added to the project's activity history.

The original subject, sender, Gmail destination and chosen notification style are handed from the native extension to its containing app in a local custom URL. This handoff does not contact an external server and requests no recent-items entry. The floating window displays this content above other applications until dismissed or replaced. Its contents exist in app memory; no notice contents are written to an application log. App diagnostics contain delivery status only. The system notification center may retain notifications according to macOS settings.
