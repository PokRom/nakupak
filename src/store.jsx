import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { DEFAULT_SECTIONS, DEFAULT_LOCATIONS } from './data/sections.js';
import { classify, normalizeName } from './data/normalize.js';
import { stampOrder } from './sync/flat.js';
import { t, getLang, locale, secName, unitLabel } from './i18n.jsx';
import { callApi, computeBase, diff, flatten, loadMeta, merge, normalizeCode, sameFlat, saveMeta, unflatten } from './sync/engine.js';

const STORAGE_KEY = 'nakupak-state-v1';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Výchozí data při prvním spuštění jsou v jazyce telefonu.
function initialState() {
  const storeId = uid();
  return {
    sections: DEFAULT_SECTIONS,
    locations: DEFAULT_LOCATIONS,
    stores: [{ id: storeId, name: t('Můj obchod'), sectionOrder: DEFAULT_SECTIONS.map((s) => s.id), hidden: [] }],
    lists: [{ id: uid(), name: t('Nákup'), storeId, createdAt: Date.now(), items: [] }],
    templates: [
      {
        id: uid(), name: t('Snídaně'), emoji: '🍳', servings: null, defaultStoreId: null,
        items: [
          { id: uid(), name: t('Rohlíky'), quantity: 6, unit: 'ks', sectionId: 'pecivo', note: '' },
          { id: uid(), name: t('Máslo'), quantity: 1, unit: 'ks', sectionId: 'mlecne', note: '' },
          { id: uid(), name: t('Šunka'), quantity: 150, unit: 'g', sectionId: 'maso', note: '' },
          { id: uid(), name: t('Vejce'), quantity: 10, unit: 'ks', sectionId: 'mlecne', note: '' },
          { id: uid(), name: t('Mléko'), quantity: 1, unit: 'l', sectionId: 'mlecne', note: '' },
        ],
      },
    ],
    pantry: [],
    learned: {},
    history: {},
    activeStoreId: storeId,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return stampOrder({ ...initialState(), ...JSON.parse(raw) });
  } catch {}
  return stampOrder(initialState());
}

const Ctx = createContext(null);
const SYNC_INTERVAL = 5000;
const SYNC_DEBOUNCE = 700;

export function StoreProvider({ children }) {
  const [state, setRawState] = useState(load);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  // Změny stavu píšeme „mutačně“ nad hlubokou kopií – data jsou malá.
  const mutate = useCallback((fn) => {
    setRawState((s) => {
      const d = structuredClone(s);
      fn(d);
      return stampOrder(d);
    });
  }, []);

  const setState = useCallback((next) => {
    setRawState((s) => stampOrder(typeof next === 'function' ? next(s) : next));
  }, []);

  const sync = useSync(stateRef, setRawState, state);

  return <Ctx.Provider value={{ state, mutate, setState, sync }}>{children}</Ctx.Provider>;
}

/** Sdílení s domácností přes WordPress plugin. */
function useSync(stateRef, setRawState, state) {
  const metaRef = useRef(loadMeta());
  const running = useRef(false);
  const again = useRef(false);
  const [info, setInfo] = useState(() => ({
    connected: !!metaRef.current,
    code: metaRef.current?.code || null,
    status: metaRef.current ? 'idle' : 'off',
    lastSync: metaRef.current?.lastSync || null,
    error: null,
  }));
  const patchInfo = (p) => setInfo((i) => (Object.keys(p).every((k) => i[k] === p[k]) ? i : { ...i, ...p }));

  const applyResponse = (sent, oldBase, resp) => {
    setRawState((s) => {
      const cur = flatten(s);
      const { flat } = merge(sent, cur, oldBase, resp);
      return sameFlat(flat, cur) ? s : stampOrder(unflatten(flat, s));
    });
  };

  const runSync = useCallback(async () => {
    const meta = metaRef.current;
    if (!meta) return;
    if (running.current) { again.current = true; return; }
    running.current = true;
    try {
      const sent = flatten(stateRef.current);
      const changes = diff(sent, meta.base);
      const resp = await callApi(meta.code, meta.rev, changes);
      if (metaRef.current !== meta) return; // mezitím odpojeno
      metaRef.current = { ...meta, rev: resp.rev, base: computeBase(meta.base, resp), lastSync: Date.now() };
      saveMeta(metaRef.current);
      applyResponse(sent, meta.base, resp);
      patchInfo({ status: 'ok', error: null, lastSync: metaRef.current.lastSync });
    } catch (e) {
      patchInfo({ status: e.kind || 'server', error: e.message });
    } finally {
      running.current = false;
      if (again.current) { again.current = false; setTimeout(runSync, 100); }
    }
  }, []);

  // Po každé lokální změně odeslat (s malým zpožděním, ať se změny sloučí).
  useEffect(() => {
    if (!metaRef.current) return;
    const t = setTimeout(runSync, SYNC_DEBOUNCE);
    return () => clearTimeout(t);
  }, [state, runSync]);

  // Pravidelně stahovat změny od druhého telefonu, když je aplikace na obrazovce.
  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && runSync();
    const id = setInterval(tick, SYNC_INTERVAL);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
    };
  }, [runSync]);

  /** Ověří kód a vrátí, kolik záznamů je na serveru (bez změny dat). */
  const probe = useCallback(async (code) => {
    const resp = await callApi(code, 0, []);
    return { resp, remoteCount: resp.records.length };
  }, []);

  /**
   * Dokončí připojení.
   * mode 'merge'   – sdílená data + data z tohoto telefonu
   * mode 'replace' – jen sdílená data, data v telefonu se zahodí
   */
  const connect = useCallback((code, resp, mode) => {
    const remote = computeBase({}, resp);
    metaRef.current = { code: normalizeCode(code), rev: resp.rev, base: remote, lastSync: Date.now() };
    saveMeta(metaRef.current);
    setRawState((s) => {
      if (mode === 'replace') {
        const fresh = unflatten(remote, s);
        if (!fresh.stores.some((x) => x.id === fresh.activeStoreId)) fresh.activeStoreId = fresh.stores[0]?.id;
        return stampOrder(fresh);
      }
      const cur = flatten(s);
      return stampOrder(unflatten(merge(cur, cur, {}, resp).flat, s));
    });
    patchInfo({ connected: true, code: metaRef.current.code, status: 'idle', error: null, lastSync: Date.now() });
    setTimeout(runSync, 300);
  }, [runSync]);

  const disconnect = useCallback(() => {
    metaRef.current = null;
    saveMeta(null);
    patchInfo({ connected: false, code: null, status: 'off', error: null, lastSync: null });
  }, []);

  return { ...info, syncNow: runSync, probe, connect, disconnect };
}

export function useStore() {
  return useContext(Ctx);
}

// ---------- Pomocné funkce nad stavem ----------

export function sectionFor(state, name) {
  return classify(name, state.learned);
}

export function learn(d, name, sectionId) {
  d.learned[normalizeName(name)] = sectionId;
}

export function remember(d, name, sectionId) {
  const key = normalizeName(name);
  const h = d.history[key] || { name, count: 0 };
  h.count += 1;
  h.sectionId = sectionId;
  h.name = name;
  d.history[key] = h;
}

/** Přidá položku do seznamu; stejnou nevyřízenou položku sloučí (sečte množství). */
export function addItemToList(d, listId, item) {
  const list = d.lists.find((l) => l.id === listId);
  if (!list) return;
  const key = normalizeName(item.name);
  const same = list.items.find((i) => !i.checked && normalizeName(i.name) === key && (i.unit || null) === (item.unit || null));
  if (same) {
    if (same.quantity != null || item.quantity != null) same.quantity = (same.quantity || 1) + (item.quantity || 1);
    return;
  }
  list.items.push({ id: uid(), checked: false, note: '', quantity: null, unit: null, ...item });
  remember(d, item.name, item.sectionId);
}

/** Najde zásobu doma odpovídající názvu položky. */
export function findInPantry(state, name) {
  const key = normalizeName(name);
  if (!key) return null;
  return state.pantry.find((p) => {
    const pk = normalizeName(p.name);
    return pk === key || pk.split(' ').includes(key) || key.split(' ').includes(pk);
  }) || null;
}

/** Sekce seřazené podle obchodu, bez skrytých. */
export function orderedSections(state, storeId) {
  const store = state.stores.find((s) => s.id === storeId) || state.stores[0];
  const byId = Object.fromEntries(state.sections.map((s) => [s.id, s]));
  const order = store ? store.sectionOrder.filter((id) => byId[id]) : state.sections.map((s) => s.id);
  // Sekce přidané později, které obchod ještě nezná, dáme před „Pokladnu“.
  for (const s of state.sections) {
    if (order.includes(s.id)) continue;
    const pos = order.indexOf('pokladna');
    if (pos < 0) order.push(s.id); else order.splice(pos, 0, s.id);
  }
  const hidden = new Set(store?.hidden || []);
  return order.filter((id) => !hidden.has(id)).map((id) => ({ ...byId[id], name: secName(byId[id]) }));
}

/** Položky seskupené do sekcí v pořadí obchodu. Položky ze skryté sekce spadnou do „Ostatní“. */
export function groupBySection(state, storeId, items) {
  const sections = orderedSections(state, storeId);
  const visible = new Set(sections.map((s) => s.id));
  const groups = sections.map((s) => ({ section: s, items: [] }));
  const idx = Object.fromEntries(groups.map((g, i) => [g.section.id, i]));
  for (const it of items) {
    let sid = visible.has(it.sectionId) ? it.sectionId : 'ostatni';
    if (idx[sid] == null) sid = groups[groups.length - 1]?.section.id;
    groups[idx[sid]]?.items.push(it);
  }
  return groups.filter((g) => g.items.length);
}

export function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(expiresAt); exp.setHours(0, 0, 0, 0);
  return Math.round((exp - today) / 86400000);
}

export function fmtQty(q, u) {
  if (q == null || q === '') return '';
  const n = Math.round(q * 100) / 100;
  const num = getLang() === 'en' ? String(n) : String(n).replace('.', ',');
  return `${num} ${unitLabel(u || 'ks')}`;
}

export function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'numeric' });
}

/** Když zásoba klesne pod minimum, doplní ji na seznam „Doplnit zásoby“ (nebo první seznam). */
export function checkMinimum(d, pantryItem) {
  if (pantryItem.minQuantity == null || (pantryItem.quantity ?? 0) >= pantryItem.minQuantity) return false;
  let list = d.lists[0];
  if (!list) {
    list = { id: uid(), name: t('Doplnit zásoby'), storeId: d.activeStoreId, createdAt: Date.now(), items: [] };
    d.lists.push(list);
  }
  const already = list.items.some((i) => !i.checked && normalizeName(i.name) === normalizeName(pantryItem.name));
  if (already) return false;
  addItemToList(d, list.id, {
    name: pantryItem.name,
    quantity: pantryItem.minQuantity - (pantryItem.quantity ?? 0),
    unit: pantryItem.unit,
    sectionId: pantryItem.sectionId || classify(pantryItem.name, d.learned) || 'ostatni',
    note: t('pod minimem v zásobách'),
  });
  return list.name;
}
