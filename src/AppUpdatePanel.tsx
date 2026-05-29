import { Download, ExternalLink, FolderOpen, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { checkAppUpdates } from './appUpdates';

type UpdateMessage = {
  kind: 'error' | 'success';
  text: string;
} | null;

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to check app updates.';
  }

  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '-';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}

function getDefaultChannel(environment: QortiumAppUpdateEnvironment | null): QortiumAppUpdateChannel {
  return environment?.currentVersion.includes('-') ? 'prerelease' : 'stable';
}

function getStatusKind(result: QortiumAppUpdateCheckResult | null): UpdateMessage['kind'] {
  if (!result) {
    return null;
  }

  return result.status === 'available' || result.status === 'up-to-date' ? 'success' : 'error';
}

function getReleasePageUrl(result: QortiumAppUpdateCheckResult | null) {
  return result?.release?.htmlUrl || '';
}

function isAndroidPlatform(platform: QortiumAppUpdatePlatform | undefined) {
  return platform?.os === 'android';
}

function getDownloadedUpdateMessage(
  downloadedUpdate: QortiumAppUpdateDownloadResult,
  platform: QortiumAppUpdatePlatform | undefined,
) {
  if (isAndroidPlatform(platform)) {
    return `Downloaded and verified ${downloadedUpdate.fileName}. Android install handoff is manual for now; use Open release to install from the browser.`;
  }

  return downloadedUpdate.digestVerified
    ? `Downloaded and verified ${downloadedUpdate.fileName}.`
    : `Downloaded ${downloadedUpdate.fileName}.`;
}

export function AppUpdatePanel() {
  const [environment, setEnvironment] = useState<QortiumAppUpdateEnvironment | null>(null);
  const [channel, setChannel] = useState<QortiumAppUpdateChannel>('stable');
  const [result, setResult] = useState<QortiumAppUpdateCheckResult | null>(null);
  const [downloadedUpdate, setDownloadedUpdate] = useState<QortiumAppUpdateDownloadResult | null>(null);
  const [message, setMessage] = useState<UpdateMessage>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const releasePageUrl = getReleasePageUrl(result);
  const updatePlatform = result?.platform ?? environment?.platform;

  useEffect(() => {
    let isDisposed = false;

    window.qortiumHome.updates
      .getEnvironment()
      .then((nextEnvironment) => {
        if (isDisposed) {
          return;
        }

        setEnvironment(nextEnvironment);
        setChannel(getDefaultChannel(nextEnvironment));
      })
      .catch((error) => {
        if (!isDisposed) {
          setMessage({
            kind: 'error',
            text: formatError(error),
          });
        }
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  const detailRows = useMemo(
    () => {
      const rows = [
        { label: 'Current', value: environment?.currentVersion ?? 'Checking' },
        { label: 'Platform', value: environment?.platform.label ?? 'Checking' },
        { label: 'Channel', value: channel === 'stable' ? 'Stable' : 'Prerelease' },
      ];

      if (result?.release) {
        rows.push({ label: 'Latest', value: result.release.tagName });
      }

      if (result?.asset) {
        rows.push(
          { label: 'Asset', value: result.asset.name },
          { label: 'Size', value: formatBytes(result.asset.size) },
          { label: 'Digest', value: result.asset.digest ?? 'Unavailable' },
        );
      }

      if (downloadedUpdate) {
        rows.push(
          { label: 'Downloaded', value: downloadedUpdate.fileName },
          ...(isAndroidPlatform(updatePlatform)
            ? [
                { label: 'Saved', value: downloadedUpdate.filePath },
                { label: 'Install', value: 'Manual from release page' },
              ]
            : []),
          { label: 'Verified', value: downloadedUpdate.digestVerified ? 'Yes' : 'No digest' },
        );
      }

      return rows;
    },
    [channel, downloadedUpdate, environment, result, updatePlatform],
  );

  async function checkForUpdates() {
    if (!environment) {
      return;
    }

    setIsChecking(true);
    setDownloadedUpdate(null);
    setMessage(null);

    try {
      const nextResult = await checkAppUpdates(environment, channel);
      const nextKind = getStatusKind(nextResult);

      setResult(nextResult);
      setMessage({
        kind: nextKind ?? 'error',
        text: nextResult.message,
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    } finally {
      setIsChecking(false);
    }
  }

  async function downloadUpdate() {
    if (!result?.asset || !result.release) {
      return;
    }

    setIsDownloading(true);
    setMessage(null);

    try {
      const nextDownloadedUpdate = await window.qortiumHome.updates.downloadAsset({
        asset: result.asset,
        platform: result.platform,
        releaseTag: result.release.tagName,
      });

      setDownloadedUpdate(nextDownloadedUpdate);
      setMessage({
        kind: 'success',
        text: getDownloadedUpdateMessage(nextDownloadedUpdate, result.platform),
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    } finally {
      setIsDownloading(false);
    }
  }

  async function openDownloadedFile() {
    if (!downloadedUpdate) {
      return;
    }

    try {
      await window.qortiumHome.updates.openDownloadedFile(downloadedUpdate.filePath);
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    }
  }

  async function showDownloadedFile() {
    if (!downloadedUpdate) {
      return;
    }

    try {
      await window.qortiumHome.updates.showDownloadedFile(downloadedUpdate.filePath);
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    }
  }

  async function openReleasePage() {
    if (!releasePageUrl) {
      return;
    }

    try {
      await window.qortiumHome.updates.openReleasePage(releasePageUrl);
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    }
  }

  return (
    <section className="app-updates" aria-label="Qortium Home updates">
      <div className="app-updates__header">
        <h2 className="app-updates__title">Qortium Home Updates</h2>
        <button
          className="icon-button app-updates__refresh"
          disabled={isChecking || !environment}
          title="Check for app updates"
          type="button"
          onClick={checkForUpdates}
        >
          <RefreshCw aria-hidden="true" size={18} strokeWidth={2} />
          <span className="sr-only">Check for app updates</span>
        </button>
      </div>

      <label className="field">
        <span className="field__label">Release channel</span>
        <select
          className="field__input"
          disabled={isChecking}
          value={channel}
          onChange={(event) => {
            setChannel(event.target.value as QortiumAppUpdateChannel);
            setResult(null);
            setDownloadedUpdate(null);
            setMessage(null);
          }}
        >
          <option value="stable">Stable</option>
          <option value="prerelease">Prerelease</option>
        </select>
      </label>

      <dl className="detail-list app-updates__details">
        {detailRows.map((row) => (
          <div className="detail-list__row" key={row.label}>
            <dt className="detail-list__label">{row.label}</dt>
            <dd className="detail-list__value">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="app-updates__actions">
        <button
          className="button button--secondary"
          disabled={isChecking || isDownloading || !environment}
          type="button"
          onClick={checkForUpdates}
        >
          <RefreshCw aria-hidden="true" size={18} strokeWidth={2} />
          {isChecking ? 'Checking' : 'Check now'}
        </button>
        {result?.asset && result.release ? (
          <button
            className="button button--secondary"
            disabled={isChecking || isDownloading}
            type="button"
            onClick={downloadUpdate}
          >
            <Download aria-hidden="true" size={18} strokeWidth={2} />
            {isDownloading ? 'Downloading' : 'Download update'}
          </button>
        ) : null}
        {downloadedUpdate?.canOpen ? (
          <button
            className="button button--secondary"
            disabled={isChecking || isDownloading}
            type="button"
            onClick={openDownloadedFile}
          >
            <ExternalLink aria-hidden="true" size={18} strokeWidth={2} />
            Open file
          </button>
        ) : null}
        {downloadedUpdate?.canReveal ? (
          <button
            className="button button--secondary"
            disabled={isChecking || isDownloading}
            type="button"
            onClick={showDownloadedFile}
          >
            <FolderOpen aria-hidden="true" size={18} strokeWidth={2} />
            Show file
          </button>
        ) : null}
        {releasePageUrl ? (
          <button className="button" disabled={isChecking || isDownloading} type="button" onClick={openReleasePage}>
            <ExternalLink aria-hidden="true" size={18} strokeWidth={2} />
            Open release
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={`app-updates__message app-updates__message--${message.kind}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
