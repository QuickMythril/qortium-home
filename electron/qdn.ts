import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getNodeConnection } from './node-settings.js';

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

type QdnRawResourceRequest = QdnAuthorizeResourceRequest & {
  maxBytes?: unknown;
  path?: unknown;
  suggestedFilename?: unknown;
};

type QdnResourcesSearchRequest = {
  exactMatchNames?: unknown;
  includeMetadata?: unknown;
  includeStatus?: unknown;
  limit?: unknown;
  name?: unknown;
  service?: unknown;
};

type NodeApiRequest = {
  maxBytes?: unknown;
  path?: unknown;
};

type QdnResourceRequest = {
  identifier?: string;
  name: string;
  path: string;
  service: string;
};

type NodeConnection = Awaited<ReturnType<typeof getNodeConnection>>;

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

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
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

function getService(value: unknown) {
  const service = getString(value).toUpperCase();

  if (!service) {
    return '';
  }

  if (!PUBLIC_QDN_SERVICES.has(service)) {
    throw new Error('Only public QDN services can be browsed right now.');
  }

  return service;
}

function getRawResourceRequest(value: QdnRawResourceRequest) {
  return {
    ...getAuthorizeRequest(value),
    path: getString(value.path),
  };
}

function splitPathAndQuery(resourcePath: string) {
  const queryIndex = resourcePath.indexOf('?');

  if (queryIndex === -1) {
    return {
      pathOnly: resourcePath,
      queryString: '',
    };
  }

  return {
    pathOnly: resourcePath.slice(0, queryIndex),
    queryString: resourcePath.slice(queryIndex + 1),
  };
}

function buildRawResourceUrl(resource: QdnResourceRequest, nodeApiUrl: string, attachment = false) {
  const identifierPath = resource.identifier ? `/${encodeURIComponent(resource.identifier)}` : '';
  const { pathOnly, queryString } = splitPathAndQuery(resource.path);
  const queryParams = new URLSearchParams(queryString);

  if (pathOnly) {
    queryParams.set('filepath', pathOnly);
  }

  if (attachment) {
    queryParams.set('attachment', 'true');
  }

  const rawQueryString = queryParams.toString();

  return `${nodeApiUrl}/arbitrary/${resource.service}/${encodeURIComponent(resource.name)}${identifierPath}${
    rawQueryString ? `?${rawQueryString}` : ''
  }`;
}

function getContentLength(response: Response) {
  const rawLength = response.headers.get('content-length');

  if (!rawLength) {
    return undefined;
  }

  const contentLength = Number(rawLength);

  return Number.isFinite(contentLength) ? contentLength : undefined;
}

function sanitizeFilename(value: string) {
  const sanitized = value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim();

  return sanitized.slice(0, 180) || 'qdn-resource';
}

function getSuggestedFilename(request: QdnRawResourceRequest, resource: QdnResourceRequest) {
  const requestedFilename = getString(request.suggestedFilename);

  if (requestedFilename) {
    return sanitizeFilename(requestedFilename);
  }

  return sanitizeFilename(`${resource.service}_${resource.name}_${resource.identifier ?? 'default'}`);
}

function getAppPath(name: Parameters<typeof app.getPath>[0]) {
  try {
    return app.getPath(name);
  } catch {
    return '';
  }
}

function getDefaultDownloadPath(filename: string) {
  const documentsPath = getAppPath('documents');
  const homePath = getAppPath('home');
  const basePath = documentsPath && existsSync(documentsPath) ? documentsPath : homePath;

  return path.join(basePath || process.cwd(), filename);
}

function getNodeApiPath(value: unknown, nodeApiUrl: string) {
  const apiPath = getString(value);

  if (!apiPath.startsWith('/') || apiPath.startsWith('//')) {
    throw new Error('Node API paths must start with /.');
  }

  if (/[\x00-\x1F]/.test(apiPath)) {
    throw new Error('Node API path contains invalid control characters.');
  }

  const url = new URL(apiPath, nodeApiUrl);

  return `${url.pathname}${url.search}`;
}

function getNodeUnavailableMessage(nodeApiUrl: string) {
  return `Qortium node is unavailable at ${nodeApiUrl}.`;
}

function getNodeApiKey() {
  const apiKey = readNodeApiKey();

  if (!apiKey) {
    throw new Error('Qortium node API key was not found.');
  }

  return apiKey;
}

async function fetchNode(pathname: string, options: RequestInit = {}, nodeApiUrl: string) {
  let response: Response;

  try {
    response = await fetch(`${nodeApiUrl}${pathname}`, options);
  } catch {
    throw new Error(getNodeUnavailableMessage(nodeApiUrl));
  }

  return response;
}

async function fetchConfiguredNode(pathname: string, options: RequestInit = {}) {
  const connection = await getNodeConnection();

  try {
    return {
      connection,
      response: await fetchNode(pathname, options, connection.nodeApiUrl),
    };
  } catch (error) {
    if (connection.mode !== 'network') {
      throw error;
    }

    const retryConnection = await getNodeConnection(true);

    if (retryConnection.nodeApiUrl === connection.nodeApiUrl) {
      throw error;
    }

    return {
      connection: retryConnection,
      response: await fetchNode(pathname, options, retryConnection.nodeApiUrl),
    };
  }
}

async function fetchRawResource(
  resource: QdnResourceRequest,
  connection: NodeConnection,
  attachment = false,
) {
  const headers: Record<string, string> = {};

  if (connection.mode !== 'network') {
    headers['X-API-KEY'] = getNodeApiKey();
  }

  const response = await fetchNode(
    buildRawResourceUrl(resource, connection.nodeApiUrl, attachment).replace(connection.nodeApiUrl, ''),
    {
      headers,
    },
    connection.nodeApiUrl,
  );

  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `QDN raw resource request failed with HTTP ${response.status}.`);
  }

  return response;
}

async function fetchConfiguredRawResource(resource: QdnResourceRequest, attachment = false) {
  const connection = await getNodeConnection();

  try {
    return await fetchRawResource(resource, connection, attachment);
  } catch (error) {
    if (connection.mode !== 'network') {
      throw error;
    }

    const retryConnection = await getNodeConnection(true);

    if (retryConnection.nodeApiUrl === connection.nodeApiUrl) {
      throw error;
    }

    return await fetchRawResource(resource, retryConnection, attachment);
  }
}

async function authorizeResource(
  service: string,
  name: string,
  identifier: string | undefined,
  apiKey: string,
  nodeApiUrl: string,
) {
  const identifierPath = identifier ? `/${encodeURIComponent(identifier)}` : '';
  const response = await fetchNode(
    `/render/authorize/${service}/${encodeURIComponent(name)}${identifierPath}`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
      },
    },
    nodeApiUrl,
  );

  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `QDN authorization failed with HTTP ${response.status}.`);
  }
}

function buildResourcesSearchPath(request: QdnResourcesSearchRequest) {
  const service = getService(request.service);
  const name = getString(request.name);
  const limit = Math.max(0, Math.floor(getNumber(request.limit) ?? 0));
  const queryParams = new URLSearchParams({
    mode: 'ALL',
    limit: String(limit),
    includestatus: String(getBoolean(request.includeStatus) ?? true),
    includemetadata: String(getBoolean(request.includeMetadata) ?? true),
  });

  if (service) {
    queryParams.set('service', service);
  }

  if (name) {
    queryParams.set('name', name);
    queryParams.set('exactmatchnames', String(getBoolean(request.exactMatchNames) ?? true));
  }

  return `/arbitrary/resources/search?${queryParams.toString()}`;
}

export function registerQdnIpcHandlers() {
  ipcMain.handle('qdn:authorizeResource', async (_event, request: QdnAuthorizeResourceRequest) => {
    const { service, name, identifier } = getAuthorizeRequest(request);
    const connection = await getNodeConnection();

    if (connection.mode === 'network') {
      return {
        authorized: true,
        nodeApiUrl: connection.nodeApiUrl,
      };
    }

    const apiKey = getNodeApiKey();

    await authorizeResource(service, name, undefined, apiKey, connection.nodeApiUrl);

    if (identifier) {
      await authorizeResource(service, name, identifier, apiKey, connection.nodeApiUrl);
    }

    return {
      authorized: true,
      nodeApiUrl: connection.nodeApiUrl,
    };
  });

  ipcMain.handle('qdn:listResources', async (_event, request: QdnResourcesSearchRequest) => {
    const { response } = await fetchConfiguredNode(buildResourcesSearchPath(request));
    const text = await response.text();

    if (!response.ok) {
      throw new Error(text || `Qortium node request failed with HTTP ${response.status}.`);
    }

    return text ? (JSON.parse(text) as unknown) : null;
  });

  ipcMain.handle('qdn:fetchNodeApi', async (_event, request: NodeApiRequest) => {
    const apiPath = getNodeApiPath(request.path, 'http://127.0.0.1');
    const maxBytes = Math.max(0, Math.floor(getNumber(request.maxBytes) ?? 0));
    const { response } = await fetchConfiguredNode(apiPath);
    const contentLength = getContentLength(response);
    const contentType = response.headers.get('content-type') ?? '';

    if (maxBytes > 0 && typeof contentLength === 'number' && contentLength > maxBytes) {
      await response.body?.cancel();

      return {
        contentLength,
        contentType,
        status: response.status,
        statusText: response.statusText,
        tooLarge: true,
      };
    }

    const body = await response.text();
    const bodyLength = Buffer.byteLength(body, 'utf8');

    if (maxBytes > 0 && bodyLength > maxBytes) {
      return {
        contentLength: bodyLength,
        contentType,
        status: response.status,
        statusText: response.statusText,
        tooLarge: true,
      };
    }

    return {
      body,
      contentLength: contentLength ?? bodyLength,
      contentType,
      status: response.status,
      statusText: response.statusText,
      tooLarge: false,
    };
  });

  ipcMain.handle('qdn:fetchResourceText', async (_event, request: QdnRawResourceRequest) => {
    const resource = getRawResourceRequest(request);
    const maxBytes = Math.max(0, Math.floor(getNumber(request.maxBytes) ?? 0));
    const response = await fetchConfiguredRawResource(resource);
    const contentLength = getContentLength(response);
    const contentType = response.headers.get('content-type') ?? '';

    if (maxBytes > 0 && typeof contentLength === 'number' && contentLength > maxBytes) {
      await response.body?.cancel();

      return {
        contentLength,
        contentType,
        tooLarge: true,
      };
    }

    const content = await response.text();

    if (maxBytes > 0 && Buffer.byteLength(content, 'utf8') > maxBytes) {
      return {
        contentLength: Buffer.byteLength(content, 'utf8'),
        contentType,
        tooLarge: true,
      };
    }

    return {
      content,
      contentLength,
      contentType,
      tooLarge: false,
    };
  });

  ipcMain.handle('qdn:downloadResource', async (event, request: QdnRawResourceRequest) => {
    const resource = getRawResourceRequest(request);
    const parentWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const saveDialogOptions = {
      title: 'Save QDN Resource',
      defaultPath: getDefaultDownloadPath(getSuggestedFilename(request, resource)),
    };
    const result = parentWindow
      ? await dialog.showSaveDialog(parentWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (result.canceled || !result.filePath) {
      return {
        canceled: true,
      };
    }

    const response = await fetchConfiguredRawResource(resource, true);
    const content = Buffer.from(await response.arrayBuffer());
    writeFileSync(result.filePath, content);

    return {
      canceled: false,
      filePath: result.filePath,
    };
  });
}
