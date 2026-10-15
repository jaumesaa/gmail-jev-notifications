# Gmail notifications with Jev

An open-source Safari extension for Mac. Write your notification policy in natural language; Jev evaluates new Gmail messages detected in the visible inbox. Matches produce a floating window above other apps and a macOS notification; either channel can also be selected separately. Configure your own official TypeSafe API key inside the extension. Keys are held in macOS Keychain. No Google Cloud project, Gmail OAuth setup or author-operated backend.

**Pre-release 0.1.0; not yet validated end-to-end in live Safari/Gmail.** Automated tests and a universal macOS build exist; Live API connectivity, Keychain saving and the floating panel were checked on the development Mac. Live Gmail reading/restoration and system notification delivery remain on the [release checklist](RELEASE.md).

Gmail must remain open to the Inbox list. Background tabs work only while Safari keeps them loaded. This detects rendered inbox previews. Default full-reading mode opens each new message in a temporary background tab, reads the latest body (up to 12,000 characters), restores unread state if applicable and closes the tab after confirmation. Preview-only mode is also available. No attachments or closed-browser monitoring. If unread restoration fails or Safari quits during reading, manual review may be needed. English/Spanish visible timestamps are supported; unsupported formats are skipped. Gmail DOM changes may require maintenance. Model decisions can be wrong.

The extension is free; API calls use your own paid TypeSafe balance. Every evaluation includes sender, subject, timestamp and snippet; full-reading mode also discloses body and available recipients to TypeSafe. Read [Privacy](../PRIVACY.md).

Build with Xcode 27, Node 22+ and Python 3:

```sh
npm ci
npm test
npm run build:mac
```

Open `dist/GmailJev.app`, enable development extensions in Safari, grant access to Gmail, allow app notifications, save your key in extension settings and activate your policy. A development build is ad-hoc signed, not notarized; loading only the web folder does not provide the required native component. Public easy-install distribution needs a separate signing/notarization/App Store process. See [Installation](INSTALL.md) and the main [Spanish README](../README.md).

MIT licensed. Independent project; not affiliated with Google, Apple, Twitch or TypeSafe.
