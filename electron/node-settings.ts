import { app, ipcMain } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_LOCAL_NODE_API_URL = 'http://127.0.0.1:24891';
const NODE_SETTINGS_FILE = 'node-settings.json';

type NodeSettingsMode = 'custom' | 'local' | 'network';

type NodeSettings = {
  customUrl: string;
  mode: NodeSettingsMode;
};

type NodeSettingsRequest = {
  customUrl?: unknown;
  mode?: unknown;
};

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getNodeSettingsPath() {
  return path.join(app.getPath('userData'), NODE_SETTINGS_FILE);
}

function getLocalNodeApiUrl() {
  try {
    return normalizeNodeApiUrl(process.env.QORTIUM_HOME_NODE_API_URL ?? DEFAULT_LOCAL_NODE_API_URL);
  } catch {
    return DEFAULT_LOCAL_NODE_API_URL;
  }
}

function normalizeNodeApiUrl(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error('Node URL is required.');
  }

  const candidate = /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `http://${trimmedValue}`;
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Enter a valid node URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Node URL must use HTTP or HTTPS.');
  }

  if (url.username || url.password) {
    throw new Error('Node URL cannot include a username or password.');
  }

  if (!url.hostname) {
    throw new Error('Node URL must include a host.');
  }

  return url.origin;
}

function getDefaultNodeSettings(): NodeSettings {
  return {
    customUrl: '',
    mode: 'local',
  };
}

function parseStoredNodeSettings(value: unknown): NodeSettings {
  if (!value || typeof value !== 'object') {
    return getDefaultNodeSettings();
  }

  const rawSettings = value as Partial<NodeSettings>;
  const rawCustomUrl = getString(rawSettings.customUrl);
  let customUrl = '';

  if (rawCustomUrl) {
    try {
      customUrl = normalizeNodeApiUrl(rawCustomUrl);
    } catch {
      customUrl = '';
    }
  }

  const rawMode = (rawSettings as { mode?: unknown }).mode;

  if (rawMode === 'custom' && customUrl) {
    return {
      customUrl,
      mode: 'custom',
    };
  }

  if (rawMode === 'local' || rawMode === 'previewnet') {
    return {
      customUrl,
      mode: 'local',
    };
  }

  return {
    customUrl,
    mode: 'local',
  };
}

function readNodeSettings(): NodeSettings {
  try {
    const parsedSettings: unknown = JSON.parse(readFileSync(getNodeSettingsPath(), 'utf8'));

    return parseStoredNodeSettings(parsedSettings);
  } catch {
    return getDefaultNodeSettings();
  }
}

function writeNodeSettings(settings: NodeSettings) {
  const settingsPath = getNodeSettingsPath();

  mkdirSync(path.dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function normalizeNodeSettingsRequest(value: NodeSettingsRequest): NodeSettings {
  if (!value || typeof value !== 'object') {
    throw new Error('Node settings are required.');
  }

  if (value.mode !== 'local' && value.mode !== 'custom') {
    throw new Error('Choose either the local node or a custom node.');
  }

  const rawCustomUrl = getString(value.customUrl);
  const customUrl = rawCustomUrl ? normalizeNodeApiUrl(rawCustomUrl) : '';

  if (value.mode === 'custom' && !customUrl) {
    throw new Error('Custom node URL is required.');
  }

  return {
    customUrl,
    mode: value.mode,
  };
}

function resolveNodeApiUrl(settings: NodeSettings) {
  return settings.mode === 'custom' && settings.customUrl ? settings.customUrl : getLocalNodeApiUrl();
}

function getNodeSettingsSnapshot(settings = readNodeSettings()) {
  return {
    ...settings,
    localUrl: getLocalNodeApiUrl(),
    networkModeAvailable: false,
    networkSeedUrls: [],
    nodeApiUrl: resolveNodeApiUrl(settings),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to reach the configured node.';
}

async function fetchNodeStatus(nodeApiUrl: string) {
  let response: Response;

  try {
    response = await fetch(`${nodeApiUrl}/admin/status`);
  } catch {
    throw new Error(`Qortium node is unavailable at ${nodeApiUrl}.`);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Node status request failed with HTTP ${response.status}.`);
  }

  return text ? (JSON.parse(text) as unknown) : null;
}

async function testNodeSettings(settings: NodeSettings) {
  const nodeApiUrl = resolveNodeApiUrl(settings);

  try {
    return {
      ok: true,
      nodeApiUrl,
      status: await fetchNodeStatus(nodeApiUrl),
    };
  } catch (error) {
    return {
      ok: false,
      nodeApiUrl,
      message: getErrorMessage(error),
    };
  }
}

export function getNodeApiUrl() {
  return resolveNodeApiUrl(readNodeSettings());
}

export function registerNodeSettingsIpcHandlers() {
  ipcMain.handle('node:getSettings', () => getNodeSettingsSnapshot());

  ipcMain.handle('node:saveSettings', (_event, request: NodeSettingsRequest) => {
    const settings = normalizeNodeSettingsRequest(request);

    writeNodeSettings(settings);

    return getNodeSettingsSnapshot(settings);
  });

  ipcMain.handle('node:testConnection', (_event, request: NodeSettingsRequest) => {
    return testNodeSettings(normalizeNodeSettingsRequest(request));
  });

  ipcMain.handle('node:getStatus', () => {
    return testNodeSettings(readNodeSettings());
  });
}
