import { Download, Play, RefreshCw, Square } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type CoreManagerPanelProps = {
  onResolvedNodeApiUrl: (nodeApiUrl: string) => void;
  onSaveNodeSettings: (request: QortiumNodeSettingsRequest) => Promise<QortiumNodeSettings>;
};

type CoreMessage = {
  kind: 'error' | 'success';
  text: string;
} | null;

type BusyAction =
  | 'checking'
  | 'installing-java'
  | 'installing-prerelease'
  | 'installing-stable'
  | 'starting'
  | 'stopping'
  | null;

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Core action failed.';
  }

  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function formatInstalledCore(installedCore: QortiumInstalledCore | null) {
  return installedCore ? installedCore.tagName : 'Not installed';
}

function formatJava(javaStatus: QortiumCoreJavaStatus | null) {
  if (!javaStatus) {
    return 'Checking';
  }

  if (!javaStatus.version) {
    return 'Missing';
  }

  const source =
    javaStatus.source === 'managed'
      ? 'managed'
      : javaStatus.source === 'system'
        ? 'system'
        : '';

  if (javaStatus.available) {
    return source ? `Java ${javaStatus.version} (${source})` : `Java ${javaStatus.version}`;
  }

  return `Java ${javaStatus.version} unsupported`;
}

function formatRuntime(runtime: QortiumCoreRuntimeStatus | null) {
  if (!runtime) {
    return 'Checking';
  }

  return runtime.running ? 'Running' : 'Stopped';
}

function getReleaseLabel(release: QortiumCoreReleaseSummary | undefined) {
  if (!release) {
    return 'Check releases';
  }

  return release.available ? release.tagName : 'Unavailable';
}

function getProgressPercent(progress: QortiumCoreProgress | null) {
  if (!progress || typeof progress.percent !== 'number') {
    return null;
  }

  return Math.max(0, Math.min(100, progress.percent));
}

export function CoreManagerPanel({
  onResolvedNodeApiUrl,
  onSaveNodeSettings,
}: CoreManagerPanelProps) {
  const coreApi = window.qortiumHome.core;
  const [status, setStatus] = useState<QortiumCoreStatus | null>(null);
  const [releases, setReleases] = useState<QortiumCoreReleases | null>(null);
  const [progress, setProgress] = useState<QortiumCoreProgress | null>(null);
  const [message, setMessage] = useState<CoreMessage>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const isBusy = busyAction !== null;

  useEffect(() => {
    if (!coreApi) {
      return undefined;
    }

    return coreApi.onProgress((nextProgress) => {
      setProgress(nextProgress);
    });
  }, [coreApi]);

  useEffect(() => {
    if (!coreApi) {
      return;
    }

    let isDisposed = false;

    Promise.all([coreApi.getStatus(), coreApi.checkReleases()])
      .then(([nextStatus, nextReleases]) => {
        if (!isDisposed) {
          setStatus(nextStatus);
          setReleases(nextReleases);
        }
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
  }, [coreApi]);

  const detailRows = useMemo(
    () => {
      const rows = [
        { label: 'Core', value: formatInstalledCore(status?.installed ?? null) },
        { label: 'Java', value: formatJava(status?.java ?? null) },
        { label: 'Runtime', value: formatRuntime(status?.runtime ?? null) },
        { label: 'Local API', value: status?.runtime.localApiUrl ?? 'http://127.0.0.1:24891' },
      ];

      if (status?.installed?.logPaths) {
        rows.push(
          { label: 'Core log', value: status.installed.logPaths.appLogPath },
          { label: 'Run log', value: status.installed.logPaths.launcherLogPath },
        );

        if (status.installed.logPaths.windowsErrorLogPath) {
          rows.push({
            label: 'Error log',
            value: status.installed.logPaths.windowsErrorLogPath,
          });
        }
      }

      rows.push(
        { label: 'Stable', value: getReleaseLabel(releases?.stable) },
        { label: 'Prerelease', value: getReleaseLabel(releases?.prerelease) },
      );

      return rows;
    },
    [releases, status],
  );
  const progressPercent = getProgressPercent(progress);
  const canInstallPrerelease = !!releases?.prerelease.available;
  const canInstallStable = !!releases?.stable.available;
  const canInstallJava = !!status && !status.java.available && status.supported;
  const canStart = !!status?.installed && !!status.java.available && !status.runtime.running;
  const canStop = !!status?.installed && !!status.runtime.running;

  if (!coreApi) {
    return null;
  }

  async function refreshStatus() {
    setBusyAction('checking');
    setMessage(null);

    try {
      const [nextReleases, nextStatus] = await Promise.all([
        coreApi.checkReleases(),
        coreApi.getStatus(),
      ]);

      setReleases(nextReleases);
      setStatus(nextStatus);
      setMessage({
        kind: 'success',
        text: 'Core release check complete.',
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function installCore(channel: QortiumCoreChannel) {
    setBusyAction(channel === 'stable' ? 'installing-stable' : 'installing-prerelease');
    setMessage(null);

    try {
      const nextStatus = await coreApi.install({ channel });

      setStatus(nextStatus);
      setMessage({
        kind: 'success',
        text: `Installed ${nextStatus.installed?.tagName ?? 'Qortium Core'}.`,
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function installJava() {
    setBusyAction('installing-java');
    setMessage(null);

    try {
      const nextStatus = await coreApi.installJava();

      setStatus(nextStatus);
      setMessage({
        kind: 'success',
        text: `Installed ${formatJava(nextStatus.java)}.`,
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function startCore() {
    setBusyAction('starting');
    setMessage(null);

    try {
      const nextStatus = await coreApi.start();

      setStatus(nextStatus);

      if (nextStatus.runtime.running) {
        const settings = await onSaveNodeSettings({ mode: 'local' });

        onResolvedNodeApiUrl(settings.nodeApiUrl);
      }

      setMessage({
        kind: 'success',
        text: nextStatus.runtime.running
          ? `Core is running at ${nextStatus.runtime.localApiUrl}.`
          : 'Core start command completed.',
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function stopCore() {
    setBusyAction('stopping');
    setMessage(null);

    try {
      const nextStatus = await coreApi.stop();

      setStatus(nextStatus);
      setMessage({
        kind: 'success',
        text: nextStatus.runtime.running ? 'Core stop command completed.' : 'Core is stopped.',
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: formatError(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="core-manager" aria-label="Managed Core">
      <div className="core-manager__header">
        <h2 className="core-manager__title">Managed Core</h2>
        <button
          className="icon-button core-manager__refresh"
          disabled={isBusy}
          title="Refresh Core status"
          type="button"
          onClick={refreshStatus}
        >
          <RefreshCw aria-hidden="true" size={18} strokeWidth={2} />
          <span className="sr-only">Refresh Core status</span>
        </button>
      </div>

      <dl className="detail-list core-manager__details">
        {detailRows.map((row) => (
          <div className="detail-list__row" key={row.label}>
            <dt className="detail-list__label">{row.label}</dt>
            <dd className="detail-list__value">{row.value}</dd>
          </div>
        ))}
      </dl>

      {progress && progress.action !== 'idle' ? (
        <div className="core-manager__progress">
          <div className="core-manager__progress-bar" aria-hidden="true">
            <span style={{ width: `${progressPercent ?? 100}%` }} />
          </div>
          <span className="core-manager__progress-text">
            {progressPercent === null ? progress.message : `${progress.message} ${progressPercent}%`}
          </span>
        </div>
      ) : null}

      <div className="core-manager__actions">
        <button
          className="button button--secondary"
          disabled={isBusy || !canInstallJava}
          type="button"
          onClick={installJava}
        >
          <Download aria-hidden="true" size={18} strokeWidth={2} />
          {busyAction === 'installing-java' ? 'Installing Java' : 'Install Java'}
        </button>
        <button
          className="button button--secondary"
          disabled={isBusy || !canInstallPrerelease}
          type="button"
          onClick={() => installCore('prerelease')}
        >
          <Download aria-hidden="true" size={18} strokeWidth={2} />
          {busyAction === 'installing-prerelease' ? 'Installing' : 'Install prerelease'}
        </button>
        {canInstallStable ? (
          <button
            className="button button--secondary"
            disabled={isBusy}
            type="button"
            onClick={() => installCore('stable')}
          >
            <Download aria-hidden="true" size={18} strokeWidth={2} />
            {busyAction === 'installing-stable' ? 'Installing' : 'Install stable'}
          </button>
        ) : null}
        <button className="button" disabled={isBusy || !canStart} type="button" onClick={startCore}>
          <Play aria-hidden="true" size={18} strokeWidth={2} />
          {busyAction === 'starting' ? 'Starting' : 'Start'}
        </button>
        <button
          className="button button--secondary"
          disabled={isBusy || !canStop}
          type="button"
          onClick={stopCore}
        >
          <Square aria-hidden="true" size={18} strokeWidth={2} />
          {busyAction === 'stopping' ? 'Stopping' : 'Stop'}
        </button>
      </div>

      {message ? (
        <p className={`core-manager__message core-manager__message--${message.kind}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
