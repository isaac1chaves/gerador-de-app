function getStatusMeta(status, listasEncontradas = []) {
  if (status === 'ana') return { cls: 'ana', title: 'Anapolis', detail: 'Cidade atendida pelo núcleo de Anápolis.' };
  if (status === 'bra') return { cls: 'bra', title: 'Brasilia', detail: 'Cidade atendida pelo núcleo de Brasília.' };
  if (status === 'nossa') return { cls: 'ok', title: 'Aceito', detail: 'Cidade localizada na cobertura principal.' };
  if (status === 'dup') {
    const etiquetas = listasEncontradas.map((k) => k === 'ana' ? 'Anápolis' : k === 'bra' ? 'Brasília' : k === 'nossa' ? 'Cobertura' : k);
    return { cls: 'dup', title: 'Revisar', detail: `A cidade apareceu em múltiplas listas: ${etiquetas.join(' · ')}.` };
  }
  return { cls: 'nao', title: 'Não localizado', detail: 'Não encontrei essa cidade exatamente como foi digitada.' };
}
function renderCompactResult(statusMeta) {
  out.innerHTML = `
    <div class="result-main">
      <div class="result-pill ${escapeHtml(statusMeta.cls)}">
        <span class="title">${escapeHtml(statusMeta.title)}</span>
        <span class="sub">${escapeHtml(statusMeta.detail)}</span>
      </div>
    </div>
  `;
}
function renderDefaultResult() {
  out.innerHTML = `
    <div class="result-main">
      <div class="result-pill is-empty">
        <span class="title">Consulta rápida</span>
        <span class="sub">Digite o município</span>
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
        q.value = sText;
        buscar();
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
function mostrarResultado(termOriginal, focoCidade, status, sugestoes = [], aliasCanonico = null, listasEncontradas = []) {
  const useDesktopSuggest = isDesktopRuntime() && !!window.desktopSuggest && typeof window.desktopSuggest.show === 'function';
  const outSug = useDesktopSuggest ? null : ensureOutSuggest();
  const meta = getStatusMeta(status, listasEncontradas);
  renderCompactResult(meta);

  if (status !== 'nao' && status !== 'dup') {
    hideDesktopSuggestOverlay();
    if (outSug) {
      closeSuggestWrap(outSug);
      outSug.innerHTML = '';
    }
    return;
  }

  const topTitle = status === 'dup' ? 'Precisa revisar o município' : 'Não encontrei uma correspondência exata';
  let topSub = status === 'dup' ? meta.detail : 'Escolha uma sugestão parecida para aplicar na pesquisa.';
  if (status === 'nao' && focoCidade) topSub = `Talvez você tenha querido dizer algo próximo de “${focoCidade}”.`;

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
