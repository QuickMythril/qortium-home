import type { QdnRoute } from './qdn';
import { parseQdnUrl } from './qdn';

export type NodeApiRoute = {
  displayUrl: string;
  kind: 'node-api';
  path: string;
};

export type AppRoute = NodeApiRoute | QdnRoute;

type RouteParseResult =
  | {
      route: AppRoute;
      success: true;
    }
  | {
      message: string;
      success: false;
    };

const LOCAL_NODE_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);

function buildNodeApiRoute(path: string, displayUrl = path): NodeApiRoute {
  return {
    kind: 'node-api',
    path,
    displayUrl,
  };
}

function getCurrentNodeUrl(nodeApiUrl: string) {
  return new URL(nodeApiUrl);
}

function isCurrentNodeUrl(url: URL, nodeApiUrl: string) {
  const currentNodeUrl = getCurrentNodeUrl(nodeApiUrl);
  const bothLocal =
    LOCAL_NODE_HOSTNAMES.has(url.hostname) && LOCAL_NODE_HOSTNAMES.has(currentNodeUrl.hostname);

  return (
    url.protocol === currentNodeUrl.protocol &&
    url.port === currentNodeUrl.port &&
    (url.hostname === currentNodeUrl.hostname || bothLocal)
  );
}

function parseNodeApiAddress(input: string, nodeApiUrl: string): RouteParseResult | undefined {
  if (input.startsWith('//')) {
    return {
      success: false,
      message: 'Node API paths must start with a single /.',
    };
  }

  if (input.startsWith('/')) {
    return {
      success: true,
      route: buildNodeApiRoute(input),
    };
  }

  if (!/^https?:\/\//i.test(input)) {
    return undefined;
  }

  let url: URL;

  try {
    url = new URL(input);
  } catch {
    return {
      success: false,
      message: 'Enter a valid node API URL.',
    };
  }

  if (!isCurrentNodeUrl(url, nodeApiUrl)) {
    return {
      success: false,
      message: `Only ${nodeApiUrl} API URLs can be loaded right now.`,
    };
  }

  return {
    success: true,
    route: buildNodeApiRoute(`${url.pathname}${url.search}`, input),
  };
}

export function parseAppAddress(value: string, nodeApiUrl: string): RouteParseResult {
  const input = value.trim();

  if (!input || /^qdn:\/\//i.test(input)) {
    return parseQdnUrl(input);
  }

  const nodeApiRoute = parseNodeApiAddress(input, nodeApiUrl);

  if (nodeApiRoute) {
    return nodeApiRoute;
  }

  return {
    success: false,
    message: 'Enter a qdn:// link, a /node/api/path, or a node API URL.',
  };
}
