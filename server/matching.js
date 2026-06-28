'use strict';

// Normalize an answer for comparison: lowercase, strip accents, drop
// punctuation, collapse whitespace. Keeps letters/numbers from any language.
function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // non alphanumerics -> space
    .trim()
    .replace(/\s+/g, ' ');
}

// Classic Levenshtein distance (iterative, two-row).
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Allowed typo tolerance scales with answer length.
function toleranceFor(normalizedAnswer) {
  const len = normalizedAnswer.length;
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  if (len <= 12) return 2;
  return 3;
}

// Does `guess` match any of the acceptable `answers`?
// Returns { correct, matched, exact }.
function checkGuess(guess, answers) {
  const ng = normalize(guess);
  if (!ng) return { correct: false };
  for (const ans of answers) {
    const na = normalize(ans);
    if (!na) continue;
    if (ng === na) return { correct: true, matched: ans, exact: true };
  }
  for (const ans of answers) {
    const na = normalize(ans);
    if (!na) continue;
    const dist = levenshtein(ng, na);
    if (dist <= toleranceFor(na)) {
      return { correct: true, matched: ans, exact: false };
    }
  }
  return { correct: false };
}

// "Closeness" of a partial guess to the best answer (0..1), used to show
// live progress feedback while typing (PopSauce-style).
function closeness(guess, answers) {
  const ng = normalize(guess);
  if (!ng) return 0;
  let best = 0;
  for (const ans of answers) {
    const na = normalize(ans);
    if (!na) continue;
    const dist = levenshtein(ng, na);
    const score = 1 - dist / Math.max(na.length, ng.length, 1);
    if (score > best) best = score;
  }
  return Math.max(0, Math.min(1, best));
}

module.exports = { normalize, levenshtein, checkGuess, closeness, toleranceFor };
