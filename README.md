# Qortium Home

Qortium Home is an early preview desktop application for managing
Qortium/Qortal-compatible wallets, checking a configured node, and browsing QDN
content from one simple interface.

The current application is intentionally smaller than Qortal Hub. Qortal Hub is
used as a compatibility and integration reference, but Qortium Home is focused
on account management, QDN browsing, and a browser-like foundation that can grow
into tabs and per-tab account contexts later.

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
- Switch between the Qortium Previewnet node preset and one saved custom node.
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
- Use in-session Back and Forward navigation history.
- Build a Linux x64 AppImage and a Windows x64 portable executable.

## Planned Work

- Per-tab account selection.
- Additional derived addresses from the same wallet.
- `qdnRequest` support with approval prompts for account access and signing.
- Service-specific viewers for more QDN service types.
- Qortium Core download, setup, and local start/status management.
- Linux arm64, macOS DMG, and Android APK packaging.
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

Build a Windows x64 portable executable:

```sh
npm run dist:win:x64
```

Release artifacts are written to `dist-release/`. Generated build output should
not be committed to git.

The current Windows executable is a portable self-extracting build, not an
installer. It is unsigned and may show Windows SmartScreen warnings.

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
