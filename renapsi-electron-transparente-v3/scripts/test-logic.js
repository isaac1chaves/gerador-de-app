const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const context = { console, localStorage: { getItem: () => null, setItem: () => {} } };
vm.createContext(context);
for (const file of ['utils.js', 'data.js', 'search-engine.js']) {
  const source = fs.readFileSync(path.join(root, 'site/assets/js', file), 'utf8');
  vm.runInContext(source, context, { filename: file });
}
vm.runInContext('globalThis.testApi = { normalize, extractCity, Anapolis, Brasilia, Aceito, rankSuggestions, SEARCH_STATUS };', context);
const api = context.testApi;

assert.equal(api.normalize('  São   Patrício '), 'sao patricio');
assert.equal(api.extractCity('Rua X - Aparecida de Goiânia/GO'), 'Aparecida de Goiânia');
assert.equal(api.extractCity('Cidade: Anápolis'), 'Cidade: Anápolis');
assert.equal(api.Brasilia.includes('Brasília'), true);
assert.equal(api.Anapolis.length, 29);
assert.equal(api.Brasilia.length, 20);
assert.equal(api.Aceito.length, 198);
assert.equal(api.rankSuggestions('ap go', 3).picks[0], 'Aparecida de Goiânia');
assert.equal(api.rankSuggestions('santo antonio descob', 3).picks.includes('Santo Antônio do Descoberto'), true);
assert.equal(api.SEARCH_STATUS.ACCEPTED, 'nossa');
console.log('Lógica validada: normalização, extração, grupos, grafia e sugestões.');

const mainSource = fs.readFileSync(path.join(root, 'site/assets/js/main.js'), 'utf8');
assert.match(mainSource, /pointerdown[\s\S]*event\.preventDefault\(\);[\s\S]*focusAndSelectSearch\(\);/);
console.log('Interação validada: clique no campo seleciona todo o texto.');


const resultSource = fs.readFileSync(path.join(root, 'site/assets/js/result.js'), 'utf8');
assert.match(resultSource, /const UNDO_PANEL_TIMEOUT_MS = 5000;/);
assert.match(resultSource, /function scheduleUndoPanelClose\(outSug = null\)/);
assert.match(resultSource, /scheduleUndoPanelClose\(\);/);
assert.match(resultSource, /scheduleUndoPanelClose\(outSug\);/);
assert.match(resultSource, /function undoLastSuggestionChoice\(\) \{\s*clearUndoPanelTimer\(\);/);
console.log('Interação validada: painel de desfazer fecha automaticamente após 5 segundos.');
