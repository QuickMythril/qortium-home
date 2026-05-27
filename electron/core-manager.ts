import { app, BrowserWindow, ipcMain } from 'electron';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import extract from 'extract-zip';

const CORE_REPOSITORY = 'QuickMythril/qortium';
const GITHUB_API_BASE_URL = `https://api.github.com/repos/${CORE_REPOSITORY}`;
const GITHUB_USER_AGENT = 'QortiumHome/1.0';
const MANAGED_CORE_DIR = 'managed-core';
const CURRENT_CORE_FILE = 'current.json';
const LOCAL_CORE_API_URL = 'http://127.0.0.1:24891';
const LOCAL_CORE_STATUS_PATH = '/admin/status';
const START_TIMEOUT_MS = 120_000;
const STOP_TIMEOUT_MS = 45_000;
const STATUS_TIMEOUT_MS = 2_500;
const POLL_INTERVAL_MS = 2_000;
const MIN_JAVA_MAJOR_VERSION = 17;

type CoreChannel = 'prerelease' | 'stable';

type GithubAsset = {
  browser_download_url?: unknown;
  digest?: unknown;
  name?: unknown;
  size?: unknown;
};

type GithubRelease = {
  assets?: unknown;
  draft?: unknown;
  html_url?: unknown;
  name?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  tag_name?: unknown;
};

type CoreReleaseAsset = {
  digest: string | null;
  downloadUrl: string;
  name: string;
  size: number;
};

type CoreReleaseSummary =
  | {
      available: false;
      channel: CoreChannel;
      message: string;
    }
  | {
      asset: CoreReleaseAsset;
      available: true;
      channel: CoreChannel;
      htmlUrl: string;
      name: string;
      publishedAt: string;
      tagName: string;
    };

type InstalledCore = {
  assetName: string;
  assetSize: number;
  channel: CoreChannel;
  digest: string | null;
  downloadUrl: string;
  htmlUrl: string;
  installPath: string;
  installedAt: string;
  jarPath: string;
  name: string;
  previewPath: string;
  tagName: string;
};

type JavaStatus = {
  available: boolean;
  majorVersion: number | null;
  path: string;
  version: string | null;
};

type CoreRuntimeStatus = {
  localApiUrl: string;
  running: boolean;
  status: unknown;
};

type CoreStatus = {
  installed: InstalledCore | null;
  java: JavaStatus;
  runtime: CoreRuntimeStatus;
  supported: boolean;
};

type CoreProgress = {
  action: 'checking' | 'downloading' | 'extracting' | 'idle' | 'starting' | 'stopping';
  kind: 'error' | 'info' | 'success';
  message: string;
  percent?: number;
};

type CoreInstallRequest = {
  channel?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function getString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getCoreBasePath() {
  return path.join(app.getPath('userData'), MANAGED_CORE_DIR);
}

function getCoreDownloadsPath() {
  return path.join(getCoreBasePath(), 'downloads');
}

function getCoreVersionsPath() {
  return path.join(getCoreBasePath(), 'versions');
}

function getCurrentCorePath() {
  return path.join(getCoreBasePath(), CURRENT_CORE_FILE);
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '_') || 'core';
}

function publishProgress(progress: CoreProgress) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('core:progress', progress);
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Core action failed.';
}

async function fetchGithubJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_USER_AGENT,
    },
  });

  if (response.status === 404) {
    return null;
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `GitHub request failed with HTTP ${response.status}.`);
  }

  return text ? (JSON.parse(text) as T) : null;
}

function normalizeGithubRelease(value: unknown): GithubRelease | null {
  return isObject(value) ? value : null;
}

function selectReleaseAsset(release: GithubRelease): CoreReleaseAsset | null {
  if (!Array.isArray(release.assets)) {
    return null;
  }

  const assets = release.assets.filter(isObject) as GithubAsset[];
  const selectedAsset =
    assets.find((asset) => getString(asset.name) === 'qortium-preview.zip') ??
    assets.find((asset) => /^qortium.*\.zip$/i.test(getString(asset.name)));

  if (!selectedAsset) {
    return null;
  }

  const name = getString(selectedAsset.name);
  const downloadUrl = getString(selectedAsset.browser_download_url);

  if (!name || !downloadUrl) {
    return null;
  }

  return {
    name,
    downloadUrl,
    digest: getString(selectedAsset.digest) || null,
    size: getNumber(selectedAsset.size),
  };
}

function releaseToSummary(channel: CoreChannel, value: unknown): CoreReleaseSummary {
  const release = normalizeGithubRelease(value);

  if (!release || release.draft === true) {
    return {
      available: false,
      channel,
      message: `No ${channel} release was found.`,
    };
  }

  const tagName = getString(release.tag_name);
  const asset = selectReleaseAsset(release);

  if (!tagName || !asset) {
    return {
      available: false,
      channel,
      message: `The latest ${channel} release does not include a supported Qortium zip asset.`,
    };
  }

  return {
    available: true,
    channel,
    asset,
    tagName,
    name: getString(release.name) || tagName,
    htmlUrl: getString(release.html_url),
    publishedAt: getString(release.published_at),
  };
}

async function getLatestStableRelease(): Promise<CoreReleaseSummary> {
  const release = await fetchGithubJson<unknown>(`${GITHUB_API_BASE_URL}/releases/latest`);

  return releaseToSummary('stable', release);
}

async function getLatestPrerelease(): Promise<CoreReleaseSummary> {
  const releases = await fetchGithubJson<unknown[]>(`${GITHUB_API_BASE_URL}/releases?per_page=20`);
  const release = Array.isArray(releases)
    ? releases.find((candidate) => {
        const normalizedCandidate = normalizeGithubRelease(candidate);

        return normalizedCandidate?.draft !== true && normalizedCandidate?.prerelease === true;
      })
    : null;

  return releaseToSummary('prerelease', release);
}

async function checkReleases() {
  publishProgress({
    action: 'checking',
    kind: 'info',
    message: 'Checking Qortium Core releases.',
  });

  const [stable, prerelease] = await Promise.all([
    getLatestStableRelease().catch((error): CoreReleaseSummary => ({
      available: false,
      channel: 'stable',
      message: getErrorMessage(error),
    })),
    getLatestPrerelease().catch((error): CoreReleaseSummary => ({
      available: false,
      channel: 'prerelease',
      message: getErrorMessage(error),
    })),
  ]);

  publishProgress({
    action: 'idle',
    kind: 'success',
    message: 'Release check complete.',
  });

  return {
    stable,
    prerelease,
  };
}

function parseInstalledCore(value: unknown): InstalledCore | null {
  if (!isObject(value)) {
    return null;
  }

  const installedCore = value as Partial<InstalledCore>;
  const installPath = getString(installedCore.installPath);
  const previewPath = getString(installedCore.previewPath);
  const jarPath = getString(installedCore.jarPath);
  const tagName = getString(installedCore.tagName);

  if (!installPath || !previewPath || !jarPath || !tagName) {
    return null;
  }

  return {
    assetName: getString(installedCore.assetName),
    assetSize: getNumber(installedCore.assetSize),
    channel: installedCore.channel === 'stable' ? 'stable' : 'prerelease',
    digest: getString(installedCore.digest) || null,
    downloadUrl: getString(installedCore.downloadUrl),
    htmlUrl: getString(installedCore.htmlUrl),
    installPath,
    installedAt: getString(installedCore.installedAt),
    jarPath,
    name: getString(installedCore.name) || tagName,
    previewPath,
    tagName,
  };
}

async function readInstalledCore(): Promise<InstalledCore | null> {
  try {
    const parsedCore: unknown = JSON.parse(await readFile(getCurrentCorePath(), 'utf8'));
    const installedCore = parseInstalledCore(parsedCore);

    if (
      installedCore &&
      existsSync(installedCore.installPath) &&
      existsSync(installedCore.previewPath) &&
      existsSync(installedCore.jarPath)
    ) {
      return installedCore;
    }
  } catch {
    return null;
  }

  return null;
}

async function writeInstalledCore(installedCore: InstalledCore) {
  await mkdir(getCoreBasePath(), { recursive: true });
  await writeFile(getCurrentCorePath(), `${JSON.stringify(installedCore, null, 2)}\n`, 'utf8');
}

function parseJavaMajorVersion(version: string) {
  const [first, second] = version.split('.');
  const majorVersion = first === '1' ? Number(second) : Number(first);

  return Number.isFinite(majorVersion) ? majorVersion : null;
}

function detectJavaVersion(command = 'java'): Promise<JavaStatus> {
  return new Promise((resolve) => {
    const child = spawn(command, ['-version'], {
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    const chunks: Buffer[] = [];

    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', () => {
      resolve({
        available: false,
        majorVersion: null,
        path: command,
        version: null,
      });
    });
    child.on('close', () => {
      const output = Buffer.concat(chunks).toString();
      const version = /(?:java|openjdk) version\s+"([^"]+)"/i.exec(output)?.[1] ?? null;
      const majorVersion = version ? parseJavaMajorVersion(version) : null;

      resolve({
        available: typeof majorVersion === 'number' && majorVersion >= MIN_JAVA_MAJOR_VERSION,
        majorVersion,
        path: command,
        version,
      });
    });
  });
}

async function fetchLocalCoreStatus(): Promise<CoreRuntimeStatus> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(`${LOCAL_CORE_API_URL}${LOCAL_CORE_STATUS_PATH}`, {
      signal: abortController.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      return {
        localApiUrl: LOCAL_CORE_API_URL,
        running: false,
        status: text,
      };
    }

    return {
      localApiUrl: LOCAL_CORE_API_URL,
      running: true,
      status: text ? (JSON.parse(text) as unknown) : null,
    };
  } catch {
    return {
      localApiUrl: LOCAL_CORE_API_URL,
      running: false,
      status: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getStatus(): Promise<CoreStatus> {
  const [installed, java, runtime] = await Promise.all([
    readInstalledCore(),
    detectJavaVersion(),
    fetchLocalCoreStatus(),
  ]);

  return {
    supported: process.platform === 'linux' || process.platform === 'darwin' || process.platform === 'win32',
    installed,
    java,
    runtime,
  };
}

async function downloadFile(asset: CoreReleaseAsset, destinationPath: string) {
  const response = await fetch(asset.downloadUrl, {
    headers: {
      Accept: 'application/octet-stream,*/*',
      'User-Agent': GITHUB_USER_AGENT,
    },
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');

    throw new Error(text || `Core download failed with HTTP ${response.status}.`);
  }

  const totalBytes = Number(response.headers.get('content-length')) || asset.size;
  const hash = createHash('sha256');
  let receivedBytes = 0;
  const progressStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      receivedBytes += chunk.length;
      hash.update(chunk);

      publishProgress({
        action: 'downloading',
        kind: 'info',
        message: `Downloading ${asset.name}.`,
        percent: totalBytes ? Math.floor((receivedBytes / totalBytes) * 100) : undefined,
      });
      callback(null, chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    progressStream,
    createWriteStream(destinationPath),
  );

  const digest = `sha256:${hash.digest('hex')}`;

  if (asset.digest && asset.digest !== digest) {
    await rm(destinationPath, { force: true });
    throw new Error('Downloaded Core asset did not match the GitHub asset digest.');
  }
}

async function findExtractedCorePaths(versionPath: string) {
  const candidates = [versionPath];
  const entries = await readdir(versionPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      candidates.push(path.join(versionPath, entry.name));
    }
  }

  for (const candidate of candidates) {
    const jarPath = path.join(candidate, 'qortium.jar');
    const previewPath = path.join(candidate, 'preview');

    if (existsSync(jarPath) && existsSync(previewPath)) {
      return {
        installPath: candidate,
        jarPath,
        previewPath,
      };
    }
  }

  throw new Error('Installed Core release did not contain qortium.jar and preview scripts.');
}

async function chmodPreviewScripts(previewPath: string) {
  if (process.platform === 'win32') {
    return;
  }

  for (const scriptName of ['reset.sh', 'start.sh', 'status.sh', 'stop.sh']) {
    const scriptPath = path.join(previewPath, scriptName);

    if (existsSync(scriptPath)) {
      await chmod(scriptPath, 0o755);
    }
  }
}

function normalizeInstallRequest(request: CoreInstallRequest): CoreChannel {
  if (request.channel === 'stable' || request.channel === 'prerelease') {
    return request.channel;
  }

  return 'prerelease';
}

async function installCore(request: CoreInstallRequest) {
  const channel = normalizeInstallRequest(request);
  const releases = await checkReleases();
  const release = releases[channel];

  if (!release.available) {
    throw new Error(release.message);
  }

  const versionPath = path.join(getCoreVersionsPath(), sanitizePathSegment(release.tagName));
  const downloadPath = path.join(
    getCoreDownloadsPath(),
    `${sanitizePathSegment(release.tagName)}-${sanitizePathSegment(release.asset.name)}`,
  );

  await mkdir(getCoreDownloadsPath(), { recursive: true });
  await rm(versionPath, { recursive: true, force: true });
  await mkdir(versionPath, { recursive: true });

  await downloadFile(release.asset, downloadPath);

  publishProgress({
    action: 'extracting',
    kind: 'info',
    message: `Extracting ${release.asset.name}.`,
    percent: 0,
  });
  await extract(downloadPath, { dir: versionPath });
  await rm(downloadPath, { force: true });

  const corePaths = await findExtractedCorePaths(versionPath);

  await chmodPreviewScripts(corePaths.previewPath);

  const installedCore: InstalledCore = {
    assetName: release.asset.name,
    assetSize: release.asset.size,
    channel: release.channel,
    digest: release.asset.digest,
    downloadUrl: release.asset.downloadUrl,
    htmlUrl: release.htmlUrl,
    installPath: corePaths.installPath,
    installedAt: new Date().toISOString(),
    jarPath: corePaths.jarPath,
    name: release.name,
    previewPath: corePaths.previewPath,
    tagName: release.tagName,
  };

  await writeInstalledCore(installedCore);

  publishProgress({
    action: 'idle',
    kind: 'success',
    message: `Installed Qortium Core ${release.tagName}.`,
    percent: 100,
  });

  return await getStatus();
}

async function runScript(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    let stderr = '';
    const child =
      process.platform === 'win32'
        ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${command}" ${args.join(' ')}`], {
            cwd,
            windowsHide: true,
          })
        : spawn(command, args, {
            cwd,
            windowsHide: true,
          });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${path.basename(command)} exited with code ${code}.`));
    });
  });
}

async function waitForRuntimeState(running: boolean, timeoutMs: number, action: CoreProgress['action']) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const runtime = await fetchLocalCoreStatus();

    if (runtime.running === running) {
      return runtime;
    }

    publishProgress({
      action,
      kind: 'info',
      message: running ? 'Waiting for local Core API.' : 'Waiting for local Core to stop.',
      percent: Math.min(95, Math.floor(((Date.now() - startedAt) / timeoutMs) * 100)),
    });
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(running ? 'Timed out waiting for local Core API.' : 'Timed out waiting for Core to stop.');
}

function getStartScript(previewPath: string) {
  return process.platform === 'win32'
    ? path.join(previewPath, 'start.bat')
    : path.join(previewPath, 'start.sh');
}

function getStopScript(previewPath: string) {
  return process.platform === 'win32'
    ? path.join(previewPath, 'stop.bat')
    : path.join(previewPath, 'stop.sh');
}

async function startCore() {
  const installedCore = await readInstalledCore();

  if (!installedCore) {
    throw new Error('Install Qortium Core before starting it.');
  }

  const java = await detectJavaVersion();

  if (!java.available) {
    throw new Error('Java 17 or newer is required before Qortium Core can start.');
  }

  const currentRuntime = await fetchLocalCoreStatus();

  if (currentRuntime.running) {
    return await getStatus();
  }

  const startScript = getStartScript(installedCore.previewPath);

  if (!existsSync(startScript)) {
    throw new Error('The installed Core release is missing its preview start script.');
  }

  publishProgress({
    action: 'starting',
    kind: 'info',
    message: 'Starting Qortium Core.',
    percent: 5,
  });
  await runScript(startScript, ['--participant', '--headless'], installedCore.previewPath);
  await waitForRuntimeState(true, START_TIMEOUT_MS, 'starting');

  publishProgress({
    action: 'idle',
    kind: 'success',
    message: 'Qortium Core is running.',
    percent: 100,
  });

  return await getStatus();
}

async function stopCore() {
  const installedCore = await readInstalledCore();

  if (!installedCore) {
    throw new Error('No managed Qortium Core install was found.');
  }

  const currentRuntime = await fetchLocalCoreStatus();

  if (!currentRuntime.running) {
    return await getStatus();
  }

  const stopScript = getStopScript(installedCore.previewPath);

  if (!existsSync(stopScript)) {
    throw new Error('The installed Core release is missing its preview stop script.');
  }

  publishProgress({
    action: 'stopping',
    kind: 'info',
    message: 'Stopping Qortium Core.',
    percent: 5,
  });
  await runScript(stopScript, [], installedCore.previewPath);
  await waitForRuntimeState(false, STOP_TIMEOUT_MS, 'stopping');

  publishProgress({
    action: 'idle',
    kind: 'success',
    message: 'Qortium Core is stopped.',
    percent: 100,
  });

  return await getStatus();
}

export function registerCoreManagerIpcHandlers() {
  ipcMain.handle('core:checkReleases', () => checkReleases());
  ipcMain.handle('core:getStatus', () => getStatus());
  ipcMain.handle('core:install', (_event, request: CoreInstallRequest = {}) => installCore(request));
  ipcMain.handle('core:start', () => startCore());
  ipcMain.handle('core:stop', () => stopCore());
}
