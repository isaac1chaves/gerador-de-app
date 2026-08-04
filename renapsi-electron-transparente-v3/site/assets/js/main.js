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
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
  q.addEventListener('pointerdown', (e) => { if (document.activeElement !== q) { e.preventDefault(); focusAndSelectSearch(); } });
  window.addEventListener('DOMContentLoaded', () => { setInitialMessage(); focusAndSelectSearch(); });
} else {
  setInitialMessage();
}
