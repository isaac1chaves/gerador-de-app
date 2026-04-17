const ACTIVE_OPACITY = 1;
const INACTIVE_OPACITY = 0.78;
const path = require('node:path');
const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

const APP_ID = 'com.renapsi.buscaabrangencia';
const BASE_WIDTH = 760;
const INITIAL_CONTENT_HEIGHT = 62;
const MIN_CONTENT_HEIGHT = 62;
const MAX_CONTENT_HEIGHT = 520;
const MIN_SCALE = 0.62;
const MAX_SCALE = 1.8;
const SAFETY_WIDTH = 16;
const MIN_WINDOW_WIDTH = Math.ceil(BASE_WIDTH * MIN_SCALE) + SAFETY_WIDTH;
const MAX_WINDOW_WIDTH = Math.ceil(BASE_WIDTH * MAX_SCALE);

const resizeSessions = new Map();
const contentMetrics = new Map();
let mainWindow = null;
let suggestWindow = null;
let suggestMetrics = { height: 0 };
let currentSuggestPayload = null;
let currentSuggestDirection = 'down';

log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();

function clamp(n, min, max = Infinity) {
  return Math.max(min, Math.min(max, n));
}
function normalizeBaseHeight(value) {
  return clamp(Math.round(Number(value || INITIAL_CONTENT_HEIGHT)), MIN_CONTENT_HEIGHT, MAX_CONTENT_HEIGHT);
}
function getWindowScale(bounds) {
  return clamp(bounds.width / BASE_WIDTH, MIN_SCALE, MAX_SCALE);
}
function getScaledBounds(baseBounds, edge, dx, dy, baseContentHeight) {
  const logicalHeight = normalizeBaseHeight(baseContentHeight);
  const sxCandidates = [];
  const syCandidates = [];
  if (edge.includes('right')) sxCandidates.push((baseBounds.width + dx) / BASE_WIDTH);
  if (edge.includes('left')) sxCandidates.push((baseBounds.width - dx) / BASE_WIDTH);
  if (edge.includes('bottom')) syCandidates.push((baseBounds.height + dy) / logicalHeight);
  if (edge.includes('top')) syCandidates.push((baseBounds.height - dy) / logicalHeight);
  const sx = sxCandidates.length ? sxCandidates[0] : null;
  const sy = syCandidates.length ? syCandidates[0] : null;
  let scale = sx ?? sy ?? getWindowScale(baseBounds);
  if (sx !== null && sy !== null) {
    scale = Math.abs(sx - getWindowScale(baseBounds)) >= Math.abs(sy - getWindowScale(baseBounds)) ? sx : sy;
  }
  scale = clamp(scale, MIN_SCALE, MAX_SCALE);
  const width = Math.max(MIN_WINDOW_WIDTH, Math.round(BASE_WIDTH * scale));
  const height = Math.round(logicalHeight * scale);
  const appliedScale = width / BASE_WIDTH;
  let x = baseBounds.x;
  let y = baseBounds.y;
  const left = edge.includes('left');
  const right = edge.includes('right');
  const top = edge.includes('top');
  const bottom = edge.includes('bottom');
  if (left && !right) x = baseBounds.x + (baseBounds.width - width);
  if (top && !bottom) y = baseBounds.y + (baseBounds.height - height);
  if ((top || bottom) && !(left || right)) x = Math.round(baseBounds.x - (width - baseBounds.width) / 2);
  return { x, y, width, height, scale: appliedScale };
}
function getDisplayWorkArea(bounds) {
  const display = screen.getDisplayMatching(bounds);
  if (display?.workArea) return display.workArea;
  const primary = screen.getPrimaryDisplay();
  return { x: 0, y: 0, width: primary.workAreaSize.width, height: primary.workAreaSize.height };
}
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
  return isAnyAppWindowFocused() ? ACTIVE_OPACITY : INACTIVE_OPACITY;
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
      sandbox: false
    }
  });
  win.setAlwaysOnTop(true);
  win.setOpacity(getAppOpacity());
  win.loadFile(path.join(__dirname, 'suggest.html'));
  win.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setOpacity(ACTIVE_OPACITY);
    if (!win.isDestroyed()) win.setOpacity(ACTIVE_OPACITY);
  });
  win.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setOpacity(getAppOpacity());
    if (!win.isDestroyed()) win.setOpacity(getAppOpacity());
  });
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
      sandbox: false
    }
  });
  const webContentsId = win.webContents.id;
  contentMetrics.set(webContentsId, { baseHeight: INITIAL_CONTENT_HEIGHT, anchorBottom: false });
  win.on('focus', () => { win.setOpacity(ACTIVE_OPACITY); syncSuggestWindowOpacity(); });
  win.on('blur', () => { win.setOpacity(getAppOpacity()); syncSuggestWindowOpacity(); });
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.setAlwaysOnTop(true);
      win.setOpacity(ACTIVE_OPACITY);
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
function setupAutoUpdater() {
  if (!app.isPackaged) {
    log.info('Modo dev: auto-update desativado.');
    return;
  }
  autoUpdater.on('checking-for-update', () => log.info('Verificando atualização...'));
  autoUpdater.on('update-available', (info) => log.info('Atualização disponível:', info?.version || ''));
  autoUpdater.on('update-not-available', (info) => log.info('Nenhuma atualização disponível.', info?.version || ''));
  autoUpdater.on('download-progress', (progress) => log.info(`Baixando atualização: ${progress.percent.toFixed(1)}%`));
  autoUpdater.on('error', (err) => log.error('Erro no auto-update:', err));
  autoUpdater.on('update-downloaded', async (info) => {
    log.info('Atualização baixada:', info?.version || '');
    if (!mainWindow || mainWindow.isDestroyed()) {
      autoUpdater.quitAndInstall(true, true);
      return;
    }
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização pronta',
      message: `A versão ${info?.version || 'nova'} foi baixada com sucesso.`,
      detail: 'Deseja reiniciar o app agora para concluir a atualização?'
    });
    if (result.response === 0) autoUpdater.quitAndInstall(true, true);
  });
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000);
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
    setupAutoUpdater();
    ipcMain.on('app:close', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) win.close();
    });
    ipcMain.on('suggest:show', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!payload || !win || !mainWindow || win !== mainWindow) return;
      const alreadyVisible = !!(suggestWindow && !suggestWindow.isDestroyed() && suggestWindow.isVisible());
      currentSuggestPayload = payload;
      if (!alreadyVisible) currentSuggestDirection = 'down';
      suggestMetrics = { height: estimateSuggestHeight(payload) };
      ensureSuggestWindow();
      sendSuggestPayload(payload);
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
      if (!win || !payload?.edge) return;
      const stored = contentMetrics.get(event.sender.id);
      resizeSessions.set(event.sender.id, { edge: payload.edge, startX: Number(payload.screenX || 0), startY: Number(payload.screenY || 0), startBounds: win.getBounds(), baseHeight: normalizeBaseHeight(stored?.baseHeight) });
    });
    ipcMain.on('window:resize-update', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const session = resizeSessions.get(event.sender.id);
      if (!win || !session || !payload) return;
      const dx = Number(payload.screenX || 0) - session.startX;
      const dy = Number(payload.screenY || 0) - session.startY;
      const next = getScaledBounds(session.startBounds, session.edge, dx, dy, session.baseHeight);
      win.setBounds({ x: next.x, y: next.y, width: next.width, height: next.height });
      event.sender.send('app:window-scale', next.scale);
      positionSuggestWindow(false);
    });
    ipcMain.on('window:resize-end', (event) => resizeSessions.delete(event.sender.id));
    ipcMain.on('app:content-size', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || !payload) return;
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
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
