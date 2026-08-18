const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataSource = fs.readFileSync(path.join(root, 'site/assets/js/data.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(`${dataSource}\nglobalThis.__coverageData = { Anapolis, Brasilia, Aceito };`, context);

const normalize = (value) => String(value || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const groups = context.__coverageData;
const errors = [];
const seen = new Map();

for (const [group, cities] of Object.entries(groups)) {
  if (!Array.isArray(cities) || cities.length === 0) errors.push(`${group}: lista vazia ou inválida`);
  for (const city of cities) {
    const key = normalize(city);
    if (!key) errors.push(`${group}: município vazio`);
    const previous = seen.get(key);
    if (previous) errors.push(`Duplicidade: ${city} aparece em ${previous} e ${group}`);
    else seen.set(key, group);
  }
}

const expectations = {
  'anapolis': 'Anapolis',
  'brasilia': 'Brasilia',
  'aparecida de goiania': 'Aceito'
};
for (const [city, expectedGroup] of Object.entries(expectations)) {
  if (seen.get(city) !== expectedGroup) errors.push(`${city}: esperado em ${expectedGroup}, encontrado em ${seen.get(city) || 'nenhuma lista'}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Dados válidos: ${seen.size} municípios únicos.`);
