const q = document.getElementById('q');
const out = document.getElementById('out');
const copyBtn = document.getElementById('copyBtn');

function ensureOutSuggest() { return document.getElementById('outSuggest'); }
function getAppShell() { return document.querySelector('.app-shell'); }
function getAppStage() { return document.querySelector('.app-stage'); }
function getSuggestGap() { return 12; }
function getFlipHysteresis() { return 28; }
function isDesktopRuntime() { return !!window.desktopWindow; }

let suggestPlacementFrame = 0;

function emitLayoutBatch(eventName) {
  window.dispatchEvent(new Event(eventName));
}

function cancelSuggestPlacementFrame() {
  if (!suggestPlacementFrame) return;
  cancelAnimationFrame(suggestPlacementFrame);
  suggestPlacementFrame = 0;
}

function clearSuggestDirection(wrap) {
  if (!wrap) return;
  wrap.classList.remove('dir-up', 'dir-down');
  delete wrap.dataset.direction;
}

function setSuggestDirection(wrap, flipUp) {
  if (!wrap) return;
  wrap.classList.remove('dir-up', 'dir-down');
  wrap.classList.add(flipUp ? 'dir-up' : 'dir-down');
  wrap.dataset.direction = flipUp ? 'up' : 'down';
}

function resetSuggestPlacement() {
  const shell = getAppShell();
  if (!shell) return;
  shell.classList.remove('suggest-up');
}

function getDesktopRoomMetrics() {
  const screenTop = Number(window.screenY ?? window.screenTop ?? 0);
  const outerHeight = Number(window.outerHeight || window.innerHeight || 0);
  const availHeight = Number(window.screen?.availHeight || window.innerHeight || 0);

  return {
    roomBelow: Math.max(0, availHeight - (screenTop + outerHeight)),
    roomAbove: Math.max(0, screenTop)
  };
}

function getBrowserRoomMetrics(box) {
  const stage = getAppStage();
  const stageRect = (stage || box).getBoundingClientRect();

  return {
    roomBelow: Math.max(0, window.innerHeight - stageRect.bottom),
    roomAbove: Math.max(0, stageRect.top)
  };
}

function shouldSuggestFlipUp(box) {
  const gap = getSuggestGap();
  const hysteresis = getFlipHysteresis();
  const shell = getAppShell();
  const isUp = !!shell && shell.classList.contains('suggest-up');
  const boxHeight = Math.ceil(box?.getBoundingClientRect().height || box?.offsetHeight || 0);
  const threshold = boxHeight + gap;
  const metrics = isDesktopRuntime() ? getDesktopRoomMetrics() : getBrowserRoomMetrics(box);
  const roomBelow = metrics.roomBelow;
  const roomAbove = metrics.roomAbove;

  if (isUp) {
    if (roomBelow >= threshold + hysteresis && roomBelow > roomAbove) return false;
    return true;
  }

  if (roomBelow < threshold && roomAbove > roomBelow) return true;
  return false;
}

function applySuggestPlacement(wrap) {
  const shell = getAppShell();
  if (!shell || !wrap || wrap.hidden) {
    resetSuggestPlacement();
    clearSuggestDirection(wrap);
    return;
  }

  const box = wrap.querySelector('.suggest');
  if (!box) {
    resetSuggestPlacement();
    clearSuggestDirection(wrap);
    return;
  }

  const flipUp = shouldSuggestFlipUp(box);
  shell.classList.toggle('suggest-up', flipUp);
  setSuggestDirection(wrap, flipUp);
}

function updateSuggestPlacement(wrap, immediate = false) {
  if (!wrap || wrap.hidden || wrap.classList.contains('is-measuring')) return;

  if (immediate) {
    cancelSuggestPlacementFrame();
    applySuggestPlacement(wrap);
    return;
  }

  cancelSuggestPlacementFrame();
  suggestPlacementFrame = requestAnimationFrame(() => {
    suggestPlacementFrame = 0;
    applySuggestPlacement(wrap);
  });
}

function openSuggestWrap(wrap) {
  if (!wrap) return;

  const shell = getAppShell();
  const box = wrap.querySelector('.suggest');
  cancelSuggestPlacementFrame();
  emitLayoutBatch('renapsi:layout-batch-start');

  wrap.hidden = false;
  wrap.classList.add('is-open');
  wrap.classList.add('is-measuring');

  if (!shell || !box) {
    resetSuggestPlacement();
    clearSuggestDirection(wrap);
  } else {
    const flipUp = shouldSuggestFlipUp(box);
    shell.classList.toggle('suggest-up', flipUp);
    setSuggestDirection(wrap, flipUp);
  }

  requestAnimationFrame(() => {
    emitLayoutBatch('renapsi:layout-batch-end');
    requestAnimationFrame(() => {
      wrap.classList.remove('is-measuring');
      updateSuggestPlacement(wrap, true);
    });
  });
}

function closeSuggestWrap(wrap) {
  if (!wrap) return;

  cancelSuggestPlacementFrame();
  emitLayoutBatch('renapsi:layout-batch-start');

  wrap.classList.remove('is-open', 'is-measuring');
  wrap.hidden = true;

  requestAnimationFrame(() => {
    emitLayoutBatch('renapsi:layout-batch-end');
    requestAnimationFrame(() => {
      wrap.classList.remove('dir-up', 'dir-down');
      delete wrap.dataset.direction;
      resetSuggestPlacement();
    });
  });
}

function hardResetSuggestWrap(wrap) {
  if (!wrap) return;

  cancelSuggestPlacementFrame();
  wrap.innerHTML = '';
  wrap.classList.remove('is-open', 'is-measuring');
  wrap.hidden = true;

  requestAnimationFrame(() => {
    wrap.classList.remove('dir-up', 'dir-down');
    delete wrap.dataset.direction;
    resetSuggestPlacement();
  });
}

window.addEventListener('resize', () => {
  const wrap = ensureOutSuggest();
  if (wrap && !wrap.hidden) updateSuggestPlacement(wrap, false);
});
window.addEventListener('load', () => {
  const wrap = ensureOutSuggest();
  if (wrap && !wrap.hidden) updateSuggestPlacement(wrap, true);
});
window.addEventListener('scroll', () => {
  const wrap = ensureOutSuggest();
  if (wrap && !wrap.hidden) updateSuggestPlacement(wrap, false);
}, true);

function debounce(fn, wait = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

function line(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}

function sugestaoCategoria(cityText) {
  const k = normalize(cityText);
  const inAna = setAna.has(k);
  const inBra = setBra.has(k);
  const inCob = setCob.has(k);
  const count = (inAna ? 1 : 0) + (inBra ? 1 : 0) + (inCob ? 1 : 0);
  if (count >= 2) return 'nao';
  if (inCob) return 'ok';
  if (inBra) return 'bra';
  if (inAna) return 'ana';
  return 'nao';
}
