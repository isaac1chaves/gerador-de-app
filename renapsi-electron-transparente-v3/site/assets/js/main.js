function selectAllInSearch(){
  if (!q) return;
  try { q.select(); } catch(e) {}
}

function focusAndSelectSearch(){
  if (!q) return;
  try { q.focus({ preventScroll: true }); } catch(e) { q.focus(); }
  selectAllInSearch();
}

if (q) {
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });

  // Ao clicar/tocar no campo, seleciona todo o texto atual para colar por cima
  q.addEventListener('pointerdown', (e) => {
    if (document.activeElement !== q) {
      e.preventDefault();
      focusAndSelectSearch();
    }
  });

  q.addEventListener('focus', () => {
    selectAllInSearch();
  });

  q.addEventListener('click', () => {
    selectAllInSearch();
  });

  window.addEventListener('DOMContentLoaded', () => {
    setInitialMessage();
    focusAndSelectSearch();
  });
} else {
  setInitialMessage();
}
