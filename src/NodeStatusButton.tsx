import { Server, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Popover } from './components/Popover';

const NODE_API_URL = 'http://127.0.0.1:24891';
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

type DetailRow = {
  label: string;
  value: string;
};

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

  const displayStatus = getDisplayStatus(nodeStatus);
  const detailRows = useMemo<DetailRow[]>(() => {
    if (nodeStatus.state !== 'available') {
      return [
        { label: 'Node', value: NODE_API_URL },
        { label: 'Status', value: displayStatus },
        { label: 'Chain peers', value: '-' },
        { label: 'Data peers', value: '-' },
        { label: 'Height', value: '-' },
        { label: 'Sync', value: '-' },
      ];
    }

    return [
      { label: 'Node', value: NODE_API_URL },
      { label: 'Status', value: displayStatus },
      { label: 'Chain peers', value: nodeStatus.data.numberOfConnections.toLocaleString() },
      { label: 'Data peers', value: nodeStatus.data.numberOfDataConnections.toLocaleString() },
      { label: 'Height', value: nodeStatus.data.height.toLocaleString() },
      { label: 'Sync', value: formatPercent(nodeStatus.data.syncPercent) },
    ];
  }, [displayStatus, nodeStatus]);

  const Icon = displayStatus === 'Unavailable' ? WifiOff : Server;

  return (
    <Popover
      className="node-status"
      contentClassName="node-status__popover"
      contentId={popoverId}
      contentLabel="Node status details"
      renderTrigger={({ contentId, isOpen, toggle }) => (
        <button
          type="button"
          className={`node-status__button node-status__button--${displayStatus.toLowerCase()}`}
          aria-label={`Node status: ${displayStatus}`}
          aria-controls={isOpen ? contentId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          onClick={toggle}
        >
          <Icon aria-hidden="true" size={20} strokeWidth={2} />
          <span className="node-status__dot" aria-hidden="true" />
        </button>
      )}
    >
      <dl className="detail-list">
        {detailRows.map((row) => (
          <div className="detail-list__row" key={row.label}>
            <dt className="detail-list__label">{row.label}</dt>
            <dd className="detail-list__value">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Popover>
  );
}
