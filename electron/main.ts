import { app, BrowserWindow, screen, type Rectangle } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAccountIpcHandlers } from './accounts.js';
import { registerAppUpdateIpcHandlers } from './app-updates.js';
import { registerCoreManagerIpcHandlers } from './core-manager.js';
import { registerNodeSettingsIpcHandlers } from './node-settings.js';
import { registerQdnIpcHandlers } from './qdn.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WINDOW_WIDTH = 1100;
const DEFAULT_WINDOW_HEIGHT = 720;
const MIN_WINDOW_WIDTH = 720;
const MIN_WINDOW_HEIGHT = 480;
const WINDOW_STATE_FILE = 'window-state.json';
const WINDOW_STATE_SAVE_DELAY_MS = 250;
const WINDOW_ICON_FILE = 'icon.png';

type WindowState = {
  height: number;
  isMaximized: boolean;
  width: number;
  x?: number;
  y?: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getWindowStatePath() {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function rectanglesOverlap(first: Rectangle, second: Rectangle) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function isVisibleOnAnyDisplay(bounds: Rectangle) {
  return screen.getAllDisplays().some((display) => rectanglesOverlap(bounds, display.workArea));
}

function readWindowState(): WindowState | undefined {
  try {
    const parsedState: unknown = JSON.parse(readFileSync(getWindowStatePath(), 'utf8'));

    if (!parsedState || typeof parsedState !== 'object') {
      return undefined;
    }

    const state = parsedState as Partial<WindowState>;
    const width = isFiniteNumber(state.width)
      ? Math.max(Math.round(state.width), MIN_WINDOW_WIDTH)
      : DEFAULT_WINDOW_WIDTH;
    const height = isFiniteNumber(state.height)
      ? Math.max(Math.round(state.height), MIN_WINDOW_HEIGHT)
      : DEFAULT_WINDOW_HEIGHT;
    const nextState: WindowState = {
      width,
      height,
      isMaximized: state.isMaximized === true,
    };

    if (isFiniteNumber(state.x) && isFiniteNumber(state.y)) {
      const candidateBounds = {
        x: Math.round(state.x),
        y: Math.round(state.y),
        width,
        height,
      };

      if (isVisibleOnAnyDisplay(candidateBounds)) {
        nextState.x = candidateBounds.x;
        nextState.y = candidateBounds.y;
      }
    }

    return nextState;
  } catch {
    return undefined;
  }
}

function writeWindowState(state: WindowState) {
  const statePath = getWindowStatePath();

  try {
    mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.warn('Unable to save window state.', error);
  }
}

function getCurrentWindowState(window: BrowserWindow): WindowState {
  const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();

  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(bounds.width, MIN_WINDOW_WIDTH),
    height: Math.max(bounds.height, MIN_WINDOW_HEIGHT),
    isMaximized: window.isMaximized(),
  };
}

function persistWindowState(window: BrowserWindow) {
  if (!window.isDestroyed()) {
    writeWindowState(getCurrentWindowState(window));
  }
}

function watchWindowState(window: BrowserWindow) {
  let saveWindowStateTimeout: NodeJS.Timeout | undefined;

  function scheduleWindowStateSave() {
    if (saveWindowStateTimeout) {
      clearTimeout(saveWindowStateTimeout);
    }

    saveWindowStateTimeout = setTimeout(() => {
      persistWindowState(window);
      saveWindowStateTimeout = undefined;
    }, WINDOW_STATE_SAVE_DELAY_MS);
  }

  window.on('move', scheduleWindowStateSave);
  window.on('resize', scheduleWindowStateSave);
  window.on('maximize', () => persistWindowState(window));
  window.on('unmaximize', () => persistWindowState(window));
  window.on('close', () => {
    if (saveWindowStateTimeout) {
      clearTimeout(saveWindowStateTimeout);
      saveWindowStateTimeout = undefined;
    }

    persistWindowState(window);
  });
}

function getWindowIconPath() {
  if (process.platform === 'darwin') {
    return undefined;
  }

  return app.isPackaged
    ? path.join(process.resourcesPath, WINDOW_ICON_FILE)
    : path.join(__dirname, '..', 'build', WINDOW_ICON_FILE);
}

function createWindow() {
  const windowState = readWindowState();
  const window = new BrowserWindow({
    width: windowState?.width ?? DEFAULT_WINDOW_WIDTH,
    height: windowState?.height ?? DEFAULT_WINDOW_HEIGHT,
    x: windowState?.x,
    y: windowState?.y,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: 'Qortium Home',
    icon: getWindowIconPath(),
    backgroundColor: '#121515',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  watchWindowState(window);

  if (windowState?.isMaximized) {
    window.maximize();
  }

  if (app.isPackaged) {
    void window.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173');
  }
}

app.whenReady().then(() => {
  registerAccountIpcHandlers();
  registerAppUpdateIpcHandlers();
  registerCoreManagerIpcHandlers();
  registerNodeSettingsIpcHandlers();
  registerQdnIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
