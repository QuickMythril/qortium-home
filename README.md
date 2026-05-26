# Qortium Home

Qortium Home is an early preview desktop application for managing
Qortium/Qortal-compatible wallets, checking a configured node, and browsing QDN
content from one simple interface.

The current application is intentionally smaller than Qortal Hub. Qortal Hub is
used as a compatibility and integration reference, but Qortium Home is focused
on account management, QDN browsing, and a browser-like foundation that can grow
into account-aware tabs over time.

## Status

This project is in active early development. Wallet support and QDN rendering
are useful for testing, but they have not had a production security review.

Do not use wallets containing meaningful funds in this application until the
wallet flows, signing flows, and release builds have been reviewed and tested
more broadly.

## Current Features

- Create a new encrypted wallet backup file.
- Load Qortal Hub-compatible encrypted wallet files.
- Save loaded wallet metadata in the local Electron app data folder.
- Keep wallets locked after restart and unlocked only for the current session.
- Select, unlock, lock, and remove saved wallets.
- Show node status for the configured node.
- Switch between a local node, Previewnet network discovery, and one saved custom node.
- Browse QDN services, names, and resources from `qdn://` URLs.
- Load `APP` and `WEBSITE` resources in an embedded viewer.
- Load image-style QDN resources such as `IMAGE`, `THUMBNAIL`, and
  `QCHAT_IMAGE`.
- Load media-style QDN resources such as `AUDIO`, `VOICE`, `PODCAST`, and
  `VIDEO`.
- Load text-style QDN resources such as `JSON`, `METADATA`, `BLOG`, and
  `MESSAGE`.
- Download file-style QDN resources such as `DOCUMENT`, `FILE`, `FILES`, and
  `ATTACHMENT`.
- Browse read-only node API endpoints with paths such as `/admin/status`.
- Browse all public services for one name with `qdn://*/name`.
- Use session-only browser tabs with independent page history.
- Choose a separate selected wallet for each tab before navigating.
- Show the active tab's selected wallet as an avatar or initial in the top bar.
- Use in-session Back and Forward navigation history.
- Build Linux x64 and arm64 AppImages, macOS DMGs, and a Windows x64 portable executable.
- Build a first-pass Android debug APK with Capacitor.
- Package Linux, Windows, and macOS build resources with the Qortium Home app icon.

## Planned Work

- Additional derived addresses from the same wallet.
- `qdnRequest` support with approval prompts for account access and signing.
- Service-specific viewers for more QDN service types.
- Qortium Core download, setup, and local start/status management.
- Signed Android APK/AAB release packaging and Android wallet file flows.
- Code signing and release verification for production builds.

## Development Setup

Install dependencies:

```sh
npm install
```

Start the desktop development app:

```sh
npm run dev
```

Build the renderer and Electron main process:

```sh
npm run build
```

Run the built app locally:

```sh
npm start
```

## Release Builds

Build a Linux x64 AppImage:

```sh
npm run dist:linux:x64
```

Build a Linux arm64 AppImage:

```sh
npm run dist:linux:arm64
```

Build both Linux AppImage targets:

```sh
npm run dist:linux:all
```

Build a macOS x64 DMG on macOS:

```sh
npm run dist:mac:x64
```

Build a macOS arm64 DMG on macOS:

```sh
npm run dist:mac:arm64
```

Build a universal macOS DMG on macOS:

```sh
npm run dist:mac:universal
```

Build a Windows x64 portable executable:

```sh
npm run dist:win:x64
```

Sync the web app into the Android project:

```sh
npm run android:sync
```

Open the Android project in Android Studio:

```sh
npm run android:open
```

Build a local Android debug APK:

```sh
npm run dist:android:debug
```

Release artifacts are written to `dist-release/`. Generated build output should
not be committed to git.

The current Windows executable is a portable self-extracting build, not an
installer. It is unsigned and may show Windows SmartScreen warnings.

The current macOS DMG builds are unsigned and should be built on macOS. Local
test builds may require opening from Finder's right-click menu or approving the
app in macOS privacy and security settings.

The current Android build is an unsigned/debug-oriented Capacitor scaffold. It
requires a local Android SDK with Android Platform 36 and Build Tools 35
installed, SDK licenses accepted, and `ANDROID_HOME` or `ANDROID_SDK_ROOT`
pointing at the SDK. The debug APK output is generated under
`android/app/build/outputs/apk/debug/` with a filename like
`Qortium-Home-1.0.0-android-debug.apk`.

Regenerate Android launcher icons after changing `build/icon-source.png`:

```sh
npm run icons:android
```

Android currently connects to existing nodes only. By default it uses Previewnet
network discovery: it starts from the public seed API URLs, calls `/peers/known`,
converts discovered peer addresses to candidate API URLs, and uses a reachable
node for read-only QDN/API browsing. This requires seed nodes to expose public
read-only API access for `/admin/status` and `/peers/known`. Users can still
choose a custom LAN or remote node URL. Android wallet file creation/loading and
QDN file downloads are intentionally still desktop-only.

## QDN Preview Test Data

The development helper below is for local Previewnet testing only:

```sh
npm run qdn:bootstrap-test-data
```

It registers or reuses a local test name and publishes APP, WEBSITE, IMAGE,
AUDIO, VIDEO, JSON, and FILE fixtures that Qortium Home can browse. It expects a
running local Previewnet node and a local preview account with permission to
publish test resources.

Supported environment variables:

- `QORTIUM_HOME_NODE_API_URL`
- `QORTIUM_HOME_TEST_NAME`
- `QORTIUM_HOME_NODE_API_KEY`
- `QORTIUM_HOME_NODE_API_KEY_PATH`
- `QORTIUM_HOME_PREVIEW_ACCOUNTS_PATH`

Never commit node API keys, private account files, wallet files, seed material,
or local preview secrets.

## Documentation

- Project plan: [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)
- Change log: [QORTIUM-HOME-CHANGELOG.md](QORTIUM-HOME-CHANGELOG.md)

## License

Qortium Home is licensed under the BSD Zero Clause License (`0BSD`). You may
use, copy, modify, and distribute it for any purpose, with or without fee, and
no attribution is required.
