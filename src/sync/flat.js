// Převod stavu aplikace na ploché záznamy (klíč → JSON) a zpět.
// Synchronizace porovnává a posílá jednotlivé záznamy, takže když jeden přidá rohlíky
// a druhý současně odškrtne mléko, nepřepíší si změny navzájem.

// Pole, která se synchronizují; každý prvek dostane stabilní pořadí `o`.
const ORDERED = ['lists', 'templates', 'pantry', 'stores', 'sections', 'locations'];

let lastOrder = 0;
const nextOrder = () => (lastOrder = Math.max(lastOrder + 1, Date.now()));

/** Doplní chybějící pořadí `o` (mutuje). Volá se po každé změně stavu. */
export function stampOrder(d) {
  for (const key of ORDERED) {
    for (const x of d[key] || []) {
      if (x.o == null) x.o = nextOrder();
      else if (x.o > lastOrder) lastOrder = x.o;
    }
  }
  for (const l of d.lists || []) for (const i of l.items || []) if (i.o == null) i.o = nextOrder();
  for (const t of d.templates || []) for (const i of t.items || []) if (i.o == null) i.o = nextOrder();
  return d;
}

/** JSON se seřazenými klíči – stejná data dají vždy stejný text. */
export function stableStringify(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort()
    .map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

export function flatten(state) {
  const out = {};
  const put = (k, v) => { out[k] = stableStringify(v); };
  for (const { items, ...l } of state.lists) {
    put('list:' + l.id, l);
    for (const it of items) put('item:' + it.id, { ...it, listId: l.id });
  }
  for (const { items, ...t } of state.templates) {
    put('tpl:' + t.id, t);
    for (const it of items) put('tpli:' + it.id, { ...it, templateId: t.id });
  }
  for (const p of state.pantry) put('pan:' + p.id, p);
  for (const s of state.stores) put('store:' + s.id, s);
  for (const s of state.sections) put('sec:' + s.id, s);
  for (const l of state.locations) put('loc:' + l.id, l);
  for (const [k, v] of Object.entries(state.learned)) put('learn:' + k, { v });
  for (const [k, v] of Object.entries(state.history)) put('hist:' + k, v);
  return out;
}

const byOrder = (a, b) => (a.o ?? 0) - (b.o ?? 0) || String(a.id).localeCompare(String(b.id));

/** Sestaví stav z plochých záznamů; nesdílená pole (např. activeStoreId) vezme z `local`. */
export function unflatten(flat, local) {
  const lists = [], items = [], templates = [], tplItems = [];
  const pantry = [], stores = [], sections = [], locations = [];
  const learned = {}, history = {};
  for (const [key, json] of Object.entries(flat)) {
    const i = key.indexOf(':');
    const type = key.slice(0, i), id = key.slice(i + 1);
    const v = JSON.parse(json);
    switch (type) {
      case 'list': lists.push({ ...v, items: [] }); break;
      case 'item': items.push(v); break;
      case 'tpl': templates.push({ ...v, items: [] }); break;
      case 'tpli': tplItems.push(v); break;
      case 'pan': pantry.push(v); break;
      case 'store': stores.push(v); break;
      case 'sec': sections.push(v); break;
      case 'loc': locations.push(v); break;
      case 'learn': learned[id] = v.v; break;
      case 'hist': history[id] = v; break;
    }
  }
  const listById = Object.fromEntries(lists.map((l) => [l.id, l]));
  for (const { listId, ...it } of items.sort(byOrder)) listById[listId]?.items.push(it);
  const tplById = Object.fromEntries(templates.map((t) => [t.id, t]));
  for (const { templateId, ...it } of tplItems.sort(byOrder)) tplById[templateId]?.items.push(it);

  return {
    ...local,
    lists: lists.sort(byOrder),
    templates: templates.sort(byOrder),
    pantry: pantry.sort(byOrder),
    stores: stores.length ? stores.sort(byOrder) : local.stores,
    sections: sections.length ? sections.sort(byOrder) : local.sections,
    locations: locations.length ? locations.sort(byOrder) : local.locations,
    learned,
    history,
  };
}
