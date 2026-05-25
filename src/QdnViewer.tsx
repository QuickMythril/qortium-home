import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { QdnResource, QdnResourceProperties, QdnResourceStatus, QdnViewerKind } from './qdn';
import {
  buildQdnDownloadUrl,
  buildQdnRawResourceUrl,
  buildQdnRenderUrl,
  buildQdnResourcePropertiesUrl,
  buildQdnStatusUrl,
  formatQdnStatus,
  getQdnResourceKey,
  getQdnViewerKind,
  isTerminalQdnStatus,
} from './qdn';

const STATUS_POLL_INTERVAL_MS = 5_000;

type LoadedQdnResource = {
  properties?: QdnResourceProperties;
  rawUrl: string;
  renderUrl: string;
  status: QdnResourceStatus;
  viewerKind: QdnViewerKind;
};

type QdnViewerState =
  | {
      message: string;
      phase: 'loading';
      status?: QdnResourceStatus;
    }
  | {
      loadedResource: LoadedQdnResource;
      phase: 'ready';
      status: QdnResourceStatus;
    }
  | {
      message: string;
      phase: 'error';
      status?: QdnResourceStatus;
    };

type QdnViewerProps = {
  resource: QdnResource;
};

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to load QDN resource.';
  }

  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function getStatusProgress(status: QdnResourceStatus | undefined) {
  if (!status) {
    return undefined;
  }

  if (typeof status.percentLoaded === 'number') {
    return Math.max(0, Math.min(100, status.percentLoaded));
  }

  if (
    typeof status.localChunkCount === 'number' &&
    typeof status.totalChunkCount === 'number' &&
    status.totalChunkCount > 0
  ) {
    return Math.max(0, Math.min(100, (status.localChunkCount / status.totalChunkCount) * 100));
  }

  return undefined;
}

function getProgressText(status: QdnResourceStatus | undefined) {
  if (!status) {
    return '';
  }

  const progress = getStatusProgress(status);

  if (typeof status.localChunkCount === 'number' && typeof status.totalChunkCount === 'number') {
    return `${status.localChunkCount.toLocaleString()} / ${status.totalChunkCount.toLocaleString()} chunks${
      typeof progress === 'number' ? `, ${progress.toFixed(0)}%` : ''
    }`;
  }

  return typeof progress === 'number' ? `${progress.toFixed(0)}%` : '';
}

function formatBytes(bytes: number | undefined) {
  if (typeof bytes !== 'number') {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes.toLocaleString()} bytes`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

async function readStatus(response: Response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `QDN status request failed with HTTP ${response.status}.`);
  }

  return JSON.parse(text) as QdnResourceStatus;
}

function isQdnResourceProperties(value: unknown): value is QdnResourceProperties {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const properties = value as Partial<QdnResourceProperties>;

  return (
    (properties.filename === undefined || typeof properties.filename === 'string') &&
    (properties.mimeType === undefined || typeof properties.mimeType === 'string') &&
    (properties.size === undefined || typeof properties.size === 'number')
  );
}

async function readProperties(response: Response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `QDN properties request failed with HTTP ${response.status}.`);
  }

  const data: unknown = JSON.parse(text);

  if (!isQdnResourceProperties(data)) {
    throw new Error('QDN properties response did not match the expected shape.');
  }

  return data;
}

async function loadResourceProperties(resource: QdnResource, signal: AbortSignal) {
  try {
    const response = await fetch(buildQdnResourcePropertiesUrl(resource), {
      signal,
    });

    return await readProperties(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    return undefined;
  }
}

async function verifyRenderUrl(renderUrl: string, signal: AbortSignal) {
  const response = await fetch(renderUrl, { signal });

  if (response.status === 404) {
    throw new Error('File not found.');
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `QDN render request failed with HTTP ${response.status}.`);
  }

  await response.body?.cancel();
}

function useQdnResourceLoader(resource: QdnResource, retryToken: number) {
  const [state, setState] = useState<QdnViewerState>({
    phase: 'loading',
    message: 'Checking QDN resource',
  });
  const resourceKey = useMemo(() => getQdnResourceKey(resource), [resource]);

  useEffect(() => {
    const abortController = new AbortController();
    let isDisposed = false;
    let timeoutId: number | undefined;
    let hasTriggeredDownload = false;

    function setSafeState(nextState: QdnViewerState) {
      if (!isDisposed) {
        setState(nextState);
      }
    }

    async function triggerDownload() {
      if (hasTriggeredDownload) {
        return;
      }

      hasTriggeredDownload = true;

      try {
        await fetch(buildQdnDownloadUrl(resource), {
          signal: abortController.signal,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    async function setReadyState(status: QdnResourceStatus) {
      const viewerKind = getQdnViewerKind(resource.service);
      const renderUrl = buildQdnRenderUrl(resource);
      const rawUrl = buildQdnRawResourceUrl(resource);

      if (viewerKind !== 'unsupported') {
        await verifyRenderUrl(renderUrl, abortController.signal);
      }

      const properties = await loadResourceProperties(resource, abortController.signal);

      setSafeState({
        phase: 'ready',
        status,
        loadedResource: {
          properties,
          rawUrl,
          renderUrl,
          status,
          viewerKind,
        },
      });
    }

    async function pollStatus(build: boolean) {
      try {
        const statusResponse = await fetch(buildQdnStatusUrl(resource, build), {
          signal: abortController.signal,
        });
        const status = await readStatus(statusResponse);

        if (status.status === 'READY') {
          await setReadyState(status);
          return;
        }

        if (isTerminalQdnStatus(status.status)) {
          setSafeState({
            phase: 'error',
            message: formatQdnStatus(status),
            status,
          });
          return;
        }

        setSafeState({
          phase: 'loading',
          message: formatQdnStatus(status),
          status,
        });

        void triggerDownload();
        timeoutId = window.setTimeout(() => {
          void pollStatus(status.status === 'DOWNLOADED');
        }, STATUS_POLL_INTERVAL_MS);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setSafeState({
          phase: 'error',
          message: formatError(error),
        });
      }
    }

    async function loadResource() {
      setSafeState({
        phase: 'loading',
        message: 'Authorizing QDN resource',
      });

      try {
        await window.qortiumHome.qdn.authorizeResource({
          service: resource.service,
          name: resource.name,
          identifier: resource.identifier,
        });
        await pollStatus(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setSafeState({
          phase: 'error',
          message: formatError(error),
        });
      }
    }

    void loadResource();

    return () => {
      isDisposed = true;
      abortController.abort();

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [resource, resourceKey, retryToken]);

  return state;
}

function QdnReadyContent({
  loadedResource,
  resource,
}: {
  loadedResource: LoadedQdnResource;
  resource: QdnResource;
}) {
  if (loadedResource.viewerKind === 'iframe') {
    return (
      <iframe
        className="qdn-viewer__frame"
        key={loadedResource.renderUrl}
        title={resource.displayUrl}
        src={loadedResource.renderUrl}
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
        allow="fullscreen; clipboard-read; clipboard-write; screen-wake-lock"
      />
    );
  }

  if (loadedResource.viewerKind === 'image') {
    return (
      <div className="qdn-viewer__image-stage">
        <img
          className="qdn-viewer__image"
          alt={loadedResource.properties?.filename || resource.displayUrl}
          src={loadedResource.renderUrl}
        />
      </div>
    );
  }

  return (
    <div className="qdn-viewer__empty qdn-viewer__empty--ready">
      <div className="qdn-viewer__details">
        <p className="qdn-viewer__message">{resource.service} resources do not have a viewer yet.</p>
        <dl className="detail-list qdn-viewer__detail-list">
          <div className="detail-list__row">
            <dt className="detail-list__label">Service</dt>
            <dd className="detail-list__value">{resource.service}</dd>
          </div>
          <div className="detail-list__row">
            <dt className="detail-list__label">Status</dt>
            <dd className="detail-list__value">{formatQdnStatus(loadedResource.status)}</dd>
          </div>
          {loadedResource.properties?.filename ? (
            <div className="detail-list__row">
              <dt className="detail-list__label">File</dt>
              <dd className="detail-list__value">{loadedResource.properties.filename}</dd>
            </div>
          ) : null}
          {loadedResource.properties?.mimeType ? (
            <div className="detail-list__row">
              <dt className="detail-list__label">Type</dt>
              <dd className="detail-list__value">{loadedResource.properties.mimeType}</dd>
            </div>
          ) : null}
          {loadedResource.properties?.size ? (
            <div className="detail-list__row">
              <dt className="detail-list__label">Size</dt>
              <dd className="detail-list__value">{formatBytes(loadedResource.properties.size)}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

export function QdnViewer({ resource }: QdnViewerProps) {
  const [retryToken, setRetryToken] = useState(0);
  const state = useQdnResourceLoader(resource, retryToken);
  const progress = state.phase === 'ready' ? 100 : getStatusProgress(state.status);
  const progressText = getProgressText(state.status);
  const statusLabel = state.phase === 'ready' ? 'Ready' : formatQdnStatus(state.status);

  return (
    <section className="qdn-viewer" aria-label="QDN viewer">
      <div className="qdn-viewer__status" aria-live="polite">
        <div className="qdn-viewer__status-text">
          <span className="qdn-viewer__status-label">{statusLabel}</span>
          <span className="qdn-viewer__resource">{resource.displayUrl}</span>
        </div>
        {typeof progress === 'number' && state.phase !== 'ready' ? (
          <div className="qdn-viewer__progress" aria-label="QDN loading progress">
            <div
              className="qdn-viewer__progress-bar"
              role="progressbar"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(progress)}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            {progressText ? <span className="qdn-viewer__progress-text">{progressText}</span> : null}
          </div>
        ) : null}
      </div>

      {state.phase === 'ready' ? (
        <QdnReadyContent loadedResource={state.loadedResource} resource={resource} />
      ) : (
        <div className={`qdn-viewer__empty qdn-viewer__empty--${state.phase}`}>
          <p className="qdn-viewer__message">{state.message}</p>
          {state.phase === 'error' ? (
            <button
              className="button qdn-viewer__retry"
              type="button"
              onClick={() => setRetryToken((currentToken) => currentToken + 1)}
            >
              <RefreshCw aria-hidden="true" size={18} strokeWidth={2} />
              Retry
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
