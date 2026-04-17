function selectAllInSearch() { if (!q) return; try { q.select(); } catch (e) {} }
function focusAndSelectSearch() { if (!q) return; try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } selectAllInSearch(); }
if (window.desktopSuggest && typeof window.desktopSuggest.onPick === 'function') {
  window.desktopSuggest.onPick(({ text }) => {
    if (!text || !q) return;
    const termOriginal = q.value || '';
    rememberAlias(termOriginal, normalize(text));
    q.value = text;
    buscar();
    focusAndSelectSearch();
  });
}
if (q) {
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });
  q.addEventListener('pointerdown', (e) => { if (document.activeElement !== q) { e.preventDefault(); focusAndSelectSearch(); } });
  q.addEventListener('focus', () => selectAllInSearch());
  q.addEventListener('click', () => selectAllInSearch());
  window.addEventListener('DOMContentLoaded', () => { setInitialMessage(); focusAndSelectSearch(); });
} else {
  setInitialMessage();
}
