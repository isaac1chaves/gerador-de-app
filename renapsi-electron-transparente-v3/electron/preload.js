const { contextBridge, ipcRenderer } = require('electron')

const MIN_SCALE = 0.62

contextBridge.exposeInMainWorld('desktopWindow', {
  close: () => ipcRenderer.send('app:close')
})

function markInteractiveNoDrag(root = document) {
  const selector = [
    'button','input','textarea','select','option','a','label','summary','audio','video','iframe',
    '[role="button"]','[contenteditable="true"]','.no-drag','.copy-btn','.sug-pill','.search','.field'
  ].join(',')

  root.querySelectorAll(selector).forEach((el) => {
    el.style.setProperty('-webkit-app-region', 'no-drag', 'important')
  })
}

let layoutBatchDepth = 0
let pendingSyncAfterBatch = false

function beginLayoutBatch() {
  layoutBatchDepth += 1
}

function endLayoutBatch() {
  layoutBatchDepth = Math.max(0, layoutBatchDepth - 1)
  if (layoutBatchDepth === 0 && pendingSyncAfterBatch) {
    pendingSyncAfterBatch = false
    syncContentBounds()
  }
}

function buildScaleShell() {
  const existingNodes = Array.from(document.body.childNodes)
  const stage = document.createElement('div')
  stage.id = 'electron-stage'

  const scaleRoot = document.createElement('div')
  scaleRoot.id = 'electron-scale-root'

  existingNodes.forEach((node) => scaleRoot.appendChild(node))
  stage.appendChild(scaleRoot)
  document.body.appendChild(stage)

  return { stage, scaleRoot }
}

function injectShell() {
  const style = document.createElement('style')
  style.textContent = `
    :root {
      --app-base-width: 760px;
      --app-base-height: 60px;
      --app-scale: 1;
      --edge-size: 12px;
      --corner-size: 24px;
    }

    html, body {
      background: transparent !important;
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
    }

    body {
      display: block;
      -webkit-app-region: drag;
    }

    #electron-stage {
      position: fixed;
      inset: 0;
      display: grid;
      align-items: start;
      justify-items: center;
      background: transparent;
      pointer-events: none;
      overflow: visible;
    }

    #electron-scale-root {
      width: var(--app-base-width);
      min-height: var(--app-base-height);
      height: auto;
      zoom: var(--app-scale);
      pointer-events: auto;
      overflow: visible;
      outline: none;
      outline-offset: 0;
    }

    #electron-scale-root > * {
      width: 100%;
      pointer-events: auto;
    }

    
.electron-resize-handle {
      position: fixed;
      z-index: 2147483647;
      background: transparent;
      -webkit-app-region: no-drag !important;
      pointer-events: auto;
      user-select: none;
    }

    .electron-resize-handle.bottom-left {
      left: 2px;
      bottom: 2px;
      width: 12px;
      height: 12px;
      cursor: nesw-resize;
      clip-path: polygon(0 0, 0 100%, 100% 100%);
      background: linear-gradient(225deg,
        transparent 0 45%,
        rgba(118, 219, 255, 1) 46% 52%,
        rgba(118, 219, 255, 1) 53% 100%);
      opacity: 1;
      box-shadow: inset 0 0 0 1px rgba(118, 219, 255, .98);
    }

    .electron-resize-handle.bottom-left:hover {
      opacity: 1;
      filter: brightness(1.08);
    }
  `
  document.head.appendChild(style)

  const { scaleRoot } = buildScaleShell()
  scaleRoot.style.setProperty('-webkit-app-region', 'drag', 'important')
  markInteractiveNoDrag(scaleRoot)

  const edges = [
    'bottom-left'
  ]

  let resizing = false

  function stopResize() {
    if (!resizing) return
    ipcRenderer.send('window:resize-end')
    resizing = false
    window.removeEventListener('mousemove', onMove, true)
    window.removeEventListener('mouseup', stopResize, true)
    window.removeEventListener('blur', stopResize, true)
  }

  function onMove(ev) {
    if (!resizing) return
    ipcRenderer.send('window:resize-update', {
      screenX: ev.screenX,
      screenY: ev.screenY
    })
  }

  function startResize(edge, ev) {
    ev.preventDefault()
    ev.stopPropagation()
    resizing = true
    ipcRenderer.send('window:resize-start', {
      edge,
      screenX: ev.screenX,
      screenY: ev.screenY
    })
    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('mouseup', stopResize, true)
    window.addEventListener('blur', stopResize, true)
  }

  edges.forEach((edge) => {
    const handle = document.createElement('div')
    handle.className = `electron-resize-handle ${edge}`
    handle.dataset.edge = edge
    handle.setAttribute('aria-hidden', 'true')
    handle.title = 'Redimensionar'
    handle.addEventListener('mousedown', (ev) => startResize(edge, ev), true)
    document.body.appendChild(handle)
  })


  let contentSizeFrame = 0
  const syncContentBounds = () => {
    if (layoutBatchDepth > 0) {
      pendingSyncAfterBatch = true
      return
    }

    if (contentSizeFrame) cancelAnimationFrame(contentSizeFrame)
    contentSizeFrame = requestAnimationFrame(() => {
      contentSizeFrame = 0
      const shell = scaleRoot.querySelector('.app-shell') || scaleRoot.firstElementChild || scaleRoot
      const baseHeight = Math.max(60, Math.ceil(shell ? shell.scrollHeight : (scaleRoot.scrollHeight || 60)))
      document.documentElement.style.setProperty('--app-base-height', `${baseHeight}px`)
      ipcRenderer.send('app:content-size', {
        baseWidth: 760,
        baseHeight,
        anchorBottom: !!(shell && shell.classList && shell.classList.contains('suggest-up'))
      })
      markInteractiveNoDrag(scaleRoot)
    })
  }

  window.addEventListener('renapsi:layout-batch-start', beginLayoutBatch)
  window.addEventListener('renapsi:layout-batch-end', endLayoutBatch)

  const resizeObserver = new ResizeObserver(() => {
    syncContentBounds()
  })
  resizeObserver.observe(scaleRoot)
  const shell = scaleRoot.querySelector('.app-shell')
  if (shell) resizeObserver.observe(shell)

  const mutationObserver = new MutationObserver(() => {
    syncContentBounds()
  })
  mutationObserver.observe(scaleRoot, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
    attributeFilter: ['hidden', 'class', 'style']
  })

  window.addEventListener('load', syncContentBounds)
  window.addEventListener('resize', syncContentBounds)

  ipcRenderer.on('app:window-scale', (_event, scale) => {
    const safeScale = Math.max(Number(scale || 1), MIN_SCALE)
    document.documentElement.style.setProperty('--app-scale', String(safeScale))
    syncContentBounds()
  })

  syncContentBounds()
}

window.addEventListener('DOMContentLoaded', injectShell)
