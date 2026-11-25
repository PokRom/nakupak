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
  return classifyKey(normalizeName(name), learned)
    // Anglický plurál, který slovník nezná („tomatoes“, „cherries“): zkusíme jednotné číslo.
    ?? classifyKey(normalizeName(singular(name)), learned);
}

function classifyKey(key, learned) {
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

// Hrubé anglické jednotné číslo: berries → berry, tomatoes → tomato, apples → apple.
function singular(text) {
  return plain(text).split(' ').map((w) => {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(oes|ches|shes|xes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }).join(' ');
}

// Rozdělí vložený text na jednotlivé položky a vytáhne množství („2 ks mléka“, „mouka 1kg“).
export function parseBulk(text) {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean)
    .map(parseItem);
}

// Jednotky se ukládají česky; anglické zkratky se převedou (pcs → ks, pack → bal).
const UNIT_RE = '(ks|kg|g|ml|l|bal|plech|pcs|pc|packs|pack)';
const UNIT_ALIAS = { pcs: 'ks', pc: 'ks', packs: 'bal', pack: 'bal' };
const unit = (u) => { const x = (u || 'ks').toLowerCase(); return UNIT_ALIAS[x] || x; };

export function parseItem(text) {
  let m = text.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}?\\.?\\s+(.+)$`, 'i'));
  if (m) return { name: m[3].trim(), quantity: num(m[1]), unit: unit(m[2]) };
  m = text.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${UNIT_RE}?\\.?$`, 'i'));
  if (m) return { name: m[1].trim(), quantity: num(m[2]), unit: unit(m[3]) };
  return { name: text.trim(), quantity: null, unit: null };
}

function num(s) {
  return parseFloat(s.replace(',', '.'));
}
