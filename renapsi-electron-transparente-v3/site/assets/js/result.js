function getStatusMeta(status, listasEncontradas = []) {
  if (status === 'ana') return { cls: 'ana', title: 'Anápolis', detail: 'Cidade atendida pelo núcleo de Anápolis.' };
  if (status === 'bra') return { cls: 'bra', title: 'Brasília', detail: 'Cidade atendida pelo núcleo de Brasília.' };
  if (status === 'nossa') return { cls: 'ok', title: 'Atendimento', detail: 'Cidade localizada na cobertura principal.' };
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
function mostrarResultado(termOriginal, focoCidade, status, sugestoes = [], aliasCanonico = null, listasEncontradas = []) {
  hideDesktopSuggestOverlay();
  const useDesktopSuggest = isDesktopRuntime() && !!window.desktopSuggest && typeof window.desktopSuggest.show === 'function';
  const outSug = useDesktopSuggest ? null : ensureOutSuggest();
  if (outSug) { closeSuggestWrap(outSug); outSug.innerHTML = ''; }
  const meta = getStatusMeta(status, listasEncontradas);
  renderCompactResult(meta);
  if (status !== 'nao' && status !== 'dup') return;
  const topTitle = status === 'dup' ? 'Precisa revisar o município' : 'Não encontrei uma correspondência exata';
  let topSub = status === 'dup' ? meta.detail : 'Escolha uma sugestão parecida para aplicar na pesquisa.';
  if (status === 'nao' && focoCidade) topSub = `Talvez você tenha querido dizer algo próximo de “${focoCidade}”.`;
  if (useDesktopSuggest) {
    const items = Array.isArray(sugestoes) ? sugestoes.map((sText) => ({ text: sText, category: sugestaoCategoria(sText) })) : [];
    showDesktopSuggestOverlay({ title: topTitle, subtitle: topSub, suggestions: items });
    return;
  }
  if (!outSug) return;
  const sug = document.createElement('div');
  sug.className = 'suggest';
  sug.setAttribute('role', 'status');
  sug.innerHTML = `
    <div class="sug-icon" aria-hidden="true">💡</div>
    <div>
      <div class="sug-title">${escapeHtml(topTitle)}</div>
      <div class="sug-sub">${escapeHtml(topSub)}</div>
    </div>
    <div class="sug-actions"></div>
  `;
  const actions = sug.querySelector('.sug-actions');
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
  outSug.appendChild(sug);
  openSuggestWrap(outSug);
}
