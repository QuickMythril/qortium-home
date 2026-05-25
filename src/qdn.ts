export const NODE_API_URL = 'http://127.0.0.1:62391';

export type QdnService = 'APP' | 'WEBSITE';

export type QdnExplorerRoute =
  | {
      displayUrl: string;
      kind: 'services';
    }
  | {
      displayUrl: string;
      kind: 'service';
      service: QdnService;
    }
  | {
      displayUrl: string;
      kind: 'name';
      name: string;
      service: QdnService;
    };

export type QdnResource = {
  displayUrl: string;
  identifier?: string;
  name: string;
  path: string;
  service: QdnService;
};

export type QdnRoute =
  | QdnExplorerRoute
  | {
      displayUrl: string;
      kind: 'resource';
      resource: QdnResource;
    };

export type QdnResourceStatus = {
  description?: string;
  id?: string;
  localChunkCount?: number;
  percentLoaded?: number;
  status?: string;
  title?: string;
  totalChunkCount?: number;
};

export type QdnResourceListItem = {
  created?: number;
  identifier?: string;
  latestSignature?: string;
  metadata?: {
    description?: string;
    title?: string;
  };
  name: string;
  service: QdnService;
  size?: number;
  status?: QdnResourceStatus;
};

type QdnParseResult =
  | {
      route: QdnRoute;
      success: true;
    }
  | {
      message: string;
      success: false;
    };

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function encodePath(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function splitPathAndQuery(path: string) {
  const queryIndex = path.indexOf('?');

  if (queryIndex === -1) {
    return {
      pathOnly: path,
      queryString: '',
    };
  }

  return {
    pathOnly: path.slice(0, queryIndex),
    queryString: path.slice(queryIndex + 1),
  };
}

function encodeDisplayPath(path: string) {
  if (!path) {
    return '/';
  }

  return path.startsWith('?') ? `/${path}` : `/${path}`;
}

function isQdnService(value: string): value is QdnService {
  return value === 'APP' || value === 'WEBSITE';
}

function buildQdnServiceUrl(service: QdnService) {
  return `qdn://${service}`;
}

function buildQdnNameUrl(service: QdnService, name: string) {
  return `${buildQdnServiceUrl(service)}/${encodeURIComponent(name)}`;
}

export function buildQdnDisplayUrl(resource: Omit<QdnResource, 'displayUrl'>) {
  return `qdn://${resource.service}/${encodeURIComponent(resource.name)}/${encodeURIComponent(
    resource.identifier ?? 'default',
  )}${encodeDisplayPath(resource.path)}`;
}

export function parseQdnUrl(value: string): QdnParseResult {
  const input = value.trim();

  if (!input) {
    return {
      success: false,
      message: 'Enter a QDN link.',
    };
  }

  if (!/^qdn:\/\//i.test(input)) {
    return {
      success: false,
      message: 'Enter a qdn:// APP or WEBSITE link.',
    };
  }

  const withoutProtocol = input.replace(/^qdn:\/\/?/i, '').trim();

  if (!/[^/]/.test(withoutProtocol)) {
    return {
      success: true,
      route: {
        kind: 'services',
        displayUrl: 'qdn://',
      },
    };
  }

  const queryIndex = withoutProtocol.indexOf('?');
  const basePart = queryIndex === -1 ? withoutProtocol : withoutProtocol.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? '' : withoutProtocol.slice(queryIndex + 1);
  const parts = basePart.replace(/^\/+/, '').split('/');
  const service = decodeSegment(parts.shift() ?? '').toUpperCase();

  if (!isQdnService(service)) {
    return {
      success: false,
      message: 'Only APP and WEBSITE QDN links can be loaded right now.',
    };
  }

  const name = decodeSegment(parts.shift() ?? '').trim();

  if (!name) {
    return {
      success: true,
      route: {
        kind: 'service',
        service,
        displayUrl: buildQdnServiceUrl(service),
      },
    };
  }

  const queryParams = new URLSearchParams(queryString);
  const queryIdentifier = queryParams.get('identifier')?.trim() || '';

  if (queryIdentifier) {
    queryParams.delete('identifier');
  }

  let identifier = queryIdentifier || decodeSegment(parts.shift() ?? '').trim();

  if (!identifier) {
    return {
      success: true,
      route: {
        kind: 'name',
        service,
        name,
        displayUrl: buildQdnNameUrl(service, name),
      },
    };
  }

  if (identifier.toLowerCase() === 'default') {
    identifier = '';
  }

  const pathOnly = parts.map(decodeSegment).join('/').replace(/^\/+/, '');
  const remainingQueryString = queryParams.toString();
  const path = `${pathOnly}${remainingQueryString ? `?${remainingQueryString}` : ''}`;
  const resource = {
    service,
    name,
    identifier: identifier || undefined,
    path,
  } satisfies Omit<QdnResource, 'displayUrl'>;

  return {
    success: true,
    route: {
      kind: 'resource',
      displayUrl: buildQdnDisplayUrl(resource),
      resource: {
        ...resource,
        displayUrl: buildQdnDisplayUrl(resource),
      },
    },
  };
}

export function getQdnResourceKey(resource: QdnResource) {
  return `${resource.service}:${resource.name}:${resource.identifier ?? 'default'}:${resource.path}`;
}

export function buildQdnStatusUrl(resource: QdnResource, build = false) {
  const identifierPath = resource.identifier ? `/${encodeURIComponent(resource.identifier)}` : '';
  const query = build ? '?build=true' : '';

  return `${NODE_API_URL}/arbitrary/resource/status/${resource.service}/${encodeURIComponent(
    resource.name,
  )}${identifierPath}${query}`;
}

export function buildQdnDownloadUrl(resource: QdnResource) {
  const identifierPath = resource.identifier ? `/${encodeURIComponent(resource.identifier)}` : '';

  return `${NODE_API_URL}/arbitrary/${resource.service}/${encodeURIComponent(
    resource.name,
  )}${identifierPath}?async=true`;
}

export function buildQdnResourcesSearchUrl(route: Extract<QdnExplorerRoute, { kind: 'service' | 'name' }>) {
  const queryParams = new URLSearchParams({
    service: route.service,
    mode: 'ALL',
    limit: '0',
    includestatus: 'true',
    includemetadata: 'true',
  });

  if (route.kind === 'name') {
    queryParams.set('name', route.name);
    queryParams.set('exactmatchnames', 'true');
  }

  return `${NODE_API_URL}/arbitrary/resources/search?${queryParams.toString()}`;
}

export function buildQdnRenderUrl(resource: QdnResource) {
  const { pathOnly, queryString } = splitPathAndQuery(resource.path);
  const encodedPath = encodePath(pathOnly);
  const pathSuffix = encodedPath ? `/${encodedPath}` : '';
  const queryParams = new URLSearchParams(queryString);

  if (resource.identifier) {
    queryParams.set('identifier', resource.identifier);
  }

  const renderQueryString = queryParams.toString();

  return `${NODE_API_URL}/render/${resource.service}/${encodeURIComponent(resource.name)}${pathSuffix}${
    renderQueryString ? `?${renderQueryString}` : ''
  }`;
}

export function isTerminalQdnStatus(status: string | undefined) {
  return (
    status === 'BLOCKED' ||
    status === 'BUILD_FAILED' ||
    status === 'FAILED_TO_DOWNLOAD' ||
    status === 'NOT_PUBLISHED' ||
    status === 'UNSUPPORTED'
  );
}

export function getQdnItemIdentifier(item: Pick<QdnResourceListItem, 'identifier'>) {
  return item.identifier || 'default';
}

export function buildQdnRouteFromListItem(item: QdnResourceListItem): QdnRoute {
  const resource = {
    service: item.service,
    name: item.name,
    identifier: item.identifier || undefined,
    path: '',
  } satisfies Omit<QdnResource, 'displayUrl'>;
  const displayUrl = buildQdnDisplayUrl(resource);

  return {
    kind: 'resource',
    displayUrl,
    resource: {
      ...resource,
      displayUrl,
    },
  };
}

export function formatQdnStatus(status: QdnResourceStatus | undefined) {
  switch (status?.status) {
    case 'BLOCKED':
      return 'Blocked';
    case 'BUILD_FAILED':
      return 'Build failed';
    case 'BUILDING':
      return 'Building';
    case 'DOWNLOADED':
      return 'Downloaded';
    case 'DOWNLOADING':
      return 'Downloading';
    case 'FAILED_TO_DOWNLOAD':
      return 'Download failed';
    case 'MISSING_DATA':
      return 'Waiting for data';
    case 'NOT_PUBLISHED':
      return 'Not published';
    case 'READY':
      return 'Ready';
    case 'REFETCHING':
      return 'Refetching';
    case 'SEARCHING':
      return 'Searching';
    case 'UNSUPPORTED':
      return 'Unsupported';
    default:
      return status?.status ? status.status : 'Checking';
  }
}
