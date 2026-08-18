const UNDO_PANEL_TIMEOUT_MS = 5000;
let undoPanelTimer = null;
let undoPanelGeneration = 0;

function clearUndoPanelTimer() {
  undoPanelGeneration += 1;
  if (!undoPanelTimer) return;
  clearTimeout(undoPanelTimer);
  undoPanelTimer = null;
}

function scheduleUndoPanelClose(outSug = null) {
  clearUndoPanelTimer();
  const generation = undoPanelGeneration;

  undoPanelTimer = setTimeout(() => {
    if (generation !== undoPanelGeneration) return;

    hideDesktopSuggestOverlay();
    if (outSug) {
      closeSuggestWrap(outSug);
      outSug.innerHTML = '';
    }

    undoPanelTimer = null;
  }, UNDO_PANEL_TIMEOUT_MS);
}

function getStatusMeta(status, listasEncontradas = []) {
  if (status === SEARCH_STATUS.ANAPOLIS) return { cls: SEARCH_STATUS.ANAPOLIS, title: 'Anápolis', detail: 'Cidade atendida pelo núcleo de Anápolis.' };
  if (status === SEARCH_STATUS.BRASILIA) return { cls: SEARCH_STATUS.BRASILIA, title: 'Brasília', detail: 'Cidade atendida pelo núcleo de Brasília.' };
  if (status === SEARCH_STATUS.ACCEPTED) return { cls: 'ok', title: 'Aceito', detail: 'Cidade localizada na cobertura principal.' };
  if (status === SEARCH_STATUS.DUPLICATE) {
    const etiquetas = listasEncontradas.map((k) => k === 'ana' ? 'Anápolis' : k === 'bra' ? 'Brasília' : k === 'nossa' ? 'Cobertura' : k);
    return { cls: SEARCH_STATUS.DUPLICATE, title: 'Revisar', detail: `A cidade apareceu em múltiplas listas: ${etiquetas.join(' · ')}.` };
  }
  return { cls: SEARCH_STATUS.NOT_FOUND, title: 'Não localizado', detail: 'Não encontrei essa cidade exatamente como foi digitada.' };
}
function renderCompactResult(statusMeta, recognizedCity = null) {
  out.innerHTML = `
    <div class="result-main">
      <div class="result-pill ${escapeHtml(statusMeta.cls)}${recognizedCity ? ' has-recognized' : ''}">
        <span class="title">${escapeHtml(statusMeta.title)}</span>
        <span class="sub">${recognizedCity ? `<span class="status-check" aria-hidden="true">✓</span>` : ''}<span class="recognized-city">${recognizedCity ? escapeHtml(recognizedCity) : escapeHtml(statusMeta.detail)}</span></span>
      </div>
    </div>
  `;
}
function renderDefaultResult() {
  out.innerHTML = `
    <div class="result-main">
      <div class="result-pill is-empty">
      </div>
    </div>
  `;
}
function hideDesktopSuggestOverlay() {
  try {
    if (isDesktopRuntime() && window.desktopSuggest && typeof window.desktopSuggest.hide === 'function') {
      window.desktopSuggest.hide();
    }
  } catch (e) {}
}
function showDesktopSuggestOverlay(payload) {
  try {
    if (isDesktopRuntime() && window.desktopSuggest && typeof window.desktopSuggest.show === 'function') {
      window.desktopSuggest.show(payload);
      return true;
    }
  } catch (e) {}
  return false;
}
function ensureBrowserSuggestBox(outSug) {
  if (!outSug) return null;
  let sug = outSug.querySelector('.suggest');
  if (sug) return sug;

  sug = document.createElement('div');
  sug.className = 'suggest';
  sug.setAttribute('role', 'status');
  sug.innerHTML = `
    <div class="sug-icon" aria-hidden="true">💡</div>
    <div class="sug-copy">
      <div class="sug-title"></div>
      <div class="sug-sub"></div>
    </div>
    <div class="sug-actions"></div>
  `;
  outSug.innerHTML = '';
  outSug.appendChild(sug);
  return sug;
}
function fillBrowserSuggestBox(sug, termOriginal, topTitle, topSub, sugestoes = []) {
  if (!sug) return;
  const titleEl = sug.querySelector('.sug-title');
  const subEl = sug.querySelector('.sug-sub');
  const actions = sug.querySelector('.sug-actions');
  if (titleEl) titleEl.textContent = topTitle;
  if (subEl) subEl.textContent = topSub;
  if (!actions) return;

  actions.innerHTML = '';
  if (Array.isArray(sugestoes) && sugestoes.length) {
    sugestoes.forEach((sText) => {
      const b = document.createElement('button');
      const cat = sugestaoCategoria(sText);
      b.className = `sug-pill ${cat}`;
      b.type = 'button';
      b.textContent = sText;
      b.setAttribute('aria-label', `Usar sugestão ${sText}`);
      b.addEventListener('click', () => {
        rememberAlias(termOriginal, normalize(sText));
        lastSuggestionChoice = { originalText: termOriginal, selectedCity: sText };
        buscar(sText);
      });
      actions.appendChild(b);
    });
  } else {
    const span = document.createElement('span');
    span.className = 'sug-sub';
    span.textContent = 'Nenhuma sugestão próxima foi encontrada.';
    actions.appendChild(span);
  }
}
function showBrowserUndoPanel(outSug, undoInfo, recognizedCity) {
  if (!outSug || !undoInfo) return;
  const wasHidden = outSug.hidden;
  outSug.innerHTML = `
    <section class="suggest undo-suggest" role="status">
      <div class="sug-icon" aria-hidden="true">↶</div>
      <div class="sug-copy">
        <div class="sug-title">Cidade aplicada: ${escapeHtml(recognizedCity || undoInfo.selectedCity || '')}</div>
        <div class="sug-sub">A escolha pode ser desfeita e as sugestões serão exibidas novamente.</div>
      </div>
      <div class="sug-actions">
        <button class="sug-pill undo-panel-button" type="button">Desfazer escolha</button>
      </div>
    </section>
  `;
  const button = outSug.querySelector('.undo-panel-button');
  if (button) button.addEventListener('click', () => undoLastSuggestionChoice());
  if (wasHidden) openSuggestWrap(outSug);
  else updateSuggestPlacement(outSug, true);
}
function undoLastSuggestionChoice() {
  clearUndoPanelTimer();
  if (!lastSuggestionChoice) return;
  forgetAlias(lastSuggestionChoice.originalText);
  lastSuggestionChoice = null;
  hideDesktopSuggestOverlay();
  buscar();
  if (typeof focusAndSelectSearch === 'function') focusAndSelectSearch();
}
function mostrarResultado(termOriginal, focoCidade, status, sugestoes = [], aliasCanonico = null, listasEncontradas = [], recognizedCity = null, undoInfo = null) {
  const useDesktopSuggest = isDesktopRuntime() && !!window.desktopSuggest && typeof window.desktopSuggest.show === 'function';
  const outSug = useDesktopSuggest ? null : ensureOutSuggest();
  const meta = getStatusMeta(status, listasEncontradas);
  renderCompactResult(meta, recognizedCity);

  if (status !== 'nao' && status !== 'dup') {
    if (undoInfo) {
      if (useDesktopSuggest) {
        showDesktopSuggestOverlay({
          mode: 'undo',
          title: `Cidade aplicada: ${recognizedCity || undoInfo.selectedCity || ''}`,
          subtitle: 'A escolha pode ser desfeita e as sugestões serão exibidas novamente.',
          suggestions: [{ text: 'Desfazer escolha', category: SEARCH_STATUS.NOT_FOUND, action: 'undo' }]
        });
        scheduleUndoPanelClose();
      } else {
        showBrowserUndoPanel(outSug, undoInfo, recognizedCity);
        scheduleUndoPanelClose(outSug);
      }
    } else {
      clearUndoPanelTimer();
      hideDesktopSuggestOverlay();
      if (outSug) {
        closeSuggestWrap(outSug);
        outSug.innerHTML = '';
      }
    }
    return;
  }

  clearUndoPanelTimer();
  const topTitle = status === SEARCH_STATUS.DUPLICATE ? 'Precisa revisar o município' : 'Não encontrei uma correspondência exata';
  let topSub = status === SEARCH_STATUS.DUPLICATE ? meta.detail : 'Escolha uma sugestão parecida para aplicar na pesquisa.';
  if (status === SEARCH_STATUS.NOT_FOUND && focoCidade) topSub = `Talvez você tenha querido dizer algo próximo de “${focoCidade}”.`;

  if (useDesktopSuggest) {
    const items = Array.isArray(sugestoes)
      ? sugestoes.map((sText) => ({ text: sText, category: sugestaoCategoria(sText) }))
      : [];
    showDesktopSuggestOverlay({ title: topTitle, subtitle: topSub, suggestions: items });
    return;
  }

  if (!outSug) return;

  const wasHidden = outSug.hidden;
  const sug = ensureBrowserSuggestBox(outSug);
  fillBrowserSuggestBox(sug, termOriginal, topTitle, topSub, sugestoes);

  if (wasHidden) openSuggestWrap(outSug);
  else updateSuggestPlacement(outSug, true);
}
