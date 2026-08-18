const SUGGEST_CATEGORIES = new Set(['ok', 'ana', 'bra', 'nao']);
const ALLOWED_RESIZE_EDGES = new Set(['bottom-left']);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isAllowedResizeEdge(edge) {
  return ALLOWED_RESIZE_EDGES.has(edge);
}

function sanitizeSuggestPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const suggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions
      .slice(0, 5)
      .map((item) => ({
        text: String(item?.text || '').slice(0, 100),
        category: SUGGEST_CATEGORIES.has(item?.category) ? item.category : 'nao',
        action: item?.action === 'undo' ? 'undo' : undefined
      }))
      .filter((item) => item.text)
    : [];

  return {
    mode: payload.mode === 'undo' ? 'undo' : undefined,
    title: String(payload.title || '').slice(0, 120),
    subtitle: String(payload.subtitle || '').slice(0, 300),
    suggestions
  };
}

module.exports = { finiteNumber, isAllowedResizeEdge, sanitizeSuggestPayload };
