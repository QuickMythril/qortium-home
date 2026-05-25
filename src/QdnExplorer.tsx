import { FileText, Folder, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { QdnExplorerRoute, QdnResourceListItem, QdnRoute, QdnService } from './qdn';
import {
  buildQdnResourcesSearchUrl,
  buildQdnRouteFromListItem,
  formatQdnStatus,
  getQdnItemIdentifier,
} from './qdn';

type QdnExplorerProps = {
  onNavigate: (route: QdnRoute) => void;
  route: QdnExplorerRoute;
};

type QdnExplorerState =
  | {
      phase: 'idle';
      resources: QdnResourceListItem[];
    }
  | {
      phase: 'loading';
      resources: QdnResourceListItem[];
    }
  | {
      message: string;
      phase: 'error';
      resources: QdnResourceListItem[];
    };

type NameRow = {
  count: number;
  created?: number;
  name: string;
  status?: QdnResourceListItem['status'];
};

const SUPPORTED_SERVICES: QdnService[] = ['APP', 'WEBSITE'];

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to load QDN resources.';
  }

  return error.message;
}

function isQdnResourceListItem(value: unknown): value is QdnResourceListItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<QdnResourceListItem>;

  return (
    typeof item.name === 'string' &&
    (item.service === 'APP' || item.service === 'WEBSITE') &&
    (item.identifier === undefined || typeof item.identifier === 'string')
  );
}

async function readResources(response: Response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `QDN resource list request failed with HTTP ${response.status}.`);
  }

  const data: unknown = JSON.parse(text);

  if (!Array.isArray(data)) {
    throw new Error('QDN resource list response did not match the expected shape.');
  }

  return data.filter(isQdnResourceListItem);
}

function formatDate(timestamp: number | undefined) {
  if (!timestamp) {
    return '';
  }

  return new Date(timestamp).toLocaleString();
}

function getNameRows(resources: QdnResourceListItem[]) {
  const rowsByName = new Map<string, NameRow>();

  for (const resource of resources) {
    const currentRow = rowsByName.get(resource.name);
    const currentCreated = currentRow?.created ?? 0;
    const nextCreated = resource.created ?? 0;

    rowsByName.set(resource.name, {
      name: resource.name,
      count: (currentRow?.count ?? 0) + 1,
      created: Math.max(currentCreated, nextCreated) || undefined,
      status: nextCreated >= currentCreated ? resource.status : currentRow?.status,
    });
  }

  return [...rowsByName.values()].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: 'base' }),
  );
}

function getRouteHeading(route: QdnExplorerRoute) {
  if (route.kind === 'services') {
    return 'QDN';
  }

  if (route.kind === 'service') {
    return route.service;
  }

  return `${route.service} / ${route.name}`;
}

export function QdnExplorer({ onNavigate, route }: QdnExplorerProps) {
  const [state, setState] = useState<QdnExplorerState>({
    phase: 'idle',
    resources: [],
  });
  const [retryToken, setRetryToken] = useState(0);
  const nameRows = useMemo(() => getNameRows(state.resources), [state.resources]);

  useEffect(() => {
    if (route.kind === 'services') {
      setState({
        phase: 'idle',
        resources: [],
      });
      return;
    }

    const abortController = new AbortController();
    let isDisposed = false;

    async function loadResources() {
      setState((currentState) => ({
        phase: 'loading',
        resources: currentState.resources,
      }));

      try {
        const response = await fetch(buildQdnResourcesSearchUrl(route), {
          signal: abortController.signal,
        });
        const resources = await readResources(response);

        if (!isDisposed) {
          setState({
            phase: 'idle',
            resources,
          });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        if (!isDisposed) {
          setState((currentState) => ({
            phase: 'error',
            resources: currentState.resources,
            message: formatError(error),
          }));
        }
      }
    }

    void loadResources();

    return () => {
      isDisposed = true;
      abortController.abort();
    };
  }, [route, retryToken]);

  return (
    <section className="qdn-explorer" aria-label="QDN explorer">
      <header className="qdn-explorer__header">
        <div className="qdn-explorer__heading">
          <h2>{getRouteHeading(route)}</h2>
          <p>{route.displayUrl}</p>
        </div>
        {route.kind !== 'services' ? (
          <button
            className="button button--secondary qdn-explorer__refresh"
            type="button"
            disabled={state.phase === 'loading'}
            onClick={() => setRetryToken((currentToken) => currentToken + 1)}
          >
            <RefreshCw aria-hidden="true" size={18} strokeWidth={2} />
            Refresh
          </button>
        ) : null}
      </header>

      {state.phase === 'error' ? (
        <p className="qdn-explorer__message qdn-explorer__message--error">{state.message}</p>
      ) : null}

      {route.kind === 'services' ? (
        <div className="qdn-explorer__list" role="list">
          {SUPPORTED_SERVICES.map((service) => (
            <button
              className="qdn-explorer__row"
              key={service}
              type="button"
              role="listitem"
              onClick={() =>
                onNavigate({
                  kind: 'service',
                  service,
                  displayUrl: `qdn://${service}`,
                })
              }
            >
              <Folder aria-hidden="true" className="qdn-explorer__row-icon" size={22} strokeWidth={2} />
              <span className="qdn-explorer__row-main">
                <span className="qdn-explorer__row-title">{service}</span>
                <span className="qdn-explorer__row-subtitle">Browse published {service} names</span>
              </span>
              <span className="qdn-explorer__row-meta">Service</span>
            </button>
          ))}
        </div>
      ) : null}

      {route.kind === 'service' ? (
        <>
          {state.phase === 'loading' && state.resources.length === 0 ? (
            <p className="qdn-explorer__message">Loading published names</p>
          ) : null}
          {state.phase !== 'loading' && nameRows.length === 0 && state.phase !== 'error' ? (
            <p className="qdn-explorer__message">No published {route.service} resources found.</p>
          ) : null}
          {nameRows.length > 0 ? (
            <div className="qdn-explorer__list" role="list">
              {nameRows.map((row) => (
                <button
                  className="qdn-explorer__row"
                  key={row.name}
                  type="button"
                  role="listitem"
                  onClick={() =>
                    onNavigate({
                      kind: 'name',
                      service: route.service,
                      name: row.name,
                      displayUrl: `qdn://${route.service}/${encodeURIComponent(row.name)}`,
                    })
                  }
                >
                  <Folder aria-hidden="true" className="qdn-explorer__row-icon" size={22} strokeWidth={2} />
                  <span className="qdn-explorer__row-main">
                    <span className="qdn-explorer__row-title">{row.name}</span>
                    <span className="qdn-explorer__row-subtitle">
                      {row.count.toLocaleString()} {row.count === 1 ? 'resource' : 'resources'}
                    </span>
                  </span>
                  <span className="qdn-explorer__row-meta">{formatQdnStatus(row.status)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {route.kind === 'name' ? (
        <>
          {state.phase === 'loading' && state.resources.length === 0 ? (
            <p className="qdn-explorer__message">Loading published resources</p>
          ) : null}
          {state.phase !== 'loading' && state.resources.length === 0 && state.phase !== 'error' ? (
            <p className="qdn-explorer__message">No published {route.service} resources found for this name.</p>
          ) : null}
          {state.resources.length > 0 ? (
            <div className="qdn-explorer__list" role="list">
              {state.resources
                .slice()
                .sort((first, second) =>
                  getQdnItemIdentifier(first).localeCompare(getQdnItemIdentifier(second), undefined, {
                    sensitivity: 'base',
                  }),
                )
                .map((resource) => (
                  <button
                    className="qdn-explorer__row"
                    key={`${resource.service}:${resource.name}:${getQdnItemIdentifier(resource)}`}
                    type="button"
                    role="listitem"
                    onClick={() => onNavigate(buildQdnRouteFromListItem(resource))}
                  >
                    <FileText aria-hidden="true" className="qdn-explorer__row-icon" size={22} strokeWidth={2} />
                    <span className="qdn-explorer__row-main">
                      <span className="qdn-explorer__row-title">{getQdnItemIdentifier(resource)}</span>
                      <span className="qdn-explorer__row-subtitle">
                        {resource.metadata?.title || resource.metadata?.description || 'Published QDN resource'}
                      </span>
                    </span>
                    <span className="qdn-explorer__row-meta">
                      {formatQdnStatus(resource.status)}
                      {resource.size ? `, ${resource.size.toLocaleString()} bytes` : ''}
                      {resource.created ? `, ${formatDate(resource.created)}` : ''}
                    </span>
                  </button>
                ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
