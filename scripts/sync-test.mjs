// Simulace dvou telefonů proti serveru se stejnou logikou jako plugin.
// Použití: node scripts/sync-test.mjs
import assert from 'node:assert/strict';
import { flatten, unflatten, stampOrder } from '../src/sync/flat.js';
import { computeBase, diff, merge, sameFlat } from '../src/sync/engine.js';

// ---- server (stejná pravidla jako nakupak_api v PHP) ----
// Revize je společná pro všechny domácnosti, záznamy patří vždy jedné domácnosti.
const server = { table: new Map(), rev: 0, purged: 0 };
function api(since, changes, household = 1) {
  if (changes.length) {
    server.rev++;
    for (const { k, d } of changes) server.table.set(household + '|' + k, { household, k, d, rev: server.rev, deleted: d == null });
  }
  const full = since <= 0 || since < server.purged || since > server.rev;
  const records = [];
  for (const r of server.table.values()) {
    if (r.household !== household) continue;
    if (full ? !r.deleted : r.rev > since) records.push({ k: r.k, d: r.deleted ? null : r.d });
  }
  return structuredClone({ rev: server.rev, full, records });
}
function purgeAll() {
  for (const [k, r] of server.table) if (r.deleted) { server.table.delete(k); server.purged = Math.max(server.purged, r.rev); }
}

// ---- telefon ----
let n = 0;
const id = () => 'id' + ++n;
function phone(name, household = 1) {
  const storeId = id();
  return {
    name, household, rev: 0, base: {},
    state: stampOrder({
      sections: [{ id: 'zelenina', name: 'Zelenina' }, { id: 'mlecne', name: 'Mléčné' }],
      locations: [{ id: 'lednice', name: 'Lednice' }],
      stores: [{ id: storeId, name: 'Obchod ' + name, sectionOrder: ['zelenina', 'mlecne'], hidden: [] }],
      lists: [], templates: [], pantry: [], learned: {}, history: {}, activeStoreId: storeId,
    }),
  };
}
const edit = (p, fn) => { const d = structuredClone(p.state); fn(d); p.state = stampOrder(d); };

/** Jedno kolo synchronizace; `during` simuluje úpravu během čekání na server. */
function sync(p, during) {
  const sent = flatten(p.state);
  const resp = api(p.rev, diff(sent, p.base), p.household);
  if (during) edit(p, during);
  const cur = flatten(p.state);
  const { flat } = merge(sent, cur, p.base, resp);
  p.base = computeBase(p.base, resp);
  p.rev = resp.rev;
  if (!sameFlat(flat, cur)) p.state = stampOrder(unflatten(flat, p.state));
}
function connect(p, mode) {
  const resp = api(0, [], p.household);
  const remote = computeBase({}, resp);
  p.base = remote; p.rev = resp.rev;
  if (mode === 'replace') p.state = stampOrder(unflatten(remote, p.state));
  else { const cur = flatten(p.state); p.state = stampOrder(unflatten(merge(cur, cur, {}, resp).flat, p.state)); }
  sync(p);
}
const settle = (...ps) => { for (let i = 0; i < 3; i++) for (const p of ps) sync(p); };
const shared = (p) => { const f = flatten(p.state); return f; };
const itemsOf = (p, listName) => p.state.lists.find((l) => l.name === listName)?.items.map((i) => i.name + (i.checked ? '✓' : '')) ?? null;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓', name); };

const A = phone('A');
const B = phone('B');
edit(A, (d) => d.lists.push({ id: 'L1', name: 'Nákup', items: [
  { id: 'i1', name: 'Mléko', sectionId: 'mlecne', checked: false },
  { id: 'i2', name: 'Cibule', sectionId: 'zelenina', checked: false },
] }));
edit(A, (d) => d.pantry.push({ id: 'p1', name: 'Vejce', quantity: 6, unit: 'ks', locationId: 'lednice' }));
edit(B, (d) => d.lists.push({ id: 'LB', name: 'Seznam B', items: [] }));

test('první telefon nahraje data na prázdný server', () => {
  connect(A, 'merge');
  assert.equal([...server.table.values()].filter((r) => !r.deleted).length, Object.keys(flatten(A.state)).length);
});

test('druhý telefon s volbou „jen sdílená data“ má totéž co první', () => {
  connect(B, 'replace');
  assert.deepEqual(shared(B), shared(A));
  assert.equal(itemsOf(B, 'Seznam B'), null, 'lokální seznam B se zahodil');
  assert.ok(B.state.stores.some((s) => s.id === A.state.stores[0].id));
});

test('současné změny různých položek se neztratí', () => {
  edit(A, (d) => d.lists[0].items.push({ id: 'i3', name: 'Rohlíky', sectionId: 'pecivo', checked: false }));
  edit(B, (d) => { d.lists[0].items.find((i) => i.id === 'i1').checked = true; });
  sync(A); sync(B); settle(A, B);
  assert.deepEqual(itemsOf(A, 'Nákup'), ['Mléko✓', 'Cibule', 'Rohlíky']);
  assert.deepEqual(shared(A), shared(B));
});

test('pořadí položek zůstává stejné na obou telefonech', () => {
  assert.deepEqual(A.state.lists[0].items.map((i) => i.id), B.state.lists[0].items.map((i) => i.id));
});

test('smazání se propíše', () => {
  edit(B, (d) => { d.pantry = []; });
  settle(B, A);
  assert.equal(A.state.pantry.length, 0);
});

test('úprava během čekání na server se nepřepíše', () => {
  edit(B, (d) => { d.lists[0].items.find((i) => i.id === 'i2').note = 'od B'; });
  sync(B);
  // A posílá a mezitím uživatel změní stejnou položku
  sync(A, (d) => { d.lists[0].items.find((i) => i.id === 'i2').note = 'od A'; });
  assert.equal(A.state.lists[0].items.find((i) => i.id === 'i2').note, 'od A', 'lokální úprava zůstala');
  settle(A, B);
  assert.equal(B.state.lists[0].items.find((i) => i.id === 'i2').note, 'od A', 'a poslední změna vyhrála i u B');
  assert.deepEqual(shared(A), shared(B));
});

test('stejná položka upravená na obou: vyhraje pozdější zápis, telefony se shodnou', () => {
  edit(A, (d) => { d.lists[0].items[0].quantity = 2; });
  edit(B, (d) => { d.lists[0].items[0].quantity = 5; });
  sync(A); sync(B); settle(A, B);
  assert.equal(A.state.lists[0].items[0].quantity, 5);
  assert.deepEqual(shared(A), shared(B));
});

test('smazaný seznam s položkou upravenou na druhém telefonu zmizí na obou', () => {
  edit(A, (d) => d.lists.push({ id: 'L2', name: 'Grilovačka', items: [{ id: 'g1', name: 'Klobásy', checked: false }] }));
  settle(A, B);
  edit(A, (d) => { d.lists = d.lists.filter((l) => l.id !== 'L2'); });
  edit(B, (d) => { d.lists.find((l) => l.id === 'L2').items[0].checked = true; });
  sync(A); sync(B); settle(A, B);
  assert.equal(itemsOf(A, 'Grilovačka'), null);
  assert.equal(itemsOf(B, 'Grilovačka'), null);
  assert.deepEqual(shared(A), shared(B));
});

test('telefon offline po úklidu smazaných záznamů dostane úplný stav', () => {
  edit(A, (d) => d.pantry.push({ id: 'p2', name: 'Máslo', quantity: 1 }, { id: 'p3', name: 'Sýr', quantity: 1 }));
  settle(A, B);
  edit(A, (d) => { d.pantry = d.pantry.filter((p) => p.id !== 'p2'); });
  sync(A);
  purgeAll(); // záznam o smazání p2 zmizel dřív, než si ho B stáhl
  edit(B, (d) => d.pantry.push({ id: 'p4', name: 'Jogurt', quantity: 4 })); // B má offline novou věc
  settle(B, A);
  assert.deepEqual(B.state.pantry.map((p) => p.name).sort(), ['Jogurt', 'Sýr']);
  assert.deepEqual(shared(A), shared(B));
});

test('spojení dat: druhý telefon přidá svá data ke sdíleným', () => {
  const C = phone('C');
  edit(C, (d) => d.lists.push({ id: 'LC', name: 'Drogerie', items: [{ id: 'c1', name: 'Šampon', checked: false }] }));
  connect(C, 'merge');
  settle(C, A, B);
  assert.deepEqual(itemsOf(A, 'Drogerie'), ['Šampon']);
  assert.deepEqual(shared(A), shared(C));
});

test('kolo bez změn nic neposílá a nemění stav', () => {
  const before = server.rev;
  const snap = shared(A);
  sync(A); sync(B);
  assert.equal(server.rev, before);
  assert.deepEqual(shared(A), snap);
});

test('druhá domácnost má vlastní data a nevidí data první', () => {
  const E = phone('E', 2);
  edit(E, (d) => d.lists.push({ id: 'LE', name: 'Ondřejův nákup', items: [{ id: 'e1', name: 'Pivo', checked: false }] }));
  connect(E, 'merge');
  edit(A, (d) => d.lists[0].items.push({ id: 'a9', name: 'Chléb', sectionId: 'pecivo', checked: false }));
  settle(A, B, E);
  assert.equal(itemsOf(E, 'Nákup'), null, 'E nevidí seznam domácnosti 1');
  assert.deepEqual(itemsOf(E, 'Ondřejův nákup'), ['Pivo']);
  assert.equal(itemsOf(A, 'Ondřejův nákup'), null, 'A nevidí seznam domácnosti 2');
  assert.ok(itemsOf(B, 'Nákup').includes('Chléb'));
  // Stejné klíče (výchozí sekce) existují v obou domácnostech nezávisle.
  edit(E, (d) => { d.sections[0].name = 'Zelenina Ondřej'; });
  settle(E, A);
  assert.equal(A.state.sections[0].name, 'Zelenina');
  assert.equal(E.state.sections[0].name, 'Zelenina Ondřej');
});

console.log(`\n${passed} testů prošlo`);
