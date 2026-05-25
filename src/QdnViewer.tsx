import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { QdnResource, QdnResourceStatus } from './qdn';
import {
  buildQdnDownloadUrl,
  buildQdnRenderUrl,
  buildQdnStatusUrl,
  formatQdnStatus,
  getQdnResourceKey,
  isTerminalQdnStatus,
} from './qdn';

const STATUS_POLL_INTERVAL_MS = 5_000;

type QdnViewerState =
  | {
      message: string;
      phase: 'loading';
      status?: QdnResourceStatus;
    }
  | {
      iframeUrl: string;
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

async function readStatus(response: Response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `QDN status request failed with HTTP ${response.status}.`);
  }

  return JSON.parse(text) as QdnResourceStatus;
}

async function verifyRenderUrl(iframeUrl: string, signal: AbortSignal) {
  const response = await fetch(iframeUrl, { signal });

  if (response.status === 404) {
    throw new Error('File not found.');
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `QDN render request failed with HTTP ${response.status}.`);
  }
}

export function QdnViewer({ resource }: QdnViewerProps) {
  const [state, setState] = useState<QdnViewerState>({
    phase: 'loading',
    message: 'Checking QDN resource',
  });
  const [retryToken, setRetryToken] = useState(0);
  const resourceKey = useMemo(() => getQdnResourceKey(resource), [resource]);
  const progress = state.phase === 'ready' ? 100 : getStatusProgress(state.status);
  const progressText = getProgressText(state.status);
  const statusLabel = state.phase === 'ready' ? 'Ready' : formatQdnStatus(state.status);

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

    async function pollStatus(build: boolean) {
      try {
        const statusResponse = await fetch(buildQdnStatusUrl(resource, build), {
          signal: abortController.signal,
        });
        const status = await readStatus(statusResponse);

        if (status.status === 'READY') {
          const iframeUrl = buildQdnRenderUrl(resource);

          await verifyRenderUrl(iframeUrl, abortController.signal);
          setSafeState({
            phase: 'ready',
            iframeUrl,
            status,
          });
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
        <iframe
          className="qdn-viewer__frame"
          key={state.iframeUrl}
          title={resource.displayUrl}
          src={state.iframeUrl}
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
          allow="fullscreen; clipboard-read; clipboard-write; screen-wake-lock"
        />
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
