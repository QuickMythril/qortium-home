import { ipcMain } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const NODE_API_URL = process.env.QORTIUM_HOME_NODE_API_URL ?? 'http://127.0.0.1:62391';
const PREVIEW_API_KEY_PATH = path.join(os.homedir(), 'git', 'qortium', 'preview', 'apikey.txt');
const PUBLIC_QDN_SERVICES = new Set([
  'APP',
  'WEBSITE',
  'IMAGE',
  'THUMBNAIL',
  'QCHAT_IMAGE',
  'VIDEO',
  'AUDIO',
  'VOICE',
  'PODCAST',
  'DOCUMENT',
  'FILE',
  'FILES',
  'JSON',
  'METADATA',
  'BLOG',
  'BLOG_POST',
  'BLOG_COMMENT',
  'LIST',
  'PLAYLIST',
  'GIT_REPOSITORY',
  'GIF_REPOSITORY',
  'STORE',
  'PRODUCT',
  'OFFER',
  'COUPON',
  'CODE',
  'PLUGIN',
  'EXTENSION',
  'GAME',
  'ITEM',
  'NFT',
  'DATABASE',
  'SNAPSHOT',
  'COMMENT',
  'CHAIN_COMMENT',
  'CHAIN_DATA',
  'ATTACHMENT',
  'MAIL',
  'MESSAGE',
]);

type QdnAuthorizeResourceRequest = {
  identifier?: unknown;
  name?: unknown;
  service?: unknown;
};

function expandHomePath(filePath: string) {
  if (filePath === '~') {
    return os.homedir();
  }

  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }

  return filePath;
}

function readTrimmedFile(filePath: string) {
  const expandedPath = expandHomePath(filePath);

  if (!existsSync(expandedPath)) {
    return '';
  }

  return readFileSync(expandedPath, 'utf8').trim();
}

function readNodeApiKey() {
  const explicitApiKey = process.env.QORTIUM_HOME_NODE_API_KEY?.trim();

  if (explicitApiKey) {
    return explicitApiKey;
  }

  const explicitApiKeyPath = process.env.QORTIUM_HOME_NODE_API_KEY_PATH?.trim();

  if (explicitApiKeyPath) {
    const explicitPathKey = readTrimmedFile(explicitApiKeyPath);

    if (explicitPathKey) {
      return explicitPathKey;
    }
  }

  return readTrimmedFile(PREVIEW_API_KEY_PATH);
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getAuthorizeRequest(value: QdnAuthorizeResourceRequest) {
  const service = getString(value.service).toUpperCase();
  const name = getString(value.name);
  const identifier = getString(value.identifier);

  if (!PUBLIC_QDN_SERVICES.has(service)) {
    throw new Error('Only public QDN resources can be loaded right now.');
  }

  if (!name) {
    throw new Error('QDN resource name is required.');
  }

  return {
    service,
    name,
    identifier: identifier || undefined,
  };
}

async function authorizeResource(service: string, name: string, identifier: string | undefined, apiKey: string) {
  const identifierPath = identifier ? `/${encodeURIComponent(identifier)}` : '';
  const response = await fetch(
    `${NODE_API_URL}/render/authorize/${service}/${encodeURIComponent(name)}${identifierPath}`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
      },
    },
  );

  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `QDN authorization failed with HTTP ${response.status}.`);
  }
}

export function registerQdnIpcHandlers() {
  ipcMain.handle('qdn:authorizeResource', async (_event, request: QdnAuthorizeResourceRequest) => {
    const { service, name, identifier } = getAuthorizeRequest(request);
    const apiKey = readNodeApiKey();

    if (!apiKey) {
      throw new Error('Qortium node API key was not found.');
    }

    await authorizeResource(service, name, undefined, apiKey);

    if (identifier) {
      await authorizeResource(service, name, identifier, apiKey);
    }

    return {
      authorized: true,
      nodeApiUrl: NODE_API_URL,
    };
  });
}
