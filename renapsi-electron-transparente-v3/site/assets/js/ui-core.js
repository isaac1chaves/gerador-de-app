const q = document.getElementById('q');
const out = document.getElementById('out');
const copyBtn = document.getElementById('copyBtn');

function ensureOutSuggest(){ return document.getElementById('outSuggest'); }
function getAppShell(){ return document.querySelector('.app-shell'); }

function getSuggestGap(){ return 12; }
function getFlipHysteresis(){ return 28; }

function resetSuggestPlacement(){
  const shell = getAppShell();
  if (!shell) return;
  shell.classList.remove('suggest-up');
}

function shouldSuggestFlipUp(box){
  const gap = getSuggestGap();
  const hysteresis = getFlipHysteresis();
  const shell = getAppShell();
  const isUp = !!shell && shell.classList.contains('suggest-up');
  const boxHeight = Math.ceil(box?.getBoundingClientRect().height || box?.offsetHeight || 0);
  const threshold = boxHeight + gap;
  const screenTop = Number(window.screenY ?? window.screenTop ?? 0);
  const outerHeight = Number(window.outerHeight || window.innerHeight || 0);
  const availHeight = Number(window.screen?.availHeight || window.innerHeight || 0);
  const roomOnScreen = availHeight - (screenTop + outerHeight);

  if (isUp) {
    return roomOnScreen < (threshold + hysteresis);
  }
  return roomOnScreen < threshold;
}

function applySuggestPlacement(wrap){
  const shell = getAppShell();
  if (!shell || !wrap || wrap.hidden) {
    resetSuggestPlacement();
    return;
  }
  const box = wrap.querySelector('.suggest');
  if (!box) {
    resetSuggestPlacement();
    return;
  }
  const flipUp = shouldSuggestFlipUp(box);
  shell.classList.toggle('suggest-up', flipUp);
}

function updateSuggestPlacement(wrap, immediate = false){
  if (immediate) {
    applySuggestPlacement(wrap);
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => applySuggestPlacement(wrap)));
}

function openSuggestWrap(wrap){
  if (!wrap) return;
  wrap.hidden = false;
  wrap.classList.add('is-open');
  wrap.classList.add('is-measuring');
  updateSuggestPlacement(wrap, true);
  requestAnimationFrame(() => {
    wrap.classList.remove('is-measuring');
    updateSuggestPlacement(wrap, false);
  });
}

function closeSuggestWrap(wrap){
  if (!wrap) return;
  wrap.classList.remove('is-open');
  wrap.classList.remove('is-measuring');
  wrap.hidden = true;
  resetSuggestPlacement();
}

function hardResetSuggestWrap(wrap){
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.classList.remove('is-open');
  wrap.classList.remove('is-measuring');
  wrap.hidden = true;
  resetSuggestPlacement();
}

window.addEventListener('resize', () => {
  const wrap = ensureOutSuggest();
  if (wrap && !wrap.hidden) updateSuggestPlacement(wrap, false);
});

window.addEventListener('load', () => {
  const wrap = ensureOutSuggest();
  if (wrap && !wrap.hidden) updateSuggestPlacement(wrap, false);
});

function debounce(fn, wait=120){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,args), wait); }; }
function line(html) { const d = document.createElement('div'); d.innerHTML = html; return d; }
function sugestaoCategoria(cityText) {
  const k = normalize(cityText);
  const inAna = setAna.has(k), inBra = setBra.has(k), inCob = setCob.has(k);
  const count = (inAna?1:0) + (inBra?1:0) + (inCob?1:0);
  if (count >= 2) return 'nao';
  if (inCob) return 'ok';
  if (inBra) return 'bra';
  if (inAna) return 'ana';
  return 'nao';
}
