const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const {
  APP_ID, ACTIVE_OPACITY, IDLE_OPACITY, IDLE_DELAY_MS, BASE_WIDTH,
  INITIAL_CONTENT_HEIGHT, MIN_CONTENT_HEIGHT, MAX_CONTENT_HEIGHT,
  MIN_SCALE, MAX_SCALE, MIN_WINDOW_WIDTH, MAX_WINDOW_WIDTH
} = require('./config');
const { finiteNumber, isAllowedResizeEdge, sanitizeSuggestPayload } = require('./ipc-validators');
const { clamp, normalizeBaseHeight, getWindowScale, getScaledBounds, getDisplayWorkArea } = require('./window-geometry');
const { setupAutoUpdater } = require('./auto-updater');

const resizeSessions = new Map();
const contentMetrics = new Map();
let mainWindow = null;
let suggestWindow = null;
let suggestMetrics = { height: 0 };
let currentSuggestPayload = null;
let currentSuggestDirection = 'down';
let idleTimer = null;
let appIsIdle = false;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

function getSuggestGap(scale = 1) {
  return Math.max(8, Math.round(12 * scale));
}
function getSuggestHysteresis(scale = 1) {
  return Math.max(16, Math.round(28 * scale));
}
function isAnyAppWindowFocused() {
  const mainFocused = !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
  const suggestFocused = !!(suggestWindow && !suggestWindow.isDestroyed() && suggestWindow.isFocused());
  return mainFocused || suggestFocused;
}
function getAppOpacity() {
  return appIsIdle ? IDLE_OPACITY : ACTIVE_OPACITY;
}
function applyAppOpacity() {
  const opacity = getAppOpacity();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setOpacity(opacity);
  if (suggestWindow && !suggestWindow.isDestroyed()) suggestWindow.setOpacity(opacity);
}
function scheduleIdleFade() {
  if (idleTimer) clearTimeout(idleTimer);
  appIsIdle = false;
  applyAppOpacity();
  idleTimer = setTimeout(() => {
    appIsIdle = true;
    applyAppOpacity();
  }, IDLE_DELAY_MS);
}
function stopIdleFade() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}
function syncSuggestWindowOpacity() {
  if (!suggestWindow || suggestWindow.isDestroyed()) return;
  suggestWindow.setOpacity(getAppOpacity());
}
function ensureSuggestWindow() {
  if (suggestWindow && !suggestWindow.isDestroyed()) return suggestWindow;
  const win = new BrowserWindow({
    width: BASE_WIDTH,
    height: 1,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: 1,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    movable: false,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    show: false,
    alwaysOnTop: true,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'suggest-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setAlwaysOnTop(true);
  win.setOpacity(getAppOpacity());
  win.loadFile(path.join(__dirname, 'suggest.html'));
  win.on('focus', () => scheduleIdleFade());
  win.on('blur', () => applyAppOpacity());
  win.on('closed', () => {
    if (suggestWindow === win) {
      suggestWindow = null;
      suggestMetrics = { height: 0 };
      currentSuggestPayload = null;
      currentSuggestDirection = 'down';
    }
  });
  suggestWindow = win;
  return win;
}
function clearSuggestRenderer() {
  if (!suggestWindow || suggestWindow.isDestroyed() || suggestWindow.webContents.isDestroyed()) return;
  suggestWindow.webContents.send('suggest:clear');
}
function hideSuggestWindow(clearRenderer = true) {
  currentSuggestPayload = null;
  currentSuggestDirection = 'down';
  suggestMetrics = { height: 0 };
  if (!suggestWindow || suggestWindow.isDestroyed()) return;
  if (clearRenderer) clearSuggestRenderer();
  suggestWindow.hide();
}
function sendSuggestPayload(payload) {
  const win = ensureSuggestWindow();
  const dispatch = () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send('suggest:render', payload);
  };
  if (win.webContents.isLoadingMainFrame()) {
    win.webContents.once('did-finish-load', dispatch);
  } else {
    dispatch();
  }
}
function estimateSuggestHeight(payload) {
  const title = String(payload?.title || '');
  const subtitle = String(payload?.subtitle || '');
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions.length : 0;
  const textLines = (title ? 1 : 0) + (subtitle ? Math.max(1, Math.ceil(subtitle.length / 46)) : 0);
  const suggestionRows = suggestions > 0 ? Math.ceil(suggestions / 3) : 1;
  const estimated = 58 + (textLines * 18) + (suggestionRows * 42);
  return clamp(estimated, 88, 240);
}
function positionSuggestWindow(forceShow = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!suggestWindow || suggestWindow.isDestroyed()) return;
  if (!currentSuggestPayload) {
    suggestWindow.hide();
    return;
  }
  if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
    suggestWindow.hide();
    return;
  }
  const height = Math.max(1, Math.round(Number(suggestMetrics.height || 0)));
  if (height <= 1 && !forceShow) return;
  const bounds = mainWindow.getBounds();
  const scale = getWindowScale(bounds);
  const gap = getSuggestGap(scale);
  const hysteresis = getSuggestHysteresis(scale);
  const workArea = getDisplayWorkArea(bounds);
  const roomBelow = Math.max(0, (workArea.y + workArea.height) - (bounds.y + bounds.height));
  const roomAbove = Math.max(0, bounds.y - workArea.y);
  const threshold = height + gap;
  if (currentSuggestDirection === 'up') {
    if (roomBelow >= threshold + hysteresis && roomBelow > roomAbove) currentSuggestDirection = 'down';
  } else if (roomBelow < threshold && roomAbove > roomBelow) {
    currentSuggestDirection = 'up';
  }
  let x = bounds.x;
  let y = currentSuggestDirection === 'up' ? bounds.y - gap - height : bounds.y + bounds.height + gap;
  const minX = workArea.x;
  const maxX = workArea.x + Math.max(0, workArea.width - bounds.width);
  const minY = workArea.y;
  const maxY = workArea.y + Math.max(0, workArea.height - height);
  x = clamp(x, minX, maxX);
  y = clamp(y, minY, maxY);
  suggestWindow.setBounds({ x, y, width: bounds.width, height });
  suggestWindow.setAlwaysOnTop(true);
  syncSuggestWindowOpacity();
  if (forceShow || !suggestWindow.isVisible()) {
    if (typeof suggestWindow.showInactive === 'function') suggestWindow.showInactive();
    else suggestWindow.show();
    suggestWindow.moveTop();
    suggestWindow.setAlwaysOnTop(true);
    syncSuggestWindowOpacity();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  }
}
function syncSuggestWindowVisibility() {
  if (!currentSuggestPayload) {
    hideSuggestWindow(false);
    return;
  }
  positionSuggestWindow(false);
}
function createMainWindow() {
  const win = new BrowserWindow({
    width: BASE_WIDTH,
    height: INITIAL_CONTENT_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: Math.round(MIN_CONTENT_HEIGHT * MIN_SCALE),
    maxWidth: MAX_WINDOW_WIDTH,
    maxHeight: Math.round(MAX_CONTENT_HEIGHT * MAX_SCALE),
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    useContentSize: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const webContentsId = win.webContents.id;
  contentMetrics.set(webContentsId, { baseHeight: INITIAL_CONTENT_HEIGHT, anchorBottom: false });
  win.on('focus', () => scheduleIdleFade());
  win.on('blur', () => applyAppOpacity());
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.setAlwaysOnTop(true);
      scheduleIdleFade();
      win.show();
      syncSuggestWindowVisibility();
    }
  });
  win.on('move', () => positionSuggestWindow(false));
  win.on('resize', () => positionSuggestWindow(false));
  win.on('show', () => syncSuggestWindowVisibility());
  win.on('hide', () => syncSuggestWindowVisibility());
  win.on('minimize', () => syncSuggestWindowVisibility());
  win.on('restore', () => syncSuggestWindowVisibility());
  win.loadFile(path.join(__dirname, '..', 'site', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('app:window-scale', 1);
    }
  });
  win.on('closed', () => {
    contentMetrics.delete(webContentsId);
    if (suggestWindow && !suggestWindow.isDestroyed()) suggestWindow.close();
  });
  return win;
}
if (gotTheLock) {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.show();
      mainWindow.focus();
      syncSuggestWindowVisibility();
    }
  });
  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    mainWindow = createMainWindow();
    setupAutoUpdater(app, () => mainWindow);
    ipcMain.on('app:close', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) win.close();
    });
    ipcMain.on('app:interaction', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || (win !== mainWindow && win !== suggestWindow)) return;
      scheduleIdleFade();
    });
    ipcMain.on('suggest:show', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!payload || !win || !mainWindow || win !== mainWindow) return;
      const safePayload = sanitizeSuggestPayload(payload);
      if (!safePayload) return;
      const alreadyVisible = !!(suggestWindow && !suggestWindow.isDestroyed() && suggestWindow.isVisible());
      currentSuggestPayload = safePayload;
      if (!alreadyVisible) currentSuggestDirection = 'down';
      suggestMetrics = { height: estimateSuggestHeight(safePayload) };
      ensureSuggestWindow();
      sendSuggestPayload(safePayload);
      positionSuggestWindow(!alreadyVisible);
    });
    ipcMain.on('suggest:hide', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || !mainWindow || win !== mainWindow) return;
      hideSuggestWindow();
    });
    ipcMain.on('suggest:metrics', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || !suggestWindow || win !== suggestWindow) return;
      suggestMetrics = { height: clamp(Math.round(Number(payload?.height || 0)), 0, 360) };
      if (currentSuggestPayload && suggestMetrics.height > 0) positionSuggestWindow(true);
    });
    ipcMain.on('suggest:pick', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || !suggestWindow || win !== suggestWindow) return;
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('suggest:pick', payload || {});
        mainWindow.focus();
      }
      if (suggestWindow && !suggestWindow.isDestroyed()) clearSuggestRenderer();
      hideSuggestWindow(false);
    });
    ipcMain.on('window:resize-start', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win !== mainWindow || !isAllowedResizeEdge(payload?.edge)) return;
      const stored = contentMetrics.get(event.sender.id);
      resizeSessions.set(event.sender.id, { edge: payload.edge, startX: finiteNumber(payload.screenX), startY: finiteNumber(payload.screenY), startBounds: win.getBounds(), baseHeight: normalizeBaseHeight(stored?.baseHeight) });
    });
    ipcMain.on('window:resize-update', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const session = resizeSessions.get(event.sender.id);
      if (!win || !session || !payload) return;
      const dx = finiteNumber(payload.screenX, session.startX) - session.startX;
      const dy = finiteNumber(payload.screenY, session.startY) - session.startY;
      const next = getScaledBounds(session.startBounds, session.edge, dx, dy, session.baseHeight);
      win.setBounds({ x: next.x, y: next.y, width: next.width, height: next.height });
      event.sender.send('app:window-scale', next.scale);
      positionSuggestWindow(false);
    });
    ipcMain.on('window:resize-end', (event) => resizeSessions.delete(event.sender.id));
    ipcMain.on('app:content-size', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win !== mainWindow || !payload) return;
      const baseHeight = normalizeBaseHeight(payload.baseHeight);
      const stored = contentMetrics.get(event.sender.id) || { baseHeight: INITIAL_CONTENT_HEIGHT, anchorBottom: false };
      const nextAnchorBottom = Boolean(payload.anchorBottom);
      contentMetrics.set(event.sender.id, { baseHeight, anchorBottom: nextAnchorBottom });
      const bounds = win.getBounds();
      const scale = getWindowScale(bounds);
      const nextHeight = clamp(Math.round(baseHeight * scale), Math.round(MIN_CONTENT_HEIGHT * MIN_SCALE), Math.round(MAX_CONTENT_HEIGHT * MAX_SCALE));
      if (Math.abs(bounds.height - nextHeight) <= 1) {
        event.sender.send('app:window-scale', scale);
        positionSuggestWindow(false);
        return;
      }
      const keepBottomAnchored = Boolean(stored.anchorBottom || nextAnchorBottom);
      const nextY = keepBottomAnchored ? bounds.y + (bounds.height - nextHeight) : bounds.y;
      win.setBounds({ x: bounds.x, y: nextY, width: bounds.width, height: nextHeight });
      event.sender.send('app:window-scale', scale);
      positionSuggestWindow(false);
    });
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
      else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true);
        syncSuggestWindowVisibility();
      }
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    }
  });
}
app.on('before-quit', stopIdleFade);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
