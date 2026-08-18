const SEARCH_STATUS = Object.freeze({
  ANAPOLIS: 'ana',
  BRASILIA: 'bra',
  ACCEPTED: 'nossa',
  DUPLICATE: 'dup',
  NOT_FOUND: 'nao'
});

const setAna = new Set(Anapolis.map(normalize));
const setBra = new Set(Brasilia.map(normalize));
const setCob = new Set(Aceito.map(normalize));
const allCities = [...Anapolis, ...Brasilia, ...Aceito];
const normToOriginal = new Map(allCities.map((c) => [normalize(c), c]));
const dynamicAliases = (() => {
  try {
    const obj = JSON.parse(localStorage.getItem('aliases') || '{}');
    return new Map(Object.entries(obj));
  } catch (e) {
    return new Map();
  }
})();
let lastSuggestionChoice = null;
function forgetAlias(fromRaw) {
  const keys = new Set([normalizeSearchInput(fromRaw)]);
  try { keys.add(normalizeSearchInput(extractCity(fromRaw))); } catch (e) {}
  keys.forEach((key) => { if (key) dynamicAliases.delete(key); });
  try { localStorage.setItem('aliases', JSON.stringify(Object.fromEntries(dynamicAliases))); } catch (e) {}
}
function rememberAlias(fromRaw, toCityText) {
  const k = normalizeSearchInput(fromRaw);
  if (!k || !toCityText) return;
  dynamicAliases.set(k, normalize(toCityText));
  try { localStorage.setItem('aliases', JSON.stringify(Object.fromEntries(dynamicAliases))); } catch (e) {}
}
function getDynamicAliasSuggestion(rawInput, extractedCity) {
  try {
    const keys = [normalizeSearchInput(rawInput), normalizeSearchInput(extractedCity)];
    for (const k of keys) {
      if (!k) continue;
      const mapped = dynamicAliases.get(k);
      if (!mapped) continue;
      const cityText = normToOriginal.get(mapped) || normToOriginal.get(normalize(mapped));
      if (cityText) return cityText;
    }
  } catch (e) {}
  return null;
}
function topSuggestions(v, limit = 2) {
  if (!v) return [];
  const all = [...Anapolis, ...Brasilia, ...Aceito];
  const allN = all.map(normalize);
  const scored = [];
  for (let i = 0; i < allN.length; i += 1) {
    const n = allN[i];
    let score;
    if (n.startsWith(v)) score = 0;
    else if (n.includes(v)) score = 1;
    else score = levenshtein(v, n) + 2;
    scored.push({ s: all[i], n, score });
  }
  scored.sort((a, b) => a.score - b.score);
  const thr = v.length <= 6 ? 2 : v.length <= 12 ? 3 : 4;
  const picks = [];
  for (const it of scored) {
    if (picks.length >= limit) break;
    const ok = (it.score <= 1) || ((it.score - 2) <= thr);
    if (ok && !picks.find((p) => normalize(p) === it.n)) picks.push(it.s);
  }
  return picks;
}
const SEARCH_STOPWORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'd', 'e']);
const SEARCH_TOKEN_MAP = { sto: 'santo', sant: 'santo', snt: 'santo', sta: 'santa', sn: 'sao', desc: 'descoberto', dsc: 'descoberto', descob: 'descoberto', descobr: 'descoberto', ap: 'aparecida' };
function normalizeSearchInput(s) {
  return normalize(String(s || '')).replace(/[^0-9a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function searchTokenize(raw) {
  const qn = normalizeSearchInput(raw);
  if (!qn) return [];
  const parts = qn.split(' ');
  const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    let w = parts[i];
    if (!w) continue;
    if (SEARCH_TOKEN_MAP[w]) w = SEARCH_TOKEN_MAP[w];
    if (!w || SEARCH_STOPWORDS.has(w) || w.length < 2) continue;
    out.push(w);
  }
  if (out.length >= 2 && out[0] === 'aparecida') {
    for (let i = 1; i < out.length; i += 1) if (out[i] === 'go') out[i] = 'goiania';
  }
  return out;
}
const SEARCH_CITIES = Array.isArray(allCities) ? allCities : [];
const SEARCH_NORMALIZED_CITIES = SEARCH_CITIES.map(normalize);
const SEARCH_CITY_TOKENS = SEARCH_NORMALIZED_CITIES.map((s) => s.split(' ').filter((t) => t && !SEARCH_STOPWORDS.has(t)));
function searchTokenAlignScore(qTokens, cityTokens) {
  let pos = 0, score = 0, ok = 0;
  for (const qt of qTokens) {
    let found = -1;
    for (let j = pos; j < cityTokens.length; j += 1) {
      if (cityTokens[j].startsWith(qt)) { found = j; break; }
    }
    if (found === -1) { score -= 2.2; continue; }
    ok += 1; score += Math.min(7, qt.length) + (qt.length >= 4 ? 2.2 : 0); score -= (found - pos) * 0.35; pos = found + 1;
  }
  score += ok * 0.9; score -= Math.max(0, cityTokens.length - qTokens.length) * 0.15;
  return { score, ok };
}
const RANK_MEMO = new Map();
const RANK_MEMO_MAX_SIZE = 300;
function saveRankMemo(key, value) {
  if (RANK_MEMO.size >= RANK_MEMO_MAX_SIZE) {
    const oldestKey = RANK_MEMO.keys().next().value;
    RANK_MEMO.delete(oldestKey);
  }
  RANK_MEMO.set(key, value);
}
function rankSuggestions(inputRaw, limit = 3) {
  if (!SEARCH_CITIES.length) return { picks: [], best: null, second: null };
  const safeInput = String(inputRaw || '').slice(0, 120);
  const qNorm = normalizeSearchInput(safeInput);
  const qTokens = searchTokenize(safeInput);
  const memoKey = `${qNorm}\n${limit}`;
  if (RANK_MEMO.has(memoKey)) return RANK_MEMO.get(memoKey);
  const scored = [];
  for (let i = 0; i < SEARCH_CITIES.length; i += 1) {
    const name = SEARCH_CITIES[i], n = SEARCH_NORMALIZED_CITIES[i];
    let score = 0;
    const ta = searchTokenAlignScore(qTokens, SEARCH_CITY_TOKENS[i]);
    score += ta.score;
    if (qTokens.length >= 2) score -= (qTokens.length - ta.ok) * 4.0;
    if (qTokens.length >= 2 && ta.ok === qTokens.length) score += 7.0;
    const d = levenshtein(qNorm, n);
    const distBonus = Math.max(0, 12 - (d * 2.2));
    score += distBonus;
    if (n.startsWith(qNorm) && qNorm.length >= 4) score += 6;
    else if (n.includes(qNorm) && qNorm.length >= 5) score += 2;
    if (qTokens.length >= 2 && ta.ok === 0) score -= 8;
    scored.push({ name, score, d, ok: ta.ok });
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0], second = scored[1];
  const gap = best && second ? (best.score - second.score) : 999;
  const obviousByDist = best && best.d <= 1 && qNorm.length >= 6;
  const fullCover = best && qTokens.length >= 2 && best.ok === qTokens.length;
  const manyTokens = best && best.ok >= 3 && qTokens.length >= 3;
  const obviousByTokens = fullCover || manyTokens;
  const obviousGap = fullCover ? (gap >= 6) : (gap >= 10);
  const single = (obviousByDist || obviousByTokens) && obviousGap;
  const picks = [];
  const seen = new Set();
  for (const it of scored) {
    if (picks.length >= (single ? 1 : limit)) break;
    const k = normalize(it.name);
    if (seen.has(k)) continue;
    seen.add(k);
    picks.push(it.name);
  }
  const out = { picks, best, second };
  saveRankMemo(memoKey, out);
  return out;
}
