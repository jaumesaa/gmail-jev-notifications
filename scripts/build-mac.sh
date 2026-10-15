#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/bundle.mjs
node scripts/check.mjs
mkdir -p build dist
xcrun safari-web-extension-packager extension --project-location build --app-name GmailJev --bundle-identifier io.github.jaumesaa.GmailJev --swift --macos-only --no-open --no-prompt --force
cp native/SafariWebExtensionHandler.swift 'build/GmailJev/GmailJev Extension/SafariWebExtensionHandler.swift'
cp native/ViewController.swift build/GmailJev/GmailJev/ViewController.swift
cp native/AppDelegate.swift build/GmailJev/GmailJev/AppDelegate.swift
# Both targets need outbound networking. No app groups or developer account required to compile.
python3 - <<'PY'
from pathlib import Path
import plistlib
p = Path('build/GmailJev/GmailJev.xcodeproj/project.pbxproj')
s = p.read_text().replace('ENABLE_APP_SANDBOX = YES;', 'ENABLE_APP_SANDBOX = YES;\n\t\t\t\tENABLE_OUTGOING_NETWORK_CONNECTIONS = YES;')
s = s.replace('MACOSX_DEPLOYMENT_TARGET = 27.0;', 'MACOSX_DEPLOYMENT_TARGET = 14.0;').replace('MACOSX_DEPLOYMENT_TARGET = 12.0;', 'MACOSX_DEPLOYMENT_TARGET = 14.0;')
s = s.replace('MARKETING_VERSION = 1.0;', 'MARKETING_VERSION = 0.1.0;')
p.write_text(s)
info = Path('build/GmailJev/GmailJev/Info.plist')
settings = plistlib.loads(info.read_bytes())
settings['CFBundleURLTypes'] = [{'CFBundleURLName':'GmailJev notice', 'CFBundleURLSchemes':['gmailjev']}]
info.write_bytes(plistlib.dumps(settings))
PY
xcodebuild -project build/GmailJev/GmailJev.xcodeproj -scheme GmailJev -configuration Release -derivedDataPath build/DerivedData CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= MACOSX_DEPLOYMENT_TARGET=14.0 ARCHS='arm64 x86_64' ONLY_ACTIVE_ARCH=NO build
ditto build/DerivedData/Build/Products/Release/GmailJev.app dist/GmailJev.app
ditto -c -k --sequesterRsrc --keepParent dist/GmailJev.app dist/GmailJev-macOS.zip
shasum -a 256 dist/GmailJev-macOS.zip > dist/SHA256SUMS.txt
printf '\nBuilt dist/GmailJev.app (local ad-hoc signature; not notarized).\n'
