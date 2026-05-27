# Qortium Core Management

Qortium Home should be able to manage a local desktop Qortium Core install without
requiring users to manually download release files. This feature is desktop-only;
Android should continue to use existing nodes and Previewnet network discovery.

## First Implementation

- Discover Qortium Core releases from `QuickMythril/qortium` on GitHub.
- Show the latest stable release when one exists.
- Show the latest prerelease when one exists.
- Install the selected release only after an explicit user action.
- Support the current release asset shape: `qortium-preview.zip`.
- Extract the release into a Qortium Home managed folder under Electron
  `app.getPath('userData')`.
- Record installed release metadata in the managed folder.
- Detect Java 17 or newer on the user's system.
- Do not download Java automatically in the first pass.
- Start the managed Core by running the release's bundled preview start script.
- Stop the managed Core by running the release's bundled preview stop script.
- When the managed Core starts and `http://127.0.0.1:24891/admin/status` is
  reachable, switch Qortium Home's node mode to the local node.

## Managed Folder

The managed Core folder should stay isolated from source checkouts, Qortal Hub,
and manually installed Qortium or Qortal Core folders. The intended layout is:

```text
Qortium Home app data/
  managed-core/
    downloads/
    versions/
      v1.0.0-preview.1/
        qortium-preview/
          qortium.jar
          preview/
    current.json
```

`current.json` should identify the selected installed release, install path,
asset name, download URL, digest when available, and install time.

## Runtime Behavior

The first pass should run Previewnet participant mode. For the current release
zip, Qortium Home should use:

- Linux/macOS: `preview/start.sh --participant --headless`
- Windows: `preview/start.bat --participant --headless`
- Linux/macOS stop: `preview/stop.sh`
- Windows stop: `preview/stop.bat`

The UI should report Java availability, installed Core status, running status,
current local API URL, and install/start/stop progress.

## Deferred Work

- Automatic Java runtime download and management.
- Stable/mainnet Core profile selection.
- Multiple installed Core versions with rollback UI.
- Core bootstrap, database deletion, API key reset, and log viewer controls.
- Release signatures beyond GitHub-provided asset digest verification.
