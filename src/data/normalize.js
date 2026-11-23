import { DICTIONARY } from './dictionary.js';

// Malá písmena, bez diakritiky, jednoduché mezery.
export function plain(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Hrubý ořez českých koncovek, aby „cibuli“ a „cibule“ vedly na stejný kmen.
const ENDINGS = ['ovymi', 'ami', 'emi', 'ech', 'ich', 'ych', 'ach', 'ove', 'ova', 'ovi', 'ou', 'em', 'um', 'y', 'i', 'e', 'u', 'a', 'o'];
function stemWord(word) {
  for (const end of ENDINGS) {
    if (word.length - end.length >= 3 && word.endsWith(end)) return word.slice(0, -end.length);
  }
  return word;
}

export function normalizeName(text) {
  return plain(text).split(' ').filter(Boolean).map(stemWord).join(' ');
}

// Index: normalizovaný název → sekce (víceslovné fráze i jednotlivá slova).
const PHRASES = new Map();
for (const [sectionId, words] of Object.entries(DICTIONARY)) {
  for (const w of words) {
    const key = normalizeName(w);
    if (!PHRASES.has(key)) PHRASES.set(key, sectionId);
  }
}

/**
 * Najde sekci pro název položky.
 * Pořadí: naučené mapování uživatele → celá fráze ve slovníku → nejdelší podfráze.
 * Vrací null, když položku nezná.
 */
export function classify(name, learned = {}) {
  const key = normalizeName(name);
  if (!key) return null;
  if (learned[key]) return learned[key];
  if (PHRASES.has(key)) return PHRASES.get(key);

  const tokens = key.split(' ');
  for (let len = tokens.length - 1; len >= 1; len--) {
    for (let start = 0; start + len <= tokens.length; start++) {
      const sub = tokens.slice(start, start + len).join(' ');
      if (learned[sub]) return learned[sub];
      if (PHRASES.has(sub)) return PHRASES.get(sub);
    }
  }
  return null;
}

// Rozdělí vložený text na jednotlivé položky a vytáhne množství („2 ks mléka“, „mouka 1kg“).
export function parseBulk(text) {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean)
    .map(parseItem);
}

const UNIT_RE = '(ks|g|kg|ml|l|bal|plech)';
export function parseItem(text) {
  let m = text.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}?\\.?\\s+(.+)$`, 'i'));
  if (m) return { name: m[3].trim(), quantity: num(m[1]), unit: (m[2] || 'ks').toLowerCase() };
  m = text.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}?\\.?$`, 'i'));
  if (m) return { name: m[1].trim(), quantity: num(m[2]), unit: (m[3] || 'ks').toLowerCase() };
  return { name: text.trim(), quantity: null, unit: null };
}

function num(s) {
  return parseFloat(s.replace(',', '.'));
}
