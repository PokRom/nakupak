// Synchronizace s WordPress pluginem přes společný kód domácnosti.
//
// Protokol: POST ./api { since, changes: [{k, d}] } → { rev, full, records: [{k, d}] }
//  - `d` je JSON záznamu, null = smazáno.
//  - Server každé dávce změn přidělí nové číslo revize; vyhrává poslední zapsaná změna záznamu.
//  - `full` = server posílá všechny živé záznamy (první připojení nebo po úklidu starých smazaných).
//
// `base` je to, co podle nás leží na serveru. Rozdíl mezi aktuálním stavem a `base`
// jsou lokální změny, které je potřeba odeslat.

import { flatten, unflatten } from './flat.js';

const META_KEY = 'nakupak-sync-v1';
export const API_URL = () => new URL('api', location.href).toString();

export function normalizeCode(code) {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatCode(code) {
  return normalizeCode(code).replace(/(.{4})(?=.)/g, '$1-');
}

export function loadMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY));
    if (m && m.code) return m;
  } catch {}
  return null;
}

export function saveMeta(meta) {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {}
}

export class SyncError extends Error {
  constructor(kind, message) {
    super(message || kind);
    this.kind = kind; // 'badcode' | 'offline' | 'server'
  }
}

export async function callApi(code, since, changes) {
  let res;
  try {
    res = await fetch(API_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nakupak-Code': normalizeCode(code) },
      // Kód i v těle – některé hostingy vlastní hlavičky zahazují.
      body: JSON.stringify({ since, changes, code: normalizeCode(code) }),
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    throw new SyncError('offline');
  }
  if (res.status === 401) throw new SyncError('badcode');
  if (res.status === 429) throw new SyncError('server', 'Příliš mnoho pokusů, zkus to za chvíli.');
  if (!res.ok) throw new SyncError('server', `Server odpověděl ${res.status}`);
  try {
    const data = await res.json();
    if (typeof data.rev !== 'number' || !Array.isArray(data.records)) throw new Error();
    return data;
  } catch {
    throw new SyncError('server', 'Neplatná odpověď serveru – je plugin aktuální?');
  }
}

/** Lokální změny oproti `base` ve formátu pro server. */
export function diff(flat, base) {
  const changes = [];
  for (const [k, d] of Object.entries(flat)) if (base[k] !== d) changes.push({ k, d });
  for (const k of Object.keys(base)) if (!(k in flat)) changes.push({ k, d: null });
  return changes;
}

/** Co je po odpovědi serveru na serveru. Nezávisí na lokálním stavu. */
export function computeBase(oldBase, response) {
  const base = response.full ? {} : { ...oldBase };
  for (const { k, d } of response.records) {
    if (d == null) delete base[k];
    else base[k] = d;
  }
  return base;
}

/**
 * Spojí odpověď serveru s lokálním stavem.
 * @param sent     ploché záznamy v okamžiku odeslání
 * @param current  ploché záznamy teď (uživatel mohl mezitím něco změnit)
 * @param oldBase  base před odesláním
 * @returns {{ flat, base }} nový plochý stav a nový base
 */
export function merge(sent, current, oldBase, response) {
  const base = computeBase(oldBase, response);

  const flat = { ...current };
  // Záznamy změněné během čekání na odpověď necháme – odešlou se v dalším kole.
  const editedMeanwhile = (k) => current[k] !== sent[k];

  for (const { k, d } of response.records) {
    if (editedMeanwhile(k)) continue;
    if (d == null) delete flat[k];
    else flat[k] = d;
  }

  if (response.full) {
    // Co bylo dřív na serveru, lokálně se nezměnilo a na serveru už není → někdo to smazal.
    for (const k of Object.keys(flat)) {
      if (!(k in base) && k in oldBase && flat[k] === oldBase[k] && !editedMeanwhile(k)) delete flat[k];
    }
  }
  return { flat, base };
}

export function sameFlat(a, b) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

export { flatten, unflatten };
