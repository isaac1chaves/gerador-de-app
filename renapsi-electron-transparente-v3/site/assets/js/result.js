// ====== RENDERIZAÇÃO DE RESULTADO & DICAS ======
function getStatusMeta(status, listasEncontradas = []) {
  if (status === 'ana') {
    return { cls: 'ana', title: 'Anapolis', detail: 'Cidade atendida pelo núcleo de Anápolis.' };
  }
  if (status === 'bra') {
    return { cls: 'bra', title: 'Brasília', detail: 'Cidade atendida pelo núcleo de Brasília.' };
  }
  if (status === 'nossa') {
    return { cls: 'ok', title: 'Atendimento', detail: 'Cidade localizada na cobertura principal.' };
  }
  if (status === 'dup') {
    const etiquetas = listasEncontradas.map(k => {
      if (k === 'ana') return 'Anápolis';
      if (k === 'bra') return 'Brasília';
      if (k === 'nossa') return 'Cobertura';
      return k;
    });
    return { cls: 'dup', title: 'Revisar', detail: `A cidade apareceu em múltiplas listas: ${etiquetas.join(' · ')}.` };
  }
  return { cls: 'nao', title: 'Não localizado', detail: 'Não encontrei essa cidade exatamente como foi digitada.' };
}

function renderCompactResult(statusMeta) {
  out.innerHTML = `
    <div class="result-main">
      <div class="result-pill ${statusMeta.cls}" title="${escapeHtml(statusMeta.detail || '')}">
        <span class="title">${escapeHtml(statusMeta.title)}</span>
      </div>
    </div>
  `;
}

function renderDefaultResult() {
  out.innerHTML = `
    <div class="result-main">
      <div class="result-pill is-empty" title="Digite ou cole uma cidade para consultar">
        <span class="title">Consulta rápida</span>
      </div>
    </div>
  `;
}

function mostrarResultado(termOriginal, focoCidade, status, sugestoes = [], aliasCanonico = null, listasEncontradas = []) {
  const outSug = ensureOutSuggest();
  if (outSug) { closeSuggestWrap(outSug); outSug.innerHTML = ''; }

  const meta = getStatusMeta(status, listasEncontradas);
  renderCompactResult(meta);

  if ((status === 'nao' || status === 'dup') && outSug) {
    const sug = document.createElement('div');
    sug.className = 'suggest anim-drop';
    sug.setAttribute('role', 'status');

    const topTitle = status === 'dup' ? 'Precisa revisar o município' : 'Não encontrei uma correspondência exata';
    let topSub = status === 'dup'
      ? meta.detail
      : 'Escolha uma sugestão parecida para aplicar na pesquisa.';

    if (status === 'nao' && focoCidade) {
      topSub = `Talvez você tenha querido dizer algo próximo de “${focoCidade}”.`;
    }

    sug.innerHTML = `
      <div class="sug-icon">💡</div>
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
        b.className = 'sug-pill ' + cat;
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
}
