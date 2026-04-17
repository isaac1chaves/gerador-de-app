const normalize = (s) => String(s)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractCity(raw) {
  if (!raw) return '';
  const dashes = ['-', '–', '—'];
  let part = String(raw);
  let lastIdx = -1;
  let dashLen = 0;
  for (const d of dashes) {
    const i = part.lastIndexOf(d);
    if (i > lastIdx) { lastIdx = i; dashLen = d.length; }
  }
  if (lastIdx !== -1) part = part.slice(lastIdx + dashLen);
  const slashIdx = part.indexOf('/');
  if (slashIdx !== -1) part = part.slice(0, slashIdx);
  part = part.replace(/^[^0-9A-Za-zÀ-ÿ]+/g, '').replace(/[^0-9A-Za-zÀ-ÿ\s]+$/g, '').replace(/\s+/g, ' ').trim();
  part = part.replace(/[<>]/g, '');
  return part;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
