function selectAllInSearch() { if (!q) return; try { q.select(); } catch (e) {} }
function focusAndSelectSearch() { if (!q) return; try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } selectAllInSearch(); }
if (window.desktopSuggest && typeof window.desktopSuggest.onPick === 'function') {
  window.desktopSuggest.onPick(({ text, action }) => {
    if (action === 'undo') {
      undoLastSuggestionChoice();
      return;
    }
    if (!text || !q) return;
    const termOriginal = q.value || '';
    rememberAlias(termOriginal, normalize(text));
    lastSuggestionChoice = { originalText: termOriginal, selectedCity: text };
    buscar(text);
    focusAndSelectSearch();
  });
}
if (q) {
  q.addEventListener('keydown', (e) => {
    const browserSuggestions = Array.from(document.querySelectorAll('#outSuggest .sug-pill'));
    if (e.key === 'ArrowDown' && browserSuggestions.length) {
      e.preventDefault();
      browserSuggestions[0].focus();
      return;
    }
    if (e.key === 'Escape') {
      const wrap = ensureOutSuggest();
      hideElectronSuggestOverlay();
      if (wrap && !wrap.hidden) closeSuggestWrap(wrap);
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); buscar(); }
  });
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (!active || !active.classList || !active.classList.contains('sug-pill')) return;
    const pills = Array.from(document.querySelectorAll('#outSuggest .sug-pill'));
    const index = pills.indexOf(active);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      pills[(index + 1) % pills.length]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      pills[(index - 1 + pills.length) % pills.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      focusAndSelectSearch();
    }
  });
  q.addEventListener('pointerdown', (e) => { if (document.activeElement !== q) { e.preventDefault(); focusAndSelectSearch(); } });
  window.addEventListener('DOMContentLoaded', () => { setInitialMessage(); focusAndSelectSearch(); });
} else {
  setInitialMessage();
}

const IDLE_VISUAL_DELAY_MS = 8000;
let idleVisualTimer = null;
function wakeVisualInterface() {
  document.documentElement.classList.remove('is-idle');
  if (idleVisualTimer) clearTimeout(idleVisualTimer);
  idleVisualTimer = setTimeout(() => document.documentElement.classList.add('is-idle'), IDLE_VISUAL_DELAY_MS);
}
['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'focus'].forEach((eventName) => {
  window.addEventListener(eventName, wakeVisualInterface, { capture: true, passive: true });
});
wakeVisualInterface();
