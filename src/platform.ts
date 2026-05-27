import { Capacitor, CapacitorHttp, type HttpResponse } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { PUBLIC_QDN_SERVICES } from './qdn';

const NODE_SETTINGS_KEY = 'qortium-home-node-settings';
const NODE_DISCOVERY_CACHE_KEY = 'qortium-home-node-discovery-cache';
const DESKTOP_LOCAL_NODE_API_URL = 'http://127.0.0.1:24891';
const ANDROID_EMULATOR_LOCAL_NODE_API_URL = 'http://10.0.2.2:24891';
const PREVIEWNET_API_PORT = '24891';
const PREVIEWNET_P2P_PORT = '24892';
const PREVIEWNET_SEED_NODE_API_URLS = [
  'http://146.103.42.59:24891',
  'http://185.207.104.78:24891',
];
const PUBLIC_READ_PROBE_PATH =
  '/arbitrary/resources/search?mode=ALL&limit=1&includestatus=false&includemetadata=false';
const REQUEST_TIMEOUT_MS = 30_000;
const DISCOVERY_TIMEOUT_MS = 5_000;
const DISCOVERY_CACHE_TTL_MS = 5 * 60_000;

type StoredNodeSettings = {
  customUrl: string;
  mode: QortiumNodeSettingsMode;
};

type PlatformApi = Window['qortiumHome'];

type DiscoveryCache = {
  expiresAt: number;
  nodeApiUrl: string;
};

type DiscoveryCandidate = {
  height: number;
  isSeed: boolean;
  isSynchronizing: boolean;
  nodeApiUrl: string;
  peerCount: number;
  status: unknown;
  supportsPublicReads: boolean;
};

function isAndroid() {
  return Capacitor.getPlatform() === 'android';
}

function isNativePlatform() {
  return Capacitor.isNativePlatform();
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

function getLocalNodeApiUrl() {
  return isAndroid() ? ANDROID_EMULATOR_LOCAL_NODE_API_URL : DESKTOP_LOCAL_NODE_API_URL;
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

function getDefaultNodeSettings(): StoredNodeSettings {
  return {
    customUrl: '',
    mode: isAndroid() ? 'network' : 'local',
  };
}

function parseStoredNodeSettings(value: unknown): StoredNodeSettings {
  if (!value || typeof value !== 'object') {
    return getDefaultNodeSettings();
  }

  const rawSettings = value as Partial<StoredNodeSettings>;
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

  if (rawMode === 'network') {
    return {
      customUrl,
      mode: 'network',
    };
  }

  if (rawMode === 'local') {
    return {
      customUrl,
      mode: 'local',
    };
  }

  if (rawMode === 'previewnet') {
    return {
      customUrl,
      mode: isAndroid() ? 'network' : 'local',
    };
  }

  return {
    customUrl,
    mode: isAndroid() ? 'network' : 'local',
  };
}

function normalizeNodeSettingsRequest(value: QortiumNodeSettingsRequest): StoredNodeSettings {
  if (!value || typeof value !== 'object') {
    throw new Error('Node settings are required.');
  }

  if (value.mode !== 'local' && value.mode !== 'network' && value.mode !== 'custom') {
    throw new Error('Choose the local node, Previewnet network, or a custom node.');
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

function getFallbackNodeApiUrl(settings: StoredNodeSettings) {
  if (settings.mode === 'custom' && settings.customUrl) {
    return settings.customUrl;
  }

  if (settings.mode === 'network') {
    return PREVIEWNET_SEED_NODE_API_URLS[0];
  }

  return getLocalNodeApiUrl();
}

async function resolveNodeApiUrl(settings: StoredNodeSettings, forceDiscoveryRefresh = false) {
  if (settings.mode === 'custom' && settings.customUrl) {
    return settings.customUrl;
  }

  if (settings.mode === 'network') {
    return (await discoverPreviewnetNode(forceDiscoveryRefresh)).nodeApiUrl;
  }

  return getLocalNodeApiUrl();
}

async function getNodeSettingsSnapshot(settings: StoredNodeSettings): Promise<QortiumNodeSettings> {
  let nodeApiUrl = getFallbackNodeApiUrl(settings);

  try {
    nodeApiUrl = await resolveNodeApiUrl(settings);
  } catch {
    nodeApiUrl = getFallbackNodeApiUrl(settings);
  }

  return {
    ...settings,
    localUrl: getLocalNodeApiUrl(),
    networkModeAvailable: true,
    networkSeedUrls: PREVIEWNET_SEED_NODE_API_URLS,
    nodeApiUrl,
  };
}

async function getStoredValue(key: string) {
  if (isNativePlatform()) {
    return (await Preferences.get({ key })).value;
  }

  return window.localStorage.getItem(key);
}

async function setStoredValue(key: string, value: string) {
  if (isNativePlatform()) {
    await Preferences.set({ key, value });
    return;
  }

  window.localStorage.setItem(key, value);
}

async function readNodeSettings() {
  try {
    const rawSettings = await getStoredValue(NODE_SETTINGS_KEY);

    return rawSettings ? parseStoredNodeSettings(JSON.parse(rawSettings) as unknown) : getDefaultNodeSettings();
  } catch {
    return getDefaultNodeSettings();
  }
}

async function writeNodeSettings(settings: StoredNodeSettings) {
  await setStoredValue(NODE_SETTINGS_KEY, JSON.stringify(settings));
}

function parseDiscoveryCache(value: unknown): DiscoveryCache | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const cache = value as Partial<DiscoveryCache>;

  if (typeof cache.nodeApiUrl !== 'string' || typeof cache.expiresAt !== 'number') {
    return null;
  }

  try {
    return {
      nodeApiUrl: normalizeNodeApiUrl(cache.nodeApiUrl),
      expiresAt: cache.expiresAt,
    };
  } catch {
    return null;
  }
}

async function readDiscoveryCache() {
  try {
    const rawCache = await getStoredValue(NODE_DISCOVERY_CACHE_KEY);

    if (!rawCache) {
      return null;
    }

    const cache = parseDiscoveryCache(JSON.parse(rawCache) as unknown);

    return cache && cache.expiresAt > Date.now() ? cache : null;
  } catch {
    return null;
  }
}

async function writeDiscoveryCache(nodeApiUrl: string) {
  await setStoredValue(
    NODE_DISCOVERY_CACHE_KEY,
    JSON.stringify({
      nodeApiUrl,
      expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
    }),
  );
}

function normalizeCandidateNodeApiUrl(value: string) {
  const normalizedUrl = new URL(normalizeNodeApiUrl(value));

  normalizedUrl.port = PREVIEWNET_API_PORT;

  return normalizedUrl.origin;
}

function isPreviewnetSeedNodeApiUrl(nodeApiUrl: string) {
  try {
    const normalizedNodeApiUrl = normalizeCandidateNodeApiUrl(nodeApiUrl);

    return PREVIEWNET_SEED_NODE_API_URLS.map(normalizeCandidateNodeApiUrl).includes(
      normalizedNodeApiUrl,
    );
  } catch {
    return false;
  }
}

function peerAddressToNodeApiUrl(value: unknown) {
  const address = getString(value);

  if (!address) {
    return null;
  }

  try {
    const candidate = /^https?:\/\//i.test(address) ? address : `http://${address}`;
    const url = new URL(candidate);

    if (!url.hostname) {
      return null;
    }

    url.protocol = 'http:';
    url.username = '';
    url.password = '';
    url.port = PREVIEWNET_API_PORT;
    url.pathname = '';
    url.search = '';
    url.hash = '';

    return url.origin;
  } catch {
    return null;
  }
}

function getKnownPeerAddress(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const peer = value as { address?: unknown };

  return getString(peer.address);
}

function getStatusHeight(status: unknown) {
  if (!status || typeof status !== 'object') {
    return 0;
  }

  const height = (status as { height?: unknown }).height;

  return typeof height === 'number' && Number.isFinite(height) ? height : 0;
}

function getStatusPeerCount(status: unknown) {
  if (!status || typeof status !== 'object') {
    return 0;
  }

  const statusObject = status as {
    numberOfConnections?: unknown;
    numberOfDataConnections?: unknown;
  };
  const chainPeers =
    typeof statusObject.numberOfConnections === 'number' ? statusObject.numberOfConnections : 0;
  const dataPeers =
    typeof statusObject.numberOfDataConnections === 'number' ? statusObject.numberOfDataConnections : 0;

  return chainPeers + dataPeers;
}

function getStatusIsSynchronizing(status: unknown) {
  if (!status || typeof status !== 'object') {
    return true;
  }

  const isSynchronizing = (status as { isSynchronizing?: unknown }).isSynchronizing;

  return typeof isSynchronizing === 'boolean' ? isSynchronizing : true;
}

async function fetchKnownPeerNodeApiUrls(seedNodeApiUrl: string) {
  try {
    const response = await requestNode(seedNodeApiUrl, '/peers/known', 'json', DISCOVERY_TIMEOUT_MS);

    if (response.status < 200 || response.status >= 300 || !Array.isArray(response.data)) {
      return [];
    }

    return response.data
      .map(getKnownPeerAddress)
      .map(peerAddressToNodeApiUrl)
      .filter((nodeApiUrl): nodeApiUrl is string => !!nodeApiUrl);
  } catch {
    return [];
  }
}

async function probePublicReadAccess(nodeApiUrl: string) {
  try {
    const response = await requestNode(nodeApiUrl, PUBLIC_READ_PROBE_PATH, 'json', DISCOVERY_TIMEOUT_MS);

    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}

async function probeNodeCandidate(nodeApiUrl: string): Promise<DiscoveryCandidate | null> {
  try {
    const response = await requestNode(nodeApiUrl, '/admin/status', 'json', DISCOVERY_TIMEOUT_MS);

    if (response.status < 200 || response.status >= 300) {
      return null;
    }

    return {
      nodeApiUrl,
      status: response.data,
      height: getStatusHeight(response.data),
      isSeed: isPreviewnetSeedNodeApiUrl(nodeApiUrl),
      isSynchronizing: getStatusIsSynchronizing(response.data),
      peerCount: getStatusPeerCount(response.data),
      supportsPublicReads: await probePublicReadAccess(nodeApiUrl),
    };
  } catch {
    return null;
  }
}

function rankDiscoveryCandidates(candidates: DiscoveryCandidate[]) {
  return [...candidates].sort((first, second) => {
    if (first.supportsPublicReads !== second.supportsPublicReads) {
      return first.supportsPublicReads ? -1 : 1;
    }

    if (first.isSeed !== second.isSeed) {
      return first.isSeed ? 1 : -1;
    }

    if (first.isSynchronizing !== second.isSynchronizing) {
      return first.isSynchronizing ? 1 : -1;
    }

    if (first.height !== second.height) {
      return second.height - first.height;
    }

    return second.peerCount - first.peerCount;
  });
}

async function discoverPreviewnetNode(forceRefresh = false): Promise<DiscoveryCandidate> {
  if (!forceRefresh) {
    const cache = await readDiscoveryCache();

    if (cache) {
      const cachedCandidate = await probeNodeCandidate(cache.nodeApiUrl);

      if (cachedCandidate?.supportsPublicReads) {
        return cachedCandidate;
      }
    }
  }

  const candidateUrls = new Set(PREVIEWNET_SEED_NODE_API_URLS.map(normalizeCandidateNodeApiUrl));
  const knownPeerResults = await Promise.all(
    PREVIEWNET_SEED_NODE_API_URLS.map(fetchKnownPeerNodeApiUrls),
  );

  for (const peerNodeApiUrls of knownPeerResults) {
    for (const peerNodeApiUrl of peerNodeApiUrls) {
      candidateUrls.add(peerNodeApiUrl);
    }
  }

  const candidates = (
    await Promise.all([...candidateUrls].map((nodeApiUrl) => probeNodeCandidate(nodeApiUrl)))
  ).filter((candidate): candidate is DiscoveryCandidate => !!candidate);
  const selectedCandidate = rankDiscoveryCandidates(candidates)[0];

  if (!selectedCandidate) {
    throw new Error('No reachable Previewnet node was found.');
  }

  await writeDiscoveryCache(selectedCandidate.nodeApiUrl);

  return selectedCandidate;
}

function getHeader(response: HttpResponse, headerName: string) {
  const expectedName = headerName.toLowerCase();
  const entry = Object.entries(response.headers).find(([name]) => name.toLowerCase() === expectedName);

  return entry?.[1];
}

function getContentLength(response: HttpResponse) {
  const contentLength = Number(getHeader(response, 'content-length'));

  return Number.isFinite(contentLength) ? contentLength : undefined;
}

function getContentType(response: HttpResponse) {
  return getHeader(response, 'content-type') ?? '';
}

function getStatusText(status: number) {
  if (status >= 200 && status < 300) {
    return 'OK';
  }

  if (status >= 400 && status < 500) {
    return 'Client Error';
  }

  if (status >= 500) {
    return 'Server Error';
  }

  return '';
}

function getNodeUnavailableMessage(nodeApiUrl: string) {
  return `Qortium node is unavailable at ${nodeApiUrl}.`;
}

function getNetworkRestrictionMessage() {
  return 'The selected Previewnet network node is public read-only and does not expose that endpoint. Use a local Core or trusted custom node for write, admin, or private API workflows.';
}

function getNodeApiUrlBase(nodeApiUrl: string) {
  return nodeApiUrl.replace(/\/+$/, '');
}

function getByteLength(value: string) {
  return new Blob([value]).size;
}

function stringifyResponseData(data: unknown) {
  if (typeof data === 'string') {
    return data;
  }

  if (data === null || typeof data === 'undefined') {
    return '';
  }

  return JSON.stringify(data);
}

async function requestNode(
  nodeApiUrl: string,
  pathname: string,
  responseType: 'json' | 'text' = 'text',
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  try {
    return await CapacitorHttp.get({
      url: `${getNodeApiUrlBase(nodeApiUrl)}${pathname}`,
      responseType,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    });
  } catch {
    throw new Error(getNodeUnavailableMessage(nodeApiUrl));
  }
}

async function fetchNodeStatus(nodeApiUrl: string) {
  const response = await requestNode(nodeApiUrl, '/admin/status', 'json');

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      stringifyResponseData(response.data) || `Node status request failed with HTTP ${response.status}.`,
    );
  }

  return response.data;
}

async function testNodeSettings(settings: StoredNodeSettings): Promise<QortiumNodeStatusResult> {
  let nodeApiUrl = getFallbackNodeApiUrl(settings);

  try {
    nodeApiUrl = await resolveNodeApiUrl(settings);

    return {
      ok: true,
      nodeApiUrl,
      status: await fetchNodeStatus(nodeApiUrl),
    };
  } catch (error) {
    if (settings.mode === 'network') {
      try {
        nodeApiUrl = await resolveNodeApiUrl(settings, true);

        return {
          ok: true,
          nodeApiUrl,
          status: await fetchNodeStatus(nodeApiUrl),
        };
      } catch (retryError) {
        return {
          ok: false,
          nodeApiUrl,
          message: retryError instanceof Error ? retryError.message : 'Unable to reach the configured node.',
        };
      }
    }

    return {
      ok: false,
      nodeApiUrl,
      message: error instanceof Error ? error.message : 'Unable to reach the configured node.',
    };
  }
}

async function requestConfiguredNode(
  settings: StoredNodeSettings,
  pathname: string,
  responseType: 'json' | 'text' = 'text',
) {
  const nodeApiUrl = await resolveNodeApiUrl(settings);

  try {
    return {
      nodeApiUrl,
      response: await requestNode(nodeApiUrl, pathname, responseType),
    };
  } catch (error) {
    if (settings.mode !== 'network') {
      throw error;
    }

    const retryNodeApiUrl = await resolveNodeApiUrl(settings, true);

    if (retryNodeApiUrl === nodeApiUrl) {
      throw error;
    }

    return {
      nodeApiUrl: retryNodeApiUrl,
      response: await requestNode(retryNodeApiUrl, pathname, responseType),
    };
  }
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

function getService(value: unknown) {
  const service = getString(value).toUpperCase();

  if (!service) {
    return '';
  }

  if (!PUBLIC_QDN_SERVICES.includes(service as (typeof PUBLIC_QDN_SERVICES)[number])) {
    throw new Error('Only public QDN services can be browsed right now.');
  }

  return service;
}

function normalizeResourceRequest(value: QortiumQdnAuthorizeRequest) {
  const service = getService(value.service);
  const name = getString(value.name);
  const identifier = getString(value.identifier);

  if (!service) {
    throw new Error('QDN resource service is required.');
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

function buildResourcesSearchPath(request: QortiumQdnResourcesSearchRequest) {
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

function buildRawResourcePath(resource: QortiumQdnRawResourceRequest) {
  const normalizedResource = normalizeResourceRequest(resource);
  const identifierPath = normalizedResource.identifier
    ? `/${encodeURIComponent(normalizedResource.identifier)}`
    : '';
  const { pathOnly, queryString } = splitPathAndQuery(getString(resource.path));
  const queryParams = new URLSearchParams(queryString);

  if (pathOnly) {
    queryParams.set('filepath', pathOnly);
  }

  const rawQueryString = queryParams.toString();

  return `/arbitrary/${normalizedResource.service}/${encodeURIComponent(
    normalizedResource.name,
  )}${identifierPath}${rawQueryString ? `?${rawQueryString}` : ''}`;
}

function createUnsupportedAccountsApi(): PlatformApi['accounts'] {
  const emptyState = {
    accounts: [],
    activeAccountId: null,
  };
  const unsupported = (): never => {
    throw new Error('Wallet management is only available in the desktop app right now.');
  };

  return {
    list: async () => emptyState,
    getProfile: async (accountId) => ({
      accountId,
      address: '',
      avatarUrl: null,
      label: '',
      name: null,
    }),
    selectWalletFile: async () => unsupported(),
    discardLoadedWallet: async () => undefined,
    saveLoadedWallet: async () => unsupported(),
    createWallet: async () => unsupported(),
    setActiveAccount: async () => emptyState,
    unlockWallet: async () => emptyState,
    lockWallet: async () => emptyState,
    removeWallet: async () => emptyState,
  };
}

function createFallbackApi(): PlatformApi {
  return {
    appName: 'Qortium Home',
    accounts: createUnsupportedAccountsApi(),
    node: {
      async getSettings() {
        return getNodeSettingsSnapshot(await readNodeSettings());
      },
      async saveSettings(request) {
        const settings = normalizeNodeSettingsRequest(request);

        await writeNodeSettings(settings);

        return getNodeSettingsSnapshot(settings);
      },
      async testConnection(request) {
        return testNodeSettings(normalizeNodeSettingsRequest(request));
      },
      async getStatus() {
        return testNodeSettings(await readNodeSettings());
      },
    },
    qdn: {
      async authorizeResource(request) {
        normalizeResourceRequest(request);
        const settings = await readNodeSettings();

        return {
          authorized: true,
          nodeApiUrl: await resolveNodeApiUrl(settings),
        };
      },
      async listResources(request) {
        const settings = await readNodeSettings();
        const { response } = await requestConfiguredNode(
          settings,
          buildResourcesSearchPath(request),
          'json',
        );

        if (response.status < 200 || response.status >= 300) {
          throw new Error(
            response.status === 403 && settings.mode === 'network'
              ? getNetworkRestrictionMessage()
              : stringifyResponseData(response.data) ||
              `QDN resource search failed with HTTP ${response.status}.`,
          );
        }

        return response.data;
      },
      async fetchNodeApi(request) {
        const settings = await readNodeSettings();
        const nodeApiUrl = await resolveNodeApiUrl(settings);
        const maxBytes = Math.max(0, Math.floor(getNumber(request.maxBytes) ?? 0));
        const { response } = await requestConfiguredNode(
          settings,
          getNodeApiPath(request.path, nodeApiUrl),
          'text',
        );
        const rawBody = stringifyResponseData(response.data);
        const body =
          response.status === 403 && settings.mode === 'network'
            ? getNetworkRestrictionMessage()
            : rawBody;
        const contentLength = getContentLength(response);
        const contentType = getContentType(response);
        const bodyLength = getByteLength(body);

        if (maxBytes > 0 && typeof contentLength === 'number' && contentLength > maxBytes) {
          return {
            contentLength,
            contentType,
            status: response.status,
            statusText: getStatusText(response.status),
            tooLarge: true,
          };
        }

        if (maxBytes > 0 && bodyLength > maxBytes) {
          return {
            contentLength: bodyLength,
            contentType,
            status: response.status,
            statusText: getStatusText(response.status),
            tooLarge: true,
          };
        }

        return {
          body,
          contentLength: contentLength ?? bodyLength,
          contentType,
          status: response.status,
          statusText: getStatusText(response.status),
          tooLarge: false,
        };
      },
      async fetchResourceText(request) {
        const settings = await readNodeSettings();
        const maxBytes = Math.max(0, Math.floor(getNumber(request.maxBytes) ?? 0));
        const { response } = await requestConfiguredNode(
          settings,
          buildRawResourcePath(request),
          'text',
        );

        if (response.status < 200 || response.status >= 300) {
          throw new Error(
            response.status === 403 && settings.mode === 'network'
              ? getNetworkRestrictionMessage()
              : stringifyResponseData(response.data) ||
              `QDN raw resource request failed with HTTP ${response.status}.`,
          );
        }

        const content = stringifyResponseData(response.data);
        const contentLength = getContentLength(response);
        const contentType = getContentType(response);
        const bodyLength = getByteLength(content);

        if (maxBytes > 0 && typeof contentLength === 'number' && contentLength > maxBytes) {
          return {
            contentLength,
            contentType,
            tooLarge: true,
          };
        }

        if (maxBytes > 0 && bodyLength > maxBytes) {
          return {
            contentLength: bodyLength,
            contentType,
            tooLarge: true,
          };
        }

        return {
          content,
          contentLength: contentLength ?? bodyLength,
          contentType,
          tooLarge: false,
        };
      },
      async downloadResource() {
        throw new Error('Saving QDN downloads is only available in the desktop app right now.');
      },
    },
  };
}

export function installQortiumHomeApiFallback() {
  if (window.qortiumHome) {
    return;
  }

  window.qortiumHome = createFallbackApi();
}
