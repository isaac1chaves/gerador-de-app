// Formata somente o município detectado, preservando texto e cursor.
function getEditorSelection() {
  if (!q || !q.isContentEditable) return { start: 0, end: 0 };
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !q.contains(selection.anchorNode)) {
    const end = (q.textContent || '').length;
    return { start: end, end };
  }
  const range = selection.getRangeAt(0);
  const a = range.cloneRange();
  a.selectNodeContents(q);
  a.setEnd(range.startContainer, range.startOffset);
  const b = range.cloneRange();
  b.selectNodeContents(q);
  b.setEnd(range.endContainer, range.endOffset);
  return { start: a.toString().length, end: b.toString().length };
}
function setEditorSelection(start, end = start) {
  if (!q || !q.isContentEditable) return;
  const walker = document.createTreeWalker(q, NodeFilter.SHOW_TEXT);
  let node, total = 0, startNode = null, endNode = null, startOffset = 0, endOffset = 0;
  while ((node = walker.nextNode())) {
    const next = total + node.nodeValue.length;
    if (!startNode && start >= total && start <= next) { startNode = node; startOffset = start - total; }
    if (!endNode && end >= total && end <= next) { endNode = node; endOffset = end - total; }
    total = next;
  }
  if (!startNode || !endNode) return;
  const range = document.createRange();
  const selection = window.getSelection();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(range);
}
function clearHighlights(preserveSelection = true) {
  if (!q || !q.isContentEditable || !q.querySelector('.detected-city')) return;
  const selection = preserveSelection ? getEditorSelection() : null;
  const text = q.textContent || '';
  q.textContent = text;
  if (selection) setEditorSelection(selection.start, selection.end);
}
function normalizeWithMap(value) {
  let text = '';
  const map = [];
  Array.from(String(value || '')).forEach((char, index) => {
    const piece = char.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const normalizedChar of piece) { text += normalizedChar; map.push(index); }
  });
  return { text, map };
}
function findOriginalRange(raw, fragment) {
  const source = normalizeWithMap(raw);
  const target = normalize(fragment);
  if (!target || target.length < 2) return null;
  const at = source.text.lastIndexOf(target);
  if (at < 0) return null;
  const start = source.map[at];
  const last = source.map[at + target.length - 1];
  return Number.isInteger(start) && Number.isInteger(last) ? { start, end: last + 1 } : null;
}
function highlightCityByKey(rawText, cityFragment) {
  if (!q || !q.isContentEditable) return false;
  const raw = String(rawText || '');
  const found = findOriginalRange(raw, cityFragment);
  if (!found || found.start === 0 && found.end === raw.length) {
    clearHighlights();
    return false;
  }
  const selection = getEditorSelection();
  q.innerHTML = `${escapeHtml(raw.slice(0, found.start))}<strong class="detected-city">${escapeHtml(raw.slice(found.start, found.end))}</strong>${escapeHtml(raw.slice(found.end))}`;
  setEditorSelection(selection.start, selection.end);
  return true;
}
if (q && q.isContentEditable) {
  q.addEventListener('beforeinput', () => clearHighlights(true));
  q.addEventListener('paste', (event) => {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text);
  });
}
