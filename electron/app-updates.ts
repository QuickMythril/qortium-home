import { app, ipcMain, shell } from 'electron';

type AppUpdatePlatformOs = 'android' | 'linux' | 'macos' | 'unsupported' | 'windows';

function getPlatformOs(): AppUpdatePlatformOs {
  if (process.platform === 'linux') {
    return 'linux';
  }

  if (process.platform === 'darwin') {
    return 'macos';
  }

  if (process.platform === 'win32') {
    return 'windows';
  }

  return 'unsupported';
}

function getPlatformLabel(os: AppUpdatePlatformOs, arch: string) {
  if (os === 'linux') {
    return `Linux ${arch}`;
  }

  if (os === 'macos') {
    return `macOS ${arch}`;
  }

  if (os === 'windows') {
    return `Windows ${arch}`;
  }

  return `${process.platform} ${arch}`;
}

function isSupportedPlatform(os: AppUpdatePlatformOs, arch: string) {
  if (os === 'linux' || os === 'macos') {
    return arch === 'x64' || arch === 'arm64';
  }

  if (os === 'windows') {
    return arch === 'x64';
  }

  return false;
}

function getUpdateEnvironment() {
  const os = getPlatformOs();
  const arch = process.arch;

  return {
    currentVersion: app.getVersion(),
    platform: {
      arch,
      label: getPlatformLabel(os, arch),
      os,
      supported: isSupportedPlatform(os, arch),
    },
  };
}

function normalizeExternalUrl(value: unknown) {
  const rawUrl = typeof value === 'string' ? value.trim() : '';

  if (!rawUrl) {
    throw new Error('Release URL is required.');
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Release URL is invalid.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Release URL must use HTTP or HTTPS.');
  }

  return url.toString();
}

async function openExternalUrl(value: unknown) {
  await shell.openExternal(normalizeExternalUrl(value));
}

export function registerAppUpdateIpcHandlers() {
  ipcMain.handle('updates:getEnvironment', () => getUpdateEnvironment());
  ipcMain.handle('updates:openReleasePage', (_event, url: unknown) => openExternalUrl(url));
}
