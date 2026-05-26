# Qortium Home Project Plan

Last updated: 2026-05-26

## Purpose

Qortium Home is intended to be a simple, focused UI for account management and QDN browsing. It should not replicate Qortal Hub. Qortal Hub can be used as a reference for concepts, workflows, and integration details, but Qortium Home should remain a separate, smaller application with a narrower product surface.

## Decisions So Far

- Work from a single repository for the application.
- Keep the UI simple and focused.
- Use Vite, React, and TypeScript for the shared UI.
- Use Electron for the desktop application shell.
- Use `electron-builder` for desktop packaging.
- Use Capacitor Android for the Android APK, sharing the React UI where practical.
- Prefer Electron over Tauri for this project.
- Start with the Linux x64 AppImage target.
- Primary account-management features:
  - Create a new wallet/account.
  - Save a new wallet file.
  - Load an existing wallet file.
  - Track loaded wallets locally.
  - Select between loaded wallets.
  - Manage multiple accounts at the same time.
  - Support loading multiple wallet files.
  - Support switching between different loaded wallet files.
  - Support switching between different derived addresses from the same wallet.
  - Start with a simple account-management flow, then expand the address and wallet switching UI as the core model stabilizes.
- The application should be structured like a simple web browser:
  - Support session-only browser tabs.
  - Each tab can load a different page, QDN resource, app, website, or API endpoint.
  - Each tab has independent Back and Forward navigation history.
  - Each tab should be associated with its own selected account.
  - Different tabs should be able to use different accounts at the same time.
  - The active tab should show a compact account identity chip using the account avatar, registered name, address, and saved wallet label.
  - Future tabs should ideally isolate rendered app/web content from each other, especially when they use different accounts.
  - Treat strict tab isolation as more important on desktop than Android when Electron `WebContentsView` support is added.
- Primary QDN browsing features:
  - Browse `APP` services.
  - Browse `WEBSITE` services.
  - Support additional QDN service types such as `IMAGE`, `AUDIO`, and other available services.
  - Load image resources in a dedicated image viewer.
  - Load audio-style resources in a native audio player.
  - Load video resources in a native video player.
  - Load text-style resources in an inline text viewer.
  - Load file-style resources through a download/details view.
  - Load direct API endpoint URLs so users can inspect chain data inside the UI.
  - Support read-only direct node API endpoint viewing through the address bar.
  - Start with read-only API `GET` requests; defer authenticated or write-style API requests until explicit permission prompts exist.
  - Add `qdnRequest`-style requests from QDN apps later, similar to Qortal Hub.
  - When `qdnRequest` support is added, prompt the user before approving requests that are not read-only, especially signing requests.
  - Future permission prompts should show the selected account/address that will be used.
- Qortium Home should be able to manage the local Qortium Core setup:
  - Start with preinstalled or externally managed core support only.
  - Add release/prerelease download and local core setup later.
  - Eventually download the latest Qortium release from GitHub.
  - Eventually optionally download the latest Qortium prerelease from GitHub.
  - Eventually install or set up whatever is needed for the downloaded core.
  - Eventually run scripts included with the core to start it.
  - Show node status, including whether the node is connected and whether it has peers.
- Initial node connection options:
  - Qortium Previewnet preset: `http://127.0.0.1:24891`.
  - One saved custom node address entered by the user.
  - The selected node should persist across app restarts.
  - Unreachable custom node URLs may still be saved, with the UI showing the node as unavailable until it can connect.
- Android should connect to an existing node only. It does not need to download, install, or run Qortium Core locally in the initial direction.
- Use `~/git/Qortal-Hub` only as a reference, not as the product to clone.
- Target distributable builds:
  - Linux AppImage for x64.
  - Linux AppImage for arm64, wired as a separate electron-builder script.
  - macOS DMG.
  - Windows EXE.
  - Android APK.
- Linux, Windows, and macOS desktop builds should use the Qortium Home app icon from tracked build resources.
- Some target artifacts will need to be built or verified on their native systems, but the repo should be set up so each target can be tackled and tested one at a time.

## Stack Decision

The chosen starting stack is:

- Shared UI: Vite, React, TypeScript.
- Desktop shell: Electron.
- Desktop packaging: `electron-builder`.
- Desktop embedded content: start with React-managed tabs and the current iframe/resource viewers; add Electron `WebContentsView` isolation later.
- Android shell: Capacitor Android.
- First packaging target: Linux x64 AppImage.

This keeps the project aligned with the existing Qortal Hub and Qortal Mobile patterns without copying either application directly. It also gives the desktop app the process-control and embedded-browser primitives needed for future local core management, QDN app rendering, per-tab account context, and packaged releases.

Tauri is not the preferred stack for this project because the application will eventually need browser-like tabs, predictable desktop web rendering, and straightforward process management more than it needs the smallest possible installer size.

## Wallet Decision

Qortium Home should start by supporting Qortal Hub-compatible wallet files. A Hub wallet file is an encrypted seed container with fields such as `address0`, `encryptedSeed`, `salt`, `iv`, `version`, `mac`, and `kdfThreads`.

For compatibility, Qortium Home should be able to import and export that format. However, internally Qortium Home should not treat `address0` as the only usable account. The encrypted seed can derive multiple addresses, so Qortium Home should model derived addresses as separate selectable accounts.

The internal account model should distinguish:

- The loaded wallet file or encrypted seed container.
- The derived address index.
- The derived Qortium/Qortal address.
- The public key for that derived address.
- User metadata such as label, note, and whether the address is pinned or discovered.

The active page should refer to a selected account context, not just a global wallet. Each tab account context should identify the loaded wallet and, later, the derived address index or address. This allows one tab to use one wallet or derived address while another tab uses a different wallet file or derived address.

For the initial implementation, it is acceptable to keep the UI simple:

- Load one or more Hub-compatible wallet files.
- Require a local wallet name when loading or creating a wallet.
- Show wallet names in the active-wallet selector and show the selected wallet address below it.
- Persist imported encrypted wallet JSON in Qortium Home's Electron app data.
- Remember loaded wallets and the selected account across app restarts.
- Keep all imported wallets locked by default when the app starts.
- Unlock a wallet only after password verification against the Hub-compatible encrypted wallet data.
- Keep decrypted seed material in memory for the current application session only, never in persistent storage.
- Remove saved wallet entries from Qortium Home without deleting the user's wallet backup file, requiring the unlocked state or password verification before removal.
- Create new wallets from a secure random seed in the initial New flow.
- Require saving the encrypted wallet backup file before a newly created account is added to Home.
- Use `{wallet name}_{address}.json` as the default backup filename for newly created wallets.
- Start the wallet backup save dialog from an absolute Documents or home path so native pickers populate the filename reliably.
- Start newly created wallets unlocked for the current application session.
- Defer seed phrase display, seed phrase import, and seed phrase backup until a later wallet-management pass.
- Derive and expose additional addresses from the same wallet after the basic wallet load/unlock flow works.
- Add richer address discovery, labeling, and per-tab switching after the scaffold is testable.

## Change Log Decision

Qortium Home should maintain a human-readable change log, following the pattern used by Qortium Core.

- The change log file is `QORTIUM-HOME-CHANGELOG.md`.
- Every intentional commit should have one matching change log entry.
- Each entry title should match the commit message exactly, prefixed by the entry date.
- Entries should explain the change in plain language for non-developers.
- The change log should be updated in the same commit as the change it describes.

## Product Scope

### In Scope

- Wallet/account creation, saving, loading, and selection.
- Per-tab account selection for the active page.
- Future user approval prompts for QDN app requests that require account access, signing, or other non-read-only permissions.
- Local wallet list management.
- Qortal Hub-compatible wallet import and export.
- Multiple loaded wallet files.
- Multiple derived addresses per wallet.
- Browser-style tab management for QDN pages, QDN apps/websites, and direct API endpoint views.
- Future derived-address selection inside each tab account context.
- QDN service browsing across common service types.
- Dedicated QDN viewers for app, website, image, audio, video, text, and file-style resources.
- Direct Qortal API endpoint viewing for read-only node API `GET` requests.
- Preinstalled or externally managed core connection support.
- Qortium Previewnet preset for `http://127.0.0.1:24891`.
- One saved custom node address configuration.
- Displaying configured node status, connectivity, and peer status.
- Future downloading and setting up Qortium Core from GitHub releases and prereleases.
- Future starting of local core through scripts bundled with the core.
- Android connection to an existing configured node.
- Cross-platform packaging setup that can grow toward Linux, macOS, Windows, and Android releases.

### Out Of Scope For The Initial Direction

- Rebuilding Qortal Hub.
- Large social, messaging, plugin, or multi-app portal functionality unless later chosen explicitly.
- Complex theming or a large design system before the core workflows exist.
- A full Qortium Core implementation inside the UI app. The UI should manage and launch the core rather than reimplement it.
- Running Qortium Core locally inside the Android APK for the initial version.
- Downloading, installing, unpacking, starting, or stopping Qortium Core in the first scaffold.
- Full tabbed browsing in the first scaffold.
- `qdnRequest` request handling in the first scaffold.

## Open Questions

- How much of the desktop and Android UI can be shared exactly, and where will Android need platform-specific behavior?
- Should Qortium Home export only Hub-compatible wallet files at first, or also define an extended Qortium Home wallet metadata format?
- Should wallet files be encrypted by default? Current direction: yes, preserve Hub-compatible encrypted wallet files.
- How many derived addresses should Qortium Home show by default for each loaded wallet?
- Should derived addresses be discovered by scanning chain activity, generated on demand, or both?
- How should users label derived addresses separately from wallet files?
- Should tab account selections persist across restarts, or stay session-only with the current tabs?
- Should account context be changeable while a QDN app or page is already loaded?
- What exact permission prompts are needed when QDN apps request account access or signing capability?
- Which `qdnRequest` actions are read-only and can be allowed without prompting?
- Which `qdnRequest` actions must always require explicit user approval?
- Should persistent qdnRequest permissions be keyed by app, tab/session, wallet, derived address, and action?
- When should Qortium Home add multiple saved custom node addresses beyond the first single custom slot?
- For future core management, should Qortium Home use the same install/unpack folders as Qortal Hub or choose Qortium-specific app data folders?
- How should Qortium Home discover the latest GitHub release and prerelease?
- Should prerelease downloads be opt-in only?
- How should downloaded core artifacts be verified before running?
- Which core scripts need to be supported on Linux, macOS, Windows, and Android?
- How should node start, stop, restart, and log viewing be exposed in the UI?
- What exact node status fields should be shown?
  - API reachable.
  - Sync status.
  - Current block height.
  - Peer count.
  - Connected peers.
  - Core version.
  - Startup or error state.
- Should direct API endpoint loading be read-only only, or should authenticated/write endpoints eventually be supported?
- How should QDN search and browsing be organized?
  - By service type.
  - By name.
  - By recent or popular content.
  - By direct name/service/identifier lookup.
- Should QDN content render inside the app, open in an isolated webview, or open externally?
- What security boundaries are required when rendering QDN `APP` and `WEBSITE` content?
- When tab support is added, how should each desktop tab's `WebContentsView` session partitioning be designed?
- When tab support is added, what practical tab isolation can be provided on Android with Capacitor?
- When tab support is added, should tabs persist across restarts, and if so should loaded URLs restore without automatically restoring signing/account permissions?
- What minimum OS versions and CPU architectures should be supported for each platform?
- How should release signing/notarization be handled for macOS, Windows, and Android?

## Suggested First Implementation Milestones

1. Scaffold the single repo with Vite, React, TypeScript, Electron, and Capacitor Android.
2. Set up desktop-first development using Electron.
3. Build the account-management shell:
   - Empty state.
   - Create wallet flow.
   - Load wallet flow.
   - Wallet switcher.
   - Hub-compatible wallet import/export.
   - Initial derived-address model.
4. Build the single active page shell:
   - Address or endpoint bar.
   - Selected account context for the active page.
5. Add node connectivity configuration:
   - Qortium Previewnet preset at `http://127.0.0.1:24891`.
   - One saved custom node address.
   - Basic node status.
6. Add direct API endpoint viewer.
7. Add basic QDN browser by service type.
8. Package and test the first Linux x64 AppImage.
9. Add first-pass tab support.
10. Add per-tab account context.
11. Add visible account controls for already-loaded tabs if users need to change a tab's account after navigation.
12. Add `qdnRequest` permission and signing support.
13. Add Qortium Core release/prerelease download and setup flow.
14. Add local core start/status controls.
15. Expand packaging targets one at a time.
