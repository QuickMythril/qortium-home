import { Server, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const NODE_API_URL = 'http://127.0.0.1:62391';
const STATUS_REFRESH_MS = 15_000;

type NodeStatusResponse = {
  isMintingPossible: boolean;
  isSynchronizing: boolean;
  syncPercent?: number | null;
  numberOfConnections: number;
  numberOfDataConnections: number;
  height: number;
};

type NodeStatusState =
  | { state: 'loading' }
  | { state: 'available'; data: NodeStatusResponse }
  | { state: 'unavailable' };

type DisplayStatus = 'Checking' | 'Unavailable' | 'Syncing' | 'Minting' | 'Synced';

function isNodeStatusResponse(value: unknown): value is NodeStatusResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const status = value as Partial<NodeStatusResponse>;

  return (
    typeof status.isMintingPossible === 'boolean' &&
    typeof status.isSynchronizing === 'boolean' &&
    typeof status.numberOfConnections === 'number' &&
    typeof status.numberOfDataConnections === 'number' &&
    typeof status.height === 'number' &&
    (status.syncPercent === undefined ||
      status.syncPercent === null ||
      typeof status.syncPercent === 'number')
  );
}

function getDisplayStatus(status: NodeStatusState): DisplayStatus {
  if (status.state === 'loading') {
    return 'Checking';
  }

  if (status.state === 'unavailable') {
    return 'Unavailable';
  }

  if (status.data.isSynchronizing) {
    return 'Syncing';
  }

  if (status.data.isMintingPossible) {
    return 'Minting';
  }

  return 'Synced';
}

function formatPercent(syncPercent: number | null | undefined) {
  return typeof syncPercent === 'number' ? `${syncPercent.toFixed(0)}%` : 'Unknown';
}

export function NodeStatusButton() {
  const [nodeStatus, setNodeStatus] = useState<NodeStatusState>({ state: 'loading' });
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = 'node-status-details';

  useEffect(() => {
    let isMounted = true;
    let activeController: AbortController | undefined;

    async function loadNodeStatus() {
      activeController?.abort();
      activeController = new AbortController();

      try {
        const response = await fetch(`${NODE_API_URL}/admin/status`, {
          signal: activeController.signal,
        });

        if (!response.ok) {
          throw new Error(`Node status request failed with ${response.status}`);
        }

        const data: unknown = await response.json();

        if (!isNodeStatusResponse(data)) {
          throw new Error('Node status response did not match the expected shape');
        }

        if (isMounted) {
          setNodeStatus({ state: 'available', data });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        if (isMounted) {
          setNodeStatus({ state: 'unavailable' });
        }
      }
    }

    void loadNodeStatus();
    const refreshInterval = window.setInterval(loadNodeStatus, STATUS_REFRESH_MS);

    return () => {
      isMounted = false;
      activeController?.abort();
      window.clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const displayStatus = getDisplayStatus(nodeStatus);
  const detailRows = useMemo(() => {
    if (nodeStatus.state !== 'available') {
      return [
        ['Node', NODE_API_URL],
        ['Status', displayStatus],
        ['Chain peers', '-'],
        ['Data peers', '-'],
        ['Height', '-'],
        ['Sync', '-'],
      ];
    }

    return [
      ['Node', NODE_API_URL],
      ['Status', displayStatus],
      ['Chain peers', nodeStatus.data.numberOfConnections.toLocaleString()],
      ['Data peers', nodeStatus.data.numberOfDataConnections.toLocaleString()],
      ['Height', nodeStatus.data.height.toLocaleString()],
      ['Sync', formatPercent(nodeStatus.data.syncPercent)],
    ];
  }, [displayStatus, nodeStatus]);

  const Icon = displayStatus === 'Unavailable' ? WifiOff : Server;

  return (
    <div className="node-status">
      <button
        type="button"
        className={`node-status__button node-status__button--${displayStatus.toLowerCase()}`}
        aria-label={`Node status: ${displayStatus}`}
        aria-controls={isOpen ? popoverId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Icon aria-hidden="true" size={20} strokeWidth={2} />
        <span className="node-status__dot" aria-hidden="true" />
      </button>

      {isOpen ? (
        <section
          className="node-status__popover"
          id={popoverId}
          role="dialog"
          aria-label="Node status details"
        >
          <dl className="node-status__details">
            {detailRows.map(([label, value]) => (
              <div className="node-status__row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
