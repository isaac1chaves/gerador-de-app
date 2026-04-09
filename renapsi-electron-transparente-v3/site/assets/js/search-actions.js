function setInitialMessage(){
  out.innerHTML = '<div class="hint">Cole ou digite um texto contendo a cidade.</div>';
}

function buscar() {
  try {
    const raw = q.value || '';
    if (!raw.trim()) {
      const outSug = ensureOutSuggest();
      if (outSug) { closeSuggestWrap(outSug); outSug.innerHTML = ''; }
      setInitialMessage();
      return;
    }

    clearHighlights();
    const cidadeBruta = extractCity(raw);
    const keyRaw = normalize(cidadeBruta);
    const inAna = setAna.has(keyRaw);
    const inBra = setBra.has(keyRaw);
    const inCob = setCob.has(keyRaw);

    const listasEncontradas = [];
    if (inAna) listasEncontradas.push('ana');
    if (inBra) listasEncontradas.push('bra');
    if (inCob) listasEncontradas.push('nossa');

    if (listasEncontradas.length >= 2) { mostrarResultado(raw, cidadeBruta, 'dup', [], null, listasEncontradas); return; }
    if (inAna) { mostrarResultado(raw, cidadeBruta, 'ana', [], null); return; }
    if (inBra) { mostrarResultado(raw, cidadeBruta, 'bra', [], null); return; }
    if (inCob) { mostrarResultado(raw, cidadeBruta, 'nossa', [], null); return; }

    const aliasPick = getDynamicAliasSuggestion(raw, cidadeBruta);
    const ranked = rankSuggestions(cidadeBruta, 3);
    let sugs = ranked.picks;
    if (aliasPick){ sugs = [aliasPick, ...sugs.filter(s => normalize(s) !== normalize(aliasPick))].slice(0, 3); }
    mostrarResultado(raw, cidadeBruta, 'nao', sugs, null);
  } catch (err) {
    console.error('Erro no buscar():', err);
    const outSug = ensureOutSuggest();
    if (outSug) { closeSuggestWrap(outSug); outSug.innerHTML = ''; }
    out.innerHTML = '<div class="badge nao">⚠ Erro</div><div class="hint">Ocorreu um erro ao processar o texto.</div>';
  }
}

const AUTOSEARCH_MIN_CHARS = 2;
q.addEventListener('input', debounce(() => {
  const cidade = extractCity(q.value);
  const v = normalize(cidade);
  if (!v) {
    const outSug = ensureOutSuggest();
    if (outSug) hardResetSuggestWrap(outSug);
    setInitialMessage();
    return;
  }
  if (v.length < AUTOSEARCH_MIN_CHARS) {
    const outSug = ensureOutSuggest();
    if (outSug) { closeSuggestWrap(outSug); outSug.innerHTML = ''; }
    out.innerHTML = '<div class="hint">Digite pelo menos ' + AUTOSEARCH_MIN_CHARS + ' letras da cidade para localizar.</div>';
    return;
  }
  buscar();
}, 180));
