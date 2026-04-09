const path = require('node:path')
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')

const APP_ID = 'com.renapsi.buscaabrangencia'
const BASE_WIDTH = 760
const INITIAL_CONTENT_HEIGHT = 60
const MIN_CONTENT_HEIGHT = 60
const MAX_CONTENT_HEIGHT = 420
const MIN_SCALE = 0.62
const MAX_SCALE = 1.8
const SAFETY_WIDTH = 16
const MIN_WINDOW_WIDTH = Math.ceil(BASE_WIDTH * MIN_SCALE) + SAFETY_WIDTH
const MAX_WINDOW_WIDTH = Math.ceil(BASE_WIDTH * MAX_SCALE)

const resizeSessions = new Map()
const contentMetrics = new Map()
let mainWindow = null

log.transports.file.level = 'info'
autoUpdater.logger = log
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = false

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

function clamp(n, min, max = Infinity) {
  return Math.max(min, Math.min(max, n))
}

function normalizeBaseHeight(value) {
  return clamp(
    Math.round(Number(value || INITIAL_CONTENT_HEIGHT)),
    MIN_CONTENT_HEIGHT,
    MAX_CONTENT_HEIGHT
  )
}

function getWindowScale(bounds) {
  return clamp(bounds.width / BASE_WIDTH, MIN_SCALE, MAX_SCALE)
}

function getScaledBounds(baseBounds, edge, dx, dy, baseContentHeight) {
  const logicalHeight = normalizeBaseHeight(baseContentHeight)
  const sxCandidates = []
  const syCandidates = []

  if (edge.includes('right')) sxCandidates.push((baseBounds.width + dx) / BASE_WIDTH)
  if (edge.includes('left')) sxCandidates.push((baseBounds.width - dx) / BASE_WIDTH)
  if (edge.includes('bottom')) syCandidates.push((baseBounds.height + dy) / logicalHeight)
  if (edge.includes('top')) syCandidates.push((baseBounds.height - dy) / logicalHeight)

  const sx = sxCandidates.length ? sxCandidates[0] : null
  const sy = syCandidates.length ? syCandidates[0] : null

  let scale = sx ?? sy ?? getWindowScale(baseBounds)
  if (sx !== null && sy !== null) {
    scale = Math.abs(sx - getWindowScale(baseBounds)) >= Math.abs(sy - getWindowScale(baseBounds)) ? sx : sy
  }

  scale = clamp(scale, MIN_SCALE, MAX_SCALE)

  const width = Math.max(MIN_WINDOW_WIDTH, Math.round(BASE_WIDTH * scale))
  const height = Math.round(logicalHeight * scale)
  const appliedScale = width / BASE_WIDTH

  let x = baseBounds.x
  let y = baseBounds.y

  const left = edge.includes('left')
  const right = edge.includes('right')
  const top = edge.includes('top')
  const bottom = edge.includes('bottom')

  if (left && !right) x = baseBounds.x + (baseBounds.width - width)
  if (top && !bottom) y = baseBounds.y + (baseBounds.height - height)

  if ((top || bottom) && !(left || right)) {
    x = Math.round(baseBounds.x - (width - baseBounds.width) / 2)
  }

  return { x, y, width, height, scale: appliedScale }
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
    hasShadow: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    useContentSize: true,
    show: false,
    // Mantém o app acima das demais janelas no Windows.
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const webContentsId = win.webContents.id
  contentMetrics.set(webContentsId, { baseHeight: INITIAL_CONTENT_HEIGHT, anchorBottom: false })

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.setAlwaysOnTop(true)
      win.show()
    }
  })

  win.loadFile(path.join(__dirname, '..', 'site', 'index.html'))

  win.webContents.on('did-finish-load', () => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('app:window-scale', 1)
    }
  })

  win.on('closed', () => {
    contentMetrics.delete(webContentsId)
  })

  return win
}




function setupAutoUpdater() {
  if (!app.isPackaged) {
    log.info('Modo dev: auto-update desativado.')
    return
  }

  autoUpdater.on('checking-for-update', () => {
    log.info('Verificando atualização...')
  })

  autoUpdater.on('update-available', (info) => {
    log.info('Atualização disponível:', info?.version || '')
  })

  autoUpdater.on('update-not-available', (info) => {
    log.info('Nenhuma atualização disponível.', info?.version || '')
  })

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Baixando atualização: ${progress.percent.toFixed(1)}%`)
  })

  autoUpdater.on('update-downloaded', async (info) => {
    log.info('Atualização baixada:', info?.version || '')
    if (!mainWindow || mainWindow.isDestroyed()) {
      autoUpdater.quitAndInstall()
      return
    }
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização pronta',
      message: `A versão ${info?.version || 'nova'} foi baixada com sucesso.`,
      detail: 'Deseja reiniciar o app agora para concluir a atualização?'
    })
    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  autoUpdater.on('error', (err) => {
    log.error('Erro no auto-update:', err)
  })

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 3000)
}

if (gotTheLock) {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.setAlwaysOnTop(true)
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID)

    mainWindow = createMainWindow()
    setupAutoUpdater()

    ipcMain.on('app:close', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) win.close()
    })

    ipcMain.on('window:resize-start', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win || !payload?.edge) return
      const stored = contentMetrics.get(event.sender.id)
      resizeSessions.set(event.sender.id, {
        edge: payload.edge,
        startX: Number(payload.screenX || 0),
        startY: Number(payload.screenY || 0),
        startBounds: win.getBounds(),
        baseHeight: normalizeBaseHeight(stored?.baseHeight)
      })
    })

    ipcMain.on('window:resize-update', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const session = resizeSessions.get(event.sender.id)
      if (!win || !session || !payload) return
      const dx = Number(payload.screenX || 0) - session.startX
      const dy = Number(payload.screenY || 0) - session.startY
      const next = getScaledBounds(session.startBounds, session.edge, dx, dy, session.baseHeight)
      win.setBounds({ x: next.x, y: next.y, width: next.width, height: next.height })
      event.sender.send('app:window-scale', next.scale)
    })

    ipcMain.on('window:resize-end', (event) => {
      resizeSessions.delete(event.sender.id)
    })

    ipcMain.on('app:content-size', (event, payload) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win || !payload) return
      const baseHeight = normalizeBaseHeight(payload.baseHeight)
      const stored = contentMetrics.get(event.sender.id) || { baseHeight: INITIAL_CONTENT_HEIGHT, anchorBottom: false }
      const nextAnchorBottom = Boolean(payload.anchorBottom)
      contentMetrics.set(event.sender.id, { baseHeight, anchorBottom: nextAnchorBottom })
      const bounds = win.getBounds()
      const scale = getWindowScale(bounds)
      const nextHeight = clamp(
        Math.round(baseHeight * scale),
        Math.round(MIN_CONTENT_HEIGHT * MIN_SCALE),
        Math.round(MAX_CONTENT_HEIGHT * MAX_SCALE)
      )
      if (Math.abs(bounds.height - nextHeight) <= 1) {
        event.sender.send('app:window-scale', scale)
        return
      }
      const keepBottomAnchored = Boolean(stored.anchorBottom || nextAnchorBottom)
      const nextY = keepBottomAnchored ? bounds.y + (bounds.height - nextHeight) : bounds.y
      win.setBounds({
        x: bounds.x,
        y: nextY,
        width: bounds.width,
        height: nextHeight
      })
      event.sender.send('app:window-scale', scale)
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      } else if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true)
      }
    })

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    }

  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
