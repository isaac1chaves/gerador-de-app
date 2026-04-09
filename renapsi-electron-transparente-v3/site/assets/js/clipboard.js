const COPYBTN_DEFAULT_ICON = '📋';
let copyBtnTimer = null;
function setCopyBtnIcon(icon, { copiedClass = false, duration = 900 } = {}) {
  if(!copyBtn) return;
  if(copyBtnTimer){ clearTimeout(copyBtnTimer); copyBtnTimer = null; }
  copyBtn.textContent = icon;
  copyBtn.classList.toggle('is-copied', !!copiedClass);
  copyBtnTimer = setTimeout(() => {
    copyBtn.textContent = COPYBTN_DEFAULT_ICON;
    copyBtn.classList.remove('is-copied');
    copyBtnTimer = null;
  }, duration);
}
function pulsePasted(){ setCopyBtnIcon('✅', { copiedClass: true, duration: 900 }); }
function pulseWarn(){ setCopyBtnIcon('⚠', { copiedClass: false, duration: 900 }); }
async function pasteFromClipboard(){
  try {
    if (!window.isSecureContext || !(navigator.clipboard && navigator.clipboard.readText)) { pulseWarn(); return; }
    const txt = await navigator.clipboard.readText();
    const t = String(txt || '').trim();
    if (!t){ pulseWarn(); return; }
    q.value = t;
    try{ q.focus({preventScroll:true}); }catch(e){ q.focus(); }
    try{ q.setSelectionRange(q.value.length, q.value.length); }catch(e){}
    buscar();
    pulsePasted();
  } catch(e){ pulseWarn(); }
}
if (copyBtn) copyBtn.addEventListener('click', pasteFromClipboard);
