import { Check, RefreshCw, Server, WifiOff } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AppUpdatePanel } from './AppUpdatePanel';
import { CoreManagerPanel } from './CoreManagerPanel';
import { Popover } from './components/Popover';

const STATUS_REFRESH_MS = 15_000;

type NodeStatusResponse = {
  height: number;
  isMintingPossible: boolean;
  isSynchronizing: boolean;
  numberOfConnections: number;
  numberOfDataConnections: number;
  syncBlocksRemaining?: null | number;
  syncPhase?: null | string;
  syncPercent?: null | number;
  syncTargetHeight?: null | number;
};

type NodeStatusState =
  | { state: 'loading' }
  | { data: NodeStatusResponse; nodeApiUrl: string; state: 'available' }
  | { message?: string; nodeApiUrl?: string; state: 'unavailable' };

type DisplayStatus =
  | 'Behind'
  | 'Connecting'
  | 'Synced'
  | 'Synchronizing'
  | 'Unavailable';

type DetailRow = {
  label: string;
  value: string;
};

type ConfigMessage = {
  kind: 'error' | 'success';
  text: string;
} | null;

type NodeStatusButtonProps = {
  nodeSettings: QortiumNodeSettings;
  onResolvedNodeApiUrl: (nodeApiUrl: string) => void;
  onSaveNodeSettings: (request: QortiumNodeSettingsRequest) => Promise<QortiumNodeSettings>;
};

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to update node settings.';
  }

  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

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
    (status.syncBlocksRemaining === undefined ||
      status.syncBlocksRemaining === null ||
      typeof status.syncBlocksRemaining === 'number') &&
    (status.syncPhase === undefined ||
      status.syncPhase === null ||
      typeof status.syncPhase === 'string') &&
    (status.syncPercent === undefined ||
      status.syncPercent === null ||
      typeof status.syncPercent === 'number') &&
    (status.syncTargetHeight === undefined ||
      status.syncTargetHeight === null ||
      typeof status.syncTargetHeight === 'number')
  );
}

function getDisplayStatus(status: NodeStatusState): DisplayStatus {
  if (status.state === 'loading') {
    return 'Connecting';
  }

  if (status.state === 'unavailable') {
    return 'Unavailable';
  }

  const syncPhase = status.data.syncPhase?.toUpperCase();

  if (syncPhase === 'CONNECTING') {
    return 'Connecting';
  }

  if (syncPhase === 'SYNCHRONIZING') {
    return 'Synchronizing';
  }

  if (syncPhase === 'BEHIND') {
    return 'Behind';
  }

  if (syncPhase === 'SYNCED') {
    if (status.data.isSynchronizing || getPositiveNumber(status.data.syncBlocksRemaining) > 0) {
      return 'Synchronizing';
    }

    return 'Synced';
  }

  if (syncPhase) {
    return 'Synchronizing';
  }

  if (status.data.isSynchronizing) {
    return 'Synchronizing';
  }

  if (getPositiveNumber(status.data.syncBlocksRemaining) > 0) {
    return 'Behind';
  }

  if (
    typeof status.data.syncTargetHeight === 'number' &&
    Number.isFinite(status.data.syncTargetHeight) &&
    status.data.height < status.data.syncTargetHeight
  ) {
    return 'Behind';
  }

  if (
    typeof status.data.syncPercent === 'number' &&
    Number.isFinite(status.data.syncPercent) &&
    status.data.syncPercent < 100
  ) {
    return 'Synchronizing';
  }

  return 'Synced';
}

function getPositiveNumber(value: null | number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function formatBoolean(value: boolean) {
  return value ? 'Yes' : 'No';
}

function formatNumber(value: null | number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '-';
}

function formatPercent(syncPercent: null | number | undefined) {
  return typeof syncPercent === 'number' ? `${syncPercent.toFixed(0)}%` : 'Unknown';
}

function formatSyncPhase(syncPhase: null | string | undefined) {
  if (!syncPhase) {
    return 'Legacy status';
  }

  return syncPhase
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getNodeSettingsRequest(mode: QortiumNodeSettingsMode, customUrl: string) {
  return {
    mode,
    customUrl: customUrl.trim() || undefined,
  };
}

export function NodeStatusButton({
  nodeSettings,
  onResolvedNodeApiUrl,
  onSaveNodeSettings,
}: NodeStatusButtonProps) {
  const [nodeStatus, setNodeStatus] = useState<NodeStatusState>({ state: 'loading' });
  const [mode, setMode] = useState<QortiumNodeSettingsMode>(nodeSettings.mode);
  const [customUrl, setCustomUrl] = useState(nodeSettings.customUrl);
  const [configMessage, setConfigMessage] = useState<ConfigMessage>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const popoverId = 'node-status-details';

  useEffect(() => {
    setMode(nodeSettings.mode);
    setCustomUrl(nodeSettings.customUrl);
  }, [nodeSettings]);

  useEffect(() => {
    let isMounted = true;

    setNodeStatus({ state: 'loading' });

    async function loadNodeStatus() {
      try {
        const result = await window.qortiumHome.node.getStatus();

        if (!isMounted) {
          return;
        }

        if (result.ok && isNodeStatusResponse(result.status)) {
          onResolvedNodeApiUrl(result.nodeApiUrl);
          setNodeStatus({ state: 'available', data: result.status, nodeApiUrl: result.nodeApiUrl });
          return;
        }

        setNodeStatus({
          state: 'unavailable',
          nodeApiUrl: result.nodeApiUrl,
          message: result.ok ? 'Node status response did not match the expected shape.' : result.message,
        });
      } catch (error) {
        if (isMounted) {
          setNodeStatus({
            state: 'unavailable',
            message: formatError(error),
          });
        }
      }
    }

    void loadNodeStatus();
    const refreshInterval = window.setInterval(loadNodeStatus, STATUS_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
    };
  }, [nodeSettings.nodeApiUrl, onResolvedNodeApiUrl]);

  const displayStatus = getDisplayStatus(nodeStatus);
  const activeNodeApiUrl =
    nodeStatus.state === 'available' || nodeStatus.state === 'unavailable'
      ? nodeStatus.nodeApiUrl || nodeSettings.nodeApiUrl
      : nodeSettings.nodeApiUrl;
  const detailRows = useMemo<DetailRow[]>(() => {
    const rows: DetailRow[] =
      nodeStatus.state === 'available'
        ? [
            { label: 'Node', value: activeNodeApiUrl },
            { label: 'Status', value: displayStatus },
            { label: 'Phase', value: formatSyncPhase(nodeStatus.data.syncPhase) },
            { label: 'Progress', value: formatPercent(nodeStatus.data.syncPercent) },
            { label: 'Blocks left', value: formatNumber(nodeStatus.data.syncBlocksRemaining) },
            { label: 'Target', value: formatNumber(nodeStatus.data.syncTargetHeight) },
            { label: 'Height', value: nodeStatus.data.height.toLocaleString() },
            { label: 'Chain peers', value: nodeStatus.data.numberOfConnections.toLocaleString() },
            { label: 'Data peers', value: nodeStatus.data.numberOfDataConnections.toLocaleString() },
            { label: 'Minting', value: formatBoolean(nodeStatus.data.isMintingPossible) },
          ]
        : [
            { label: 'Node', value: activeNodeApiUrl },
            { label: 'Status', value: displayStatus },
            { label: 'Phase', value: '-' },
            { label: 'Progress', value: '-' },
            { label: 'Blocks left', value: '-' },
            { label: 'Target', value: '-' },
            { label: 'Height', value: '-' },
            { label: 'Chain peers', value: '-' },
            { label: 'Data peers', value: '-' },
            { label: 'Minting', value: '-' },
          ];

    if (nodeStatus.state === 'unavailable' && nodeStatus.message) {
      rows.push({
        label: 'Error',
        value: nodeStatus.message,
      });
    }

    return rows;
  }, [activeNodeApiUrl, displayStatus, nodeStatus]);

  async function handleTestConnection() {
    setIsTesting(true);
    setConfigMessage(null);

    try {
      const result = await window.qortiumHome.node.testConnection(getNodeSettingsRequest(mode, customUrl));

      if (result.ok) {
        onResolvedNodeApiUrl(result.nodeApiUrl);
      }

      setConfigMessage({
        kind: result.ok ? 'success' : 'error',
        text: result.ok ? `Connected to ${result.nodeApiUrl}.` : result.message,
      });
    } catch (error) {
      setConfigMessage({
        kind: 'error',
        text: formatError(error),
      });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setConfigMessage(null);

    try {
      const settings = await onSaveNodeSettings(getNodeSettingsRequest(mode, customUrl));

      onResolvedNodeApiUrl(settings.nodeApiUrl);
      setConfigMessage({
        kind: 'success',
        text: `Using ${settings.nodeApiUrl}.`,
      });
    } catch (error) {
      setConfigMessage({
        kind: 'error',
        text: formatError(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  const Icon = displayStatus === 'Synced' ? Check : displayStatus === 'Unavailable' ? WifiOff : Server;

  return (
    <Popover
      className="node-status"
      contentClassName="node-status__popover"
      contentId={popoverId}
      contentLabel="Node status and settings"
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
      <div className="node-status__content">
        <dl className="detail-list">
          {detailRows.map((row) => (
            <div className="detail-list__row" key={row.label}>
              <dt className="detail-list__label">{row.label}</dt>
              <dd className="detail-list__value">{row.value}</dd>
            </div>
          ))}
        </dl>

        <form className="node-status__settings" onSubmit={handleSave}>
          <label className="field">
            <span className="field__label">Node</span>
            <select
              className="field__input"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as QortiumNodeSettingsMode);
                setConfigMessage(null);
              }}
            >
              <option value="local">Local node</option>
              {nodeSettings.networkModeAvailable ? (
                <option value="network">Previewnet network</option>
              ) : null}
              <option value="custom">Custom</option>
            </select>
          </label>

          {mode === 'custom' ? (
            <label className="field">
              <span className="field__label">Custom URL</span>
              <input
                className="field__input"
                placeholder="http://127.0.0.1:24891"
                spellCheck={false}
                type="text"
                value={customUrl}
                onChange={(event) => {
                  setCustomUrl(event.target.value);
                  setConfigMessage(null);
                }}
              />
            </label>
          ) : mode === 'network' ? (
            <p className="node-status__preset">
              <span>Network</span>
              <span>
                Public read-only browsing through {nodeSettings.networkSeedUrls.length.toLocaleString()}{' '}
                seeds
              </span>
            </p>
          ) : (
            <p className="node-status__preset">
              <span>Local</span>
              <span>{nodeSettings.localUrl}</span>
            </p>
          )}

          <div className="node-status__settings-actions">
            <button
              className="button button--secondary"
              disabled={isSaving || isTesting}
              type="button"
              onClick={handleTestConnection}
            >
              <RefreshCw aria-hidden="true" size={18} strokeWidth={2} />
              {isTesting ? 'Testing' : 'Test'}
            </button>
            <button className="button" disabled={isSaving || isTesting} type="submit">
              <Check aria-hidden="true" size={18} strokeWidth={2} />
              {isSaving ? 'Saving' : 'Save'}
            </button>
          </div>

          {configMessage ? (
            <p className={`node-status__message node-status__message--${configMessage.kind}`}>
              {configMessage.text}
            </p>
          ) : null}
        </form>

        <CoreManagerPanel
          onResolvedNodeApiUrl={onResolvedNodeApiUrl}
          onSaveNodeSettings={onSaveNodeSettings}
        />
        <AppUpdatePanel />
      </div>
    </Popover>
  );
}
