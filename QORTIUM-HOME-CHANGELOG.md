# Qortium Home Change Log

This is the main human-readable record of the Qortium Home application effort.
It is written for non-developers first, with the goal of making each change
easy to follow without reading code.

## What Qortium Home Is

Qortium Home is a simple user interface for managing Qortium/Qortal-compatible
wallets, connecting to a configured node, browsing QDN content, and viewing
chain/API data.

The aim is to keep the application focused and understandable. Qortal Hub can
be used as a reference for compatible wallet behavior, QDN concepts, and native
app patterns, but Qortium Home should remain a smaller application with its own
clear scope.

## Early Goals

- keep the history clean and easy to read
- make each logical change its own commit
- explain every meaningful change in plain language
- keep early implementation choices documented before code grows around them
- preserve compatibility decisions separately from future implementation details

## How To Use This File

- update this file with every intentional Qortium Home commit
- use one entry per commit
- make each entry title match the commit message exactly
- keep each entry to one combined plain-language description
- keep entries understandable to non-developers
- use this file as the public narrative of the application, alongside the
  technical git history

## Change Entries

### 2026-05-26 - app: add android capacitor scaffold

Added the first Android scaffold for Qortium Home using Capacitor. The shared React UI can now be synced into an Android project, a debug APK build command is available, Android uses Qortium Home launcher and splash assets, Android can persist node settings and browse read-only node/QDN data through a fallback platform bridge, and wallet file flows remain desktop-only until the Android storage model is designed.

### 2026-05-26 - release: bump app version to 1.0.0

Changed the Qortium Home package version from `0.1.0` to `1.0.0` before the first public release so generated desktop artifacts use the reset 1.0.0 version line and avoid pre-1.0 macOS packaging issues.

### 2026-05-26 - build: add mac dmg target

Added first-pass macOS DMG packaging for Qortium Home. The build configuration now uses the tracked macOS icon, adds unsigned x64, arm64, and universal DMG commands for native macOS testing, and documents the expected local Gatekeeper warnings for early unsigned builds.

### 2026-05-26 - build: add mac icon

Added a tracked macOS `.icns` version of the Qortium Home app icon, generated from the existing icon source so the upcoming macOS DMG setup can use the proper native icon without requiring a separate manual icon conversion step.

### 2026-05-26 - build: add linux arm64 appimage target

Added Linux arm64 AppImage packaging alongside the existing Linux x64 target. The Linux electron-builder configuration now lets the command-line architecture flags choose the output, and the README documents separate x64, arm64, and combined Linux AppImage build commands.

### 2026-05-26 - build: add app icon

Added the Qortium Home prototype icon to tracked build resources, generated Linux and Windows icon assets from it, wired the icon into Electron's runtime window, and configured electron-builder so Linux AppImage and Windows portable builds no longer use the default Electron icon.

### 2026-05-26 - app: show selected account chip

Added a compact selected-account chip to the top bar for each tab. The chip resolves the account's primary registered name, falls back to the first owned name or saved wallet label, shows a published Qortal avatar when available, and exposes the resolved name, address, and wallet label in a hover tooltip.

### 2026-05-26 - app: assign accounts per tab

Changed account selection from a single Home-only wallet selector into tab-aware state. Each new tab starts with the current default wallet, the Home account selector changes only that tab's selected wallet, and navigating from Home carries that selected account with the tab so different tabs can keep different account contexts for future QDN app requests and signing prompts.

### 2026-05-26 - app: fix tab selection after drag update

Fixed tab selection after the live reshuffle drag update so a normal click on an inactive tab switches to that tab again while dragged tabs still reorder in place without triggering an unwanted selection afterward.

### 2026-05-26 - app: reshuffle tabs while dragging

Changed browser tab dragging so tabs reorder in place while the user drags across the tab strip, without showing a placement marker or detached native drag preview, while keeping click selection, close controls, middle-click close, and new-tab gestures intact.

### 2026-05-26 - app: improve tab interactions

Improved browser tab behavior by allowing the last tab to close into a fresh Home tab, adding middle-click close, double-click empty tab space to open a new tab, drag-and-drop tab reordering, and tightening the tab and top-bar spacing so the browser controls take up less room.

### 2026-05-26 - app: add browser tabs

Added first-pass browser tabs with independent navigation history for each tab. Users can open new Home tabs, switch between tabs, close every tab except the last one, and use the address bar plus Back and Forward controls against only the active tab while the existing QDN and node API viewers continue to render through the current React viewer system.

### 2026-05-26 - app: fix qdn download filenames

Changed QDN resource downloads so the native save dialog receives an absolute default path using the resource filename when available. This keeps the save location in a normal Documents or home folder while reliably pre-filling the filename field for file, text, image, audio, and video resource downloads.

### 2026-05-26 - app: add qdn media viewers

Added simple native media playback for QDN AUDIO, VOICE, PODCAST, and VIDEO resources. Qortium Home now treats these media services as openable resources, shows audio or video controls once the resource is ready, keeps copy/download/details actions available, uses media-specific row icons in explorer lists, and extends the local Previewnet bootstrap helper with small generated AUDIO and VIDEO fixtures for testing.

### 2026-05-26 - app: add node configuration

Added a persisted node configuration flow to the node status popover. Qortium Home now starts with the Qortium Previewnet preset, can save one custom node URL, allows unreachable custom nodes to remain selected while showing them as unavailable, and routes node status checks, QDN browsing, QDN rendering, and direct node API viewing through the configured node instead of separate hardcoded URLs.

### 2026-05-26 - app: add direct node api viewer

Added read-only direct node API browsing from the address bar. Users can now enter paths such as `/admin/status` or full URLs for the configured local node, and Qortium Home loads the response through Electron, formats JSON when possible, shows HTTP status and response details, and provides copy controls without exposing node access directly to rendered page code.

### 2026-05-26 - app: update previewnet api port

Changed the Qortium Previewnet preset from `localhost:62391` to `localhost:24891` across the app, the Electron QDN bridge, the local bootstrap helper, and the project plan so Qortium Home matches the current local Previewnet core settings.

### 2026-05-26 - app: add qdn text and download viewers

Added first-pass QDN viewers for text and file-style resources. JSON, metadata, blog, comment, message, and code resources can now open as inline text previews with copy and download controls, while document, file, files, and attachment resources show a ready download/details view. QDN list queries, raw text fetches, and downloads go through Electron so packaged builds avoid renderer fetch failures and the node API key is not exposed to page code, and the local Previewnet bootstrap helper now also publishes JSON and FILE fixtures for testing the new viewers.

### 2026-05-25 - docs: add 0BSD license

Added the BSD Zero Clause License to Qortium Home, updated package metadata to use the `0BSD` SPDX identifier, and changed the README license section to explain that reuse, modification, and redistribution are allowed without attribution.

### 2026-05-25 - docs: add public readme

Added the first public README for Qortium Home with the project purpose, early-development status, current and planned features, local development commands, release build commands, Previewnet-only QDN test-data helper notes, documentation links, and the current no-license status.

### 2026-05-25 - build: add windows portable exe target

Added a Windows x64 portable executable release target that can be built locally from Linux with electron-builder. The first Windows output is a single unsigned portable `.exe`, with Windows executable resource editing disabled for now so the build does not require 32-bit Wine support.

### 2026-05-25 - app: add qdn history and wildcard name browsing

Added right-click history menus to the Back and Forward buttons, changed an empty address-bar submit to open the QDN root explorer, and added `qdn://*/name` browsing so users can list every public QDN service published by one name before opening a service-specific view.

### 2026-05-25 - app: fix qdn explorer missing status labels

Changed QDN explorer list rows so resources returned without status data show a stable Published label instead of a Checking label that never updates. Direct resource loading still checks and polls resource status before opening the viewer.

### 2026-05-25 - app: add qdn image row previews

Added small image previews to QDN explorer resource rows for public image-style services. IMAGE, THUMBNAIL, and QCHAT_IMAGE resources now share the single-image viewer and show previews in resource lists when the local node can render them, while gallery browsing and image editing controls remain intentionally deferred.

### 2026-05-25 - tooling: add qdn test data bootstrap

Added a reusable local preview bootstrap command that registers the Qortium Home test name with the local preview account and republishes APP, WEBSITE, and IMAGE QDN fixtures after a chain reset. The command uses the node API key and local preview secrets, builds the zero-fee name registration transaction for MemoryPoW, computes the arbitrary-data nonce for QDN publishes, and reports the qdn:// links that Home can use for testing.

### 2026-05-25 - app: load image qdn resources

Added a shared QDN resource loading path that can authorize public QDN services, poll resource status, trigger downloads, and hand ready resources to service-specific viewers. APP and WEBSITE still load in the iframe viewer, IMAGE and THUMBNAIL resources now open in an image viewer, and other public services can reach a ready detail state until dedicated viewers are added.

### 2026-05-25 - app: improve qdn explorer navigation

Changed the QDN explorer root so it only shows public services that currently have published resources, and added browser-style Back and Forward buttons beside the address bar so users can move through QDN pages and return to Home without retyping addresses.

### 2026-05-25 - app: expand qdn explorer services

Expanded QDN explorer browsing from APP and WEBSITE only to a broader set of public QDN services, including media, document, file, JSON, blog, store, game, and message-style services. APP and WEBSITE still load in the viewer, while other services can be browsed as lists until dedicated service viewers are added.

### 2026-05-25 - app: add qdn explorer routes

Changed QDN navigation so partial addresses work like a simple file explorer. Qortium Home can now open `qdn://`, service-level links such as `qdn://APP`, and name-level links such as `qdn://APP/QortiumHomeTest` as clickable explorer lists, while exact service/name/identifier links still load the selected APP or WEBSITE in the viewer.

### 2026-05-25 - app: add qdn address bar

Added a browser-style top bar with a QDN address field and moved the node status indicator into it. Qortium Home can now parse APP and WEBSITE `qdn://` links, authorize them against the local preview node without exposing the node API key to page content, show QDN loading and error states, and render ready QDN pages in a sandboxed iframe while keeping account management as the default home view.

### 2026-05-25 - app: fix wallet backup save dialog

Changed the new-wallet backup save dialog to start from an absolute Documents or home path, populate the suggested wallet backup filename reliably, and restore a JSON wallet file type filter while keeping `.json` extension enforcement in code.

### 2026-05-25 - app: improve wallet backup filenames

Changed new-wallet backup saves to suggest `{wallet name}_{address}.json`, remove the save dialog's verbose JSON file type filter, and still enforce a `.json` extension after the user chooses a path.

### 2026-05-25 - app: name and remove wallets

Added explicit local wallet names for New and Load flows, changed the selector to show only wallet names with the active address below, and added selected-wallet removal with password verification when the wallet is locked.

### 2026-05-25 - app: create new wallets

Added new wallet creation from Qortium Home. Users can enter and confirm a password, save the encrypted wallet backup file before the account is added, and start with the new account unlocked for the current app session.

### 2026-05-25 - app: load locked wallets

Added desktop wallet loading for Qortal Hub-compatible encrypted wallet files. Qortium Home now stores imported encrypted wallet data in its app data, remembers the selected account across restarts, and lets users unlock a wallet for the current session without writing decrypted seed data to disk.

### 2026-05-25 - app: add accounts shell

Added the first account-management shell below the Qortium Home title, with New and Load controls prepared for future wallet flows and a saved-account dropdown that stays hidden until non-secret account metadata exists.

### 2026-05-25 - app: persist window bounds

Added desktop window state persistence so Qortium Home saves its window size, location, and maximized state when the user changes them, then restores a safe saved window position on the next launch.

### 2026-05-25 - app: align detail list values

Adjusted shared detail-list layout so value columns fill the remaining panel width and right-aligned values visually line up at the right edge instead of sitting in a shrink-wrapped column.

### 2026-05-25 - app: correct node detail text styling

Changed the node status details so the node address uses the regular interface font instead of fixed-width text, while keeping the value column neatly right-aligned at normal window sizes and still responsive on narrow screens.

### 2026-05-25 - app: improve popover layout behavior

Added reusable popover behavior and shared detail-list styling so opened panels can close on outside clicks, keep technical values like node URLs readable, and resize more gracefully without awkward one-character wrapping or horizontal scrolling.

### 2026-05-25 - app: standardize typography sizes

Added shared typography size settings with a large default baseline for regular interface text, smaller support text, and restrained title sizing. This keeps most Qortium Home text consistent now and gives the future settings menu a clear place to adjust text size presets later.

### 2026-05-25 - app: add local UI fonts

Added local Lexend and Illinois Mono font files with their open font licenses. Qortium Home now uses Lexend as the primary interface font and Illinois Mono for fixed-width text, so the application typography is bundled with the app instead of depending on system fonts or an external font service.

### 2026-05-25 - app: add node status indicator

Added a small node status indicator to the main Qortium Home screen. It checks the default Qortium Previewnet node at `localhost:62391`, reports whether the node is unavailable, syncing, minting, or synced, and shows chain peers, data peers, block height, and sync percent in a compact details panel.

### 2026-05-25 - app: scaffold minimal Electron AppImage

Added the first runnable Qortium Home application scaffold with Vite, React, TypeScript, Electron, and electron-builder. The app currently opens to a minimal page that says `Qortium Home`, includes the build scripts needed for local development and Linux x64 AppImage packaging, and keeps generated dependencies and release artifacts out of git.

### 2026-05-25 - docs: record initial project plan

Added the initial Qortium Home planning document and changelog. The plan records the chosen React, Vite, TypeScript, Electron, electron-builder, and Capacitor Android stack; the first Linux x64 AppImage target; the initial one-page scope before tabs; Qortal Hub-compatible wallet import/export with future derived-address support; Qortium Previewnet and custom node connection options; and the features intentionally deferred until after the first testable scaffold.
