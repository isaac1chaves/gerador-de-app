function setInitialMessage() { renderDefaultResult(); }
function hideElectronSuggestOverlay() {
  try {
    if (window.desktopSuggest && typeof window.desktopSuggest.hide === 'function') {
      window.desktopSuggest.hide();
    }
  } catch (e) {}
}
function buscar() {
  try {
    const raw = q.value || '';
    if (!raw.trim()) {
      hideElectronSuggestOverlay();
      const outSug = ensureOutSuggest();
      if (outSug) { closeSuggestWrap(outSug); outSug.innerHTML = ''; }
      setInitialMessage();
      return;
    }
    clearHighlights();
    const cidadeBruta = extractCity(raw);
    const keyRaw = normalize(cidadeBruta);
    const inAna = setAna.has(keyRaw), inBra = setBra.has(keyRaw), inCob = setCob.has(keyRaw);
    const listasEncontradas = [];
    if (inAna) listasEncontradas.push('ana');
    if (inBra) listasEncontradas.push('bra');
    if (inCob) listasEncontradas.push('nossa');
    if (listasEncontradas.length >= 2) return void mostrarResultado(raw, cidadeBruta, 'dup', [], null, listasEncontradas);
    if (inAna) return void mostrarResultado(raw, cidadeBruta, 'ana', [], null);
    if (inBra) return void mostrarResultado(raw, cidadeBruta, 'bra', [], null);
    if (inCob) return void mostrarResultado(raw, cidadeBruta, 'nossa', [], null);
    const aliasPick = getDynamicAliasSuggestion(raw, cidadeBruta);
    const ranked = rankSuggestions(cidadeBruta, 3);
    let sugs = ranked.picks;
    if (aliasPick) sugs = [aliasPick, ...sugs.filter((s) => normalize(s) !== normalize(aliasPick))].slice(0, 3);
    mostrarResultado(raw, cidadeBruta, 'nao', sugs, null);
  } catch (err) {
    console.error('Erro no buscar():', err);
    hideElectronSuggestOverlay();
    const outSug = ensureOutSuggest();
    if (outSug) { closeSuggestWrap(outSug); outSug.innerHTML = ''; }
    out.innerHTML = `
      <div class="result-main">
        <div class="result-pill nao">
          <span class="title">⚠ Erro</span>
          <span class="sub">Ocorreu um erro ao processar o texto.</span>
        </div>
      </div>
    `;
  }
}
const AUTOSEARCH_MIN_CHARS = 2;
q.addEventListener('input', debounce(() => {
  const cidade = extractCity(q.value);
  const v = normalize(cidade);
  if (!v) {
    hideElectronSuggestOverlay();
    const outSug = ensureOutSuggest();
    if (outSug) hardResetSuggestWrap(outSug);
    setInitialMessage();
    return;
  }
  if (v.length < AUTOSEARCH_MIN_CHARS) {
    hideElectronSuggestOverlay();
    const outSug = ensureOutSuggest();
    if (outSug) { closeSuggestWrap(outSug); outSug.innerHTML = ''; }
    out.innerHTML = `
      <div class="result-main">
        <div class="result-pill is-empty">
          <span class="title">Consulta rápida</span>
          <span class="sub">Digite mais letras</span>
        </div>
      </div>
    `;
    return;
  }
  buscar();
}, 180));
