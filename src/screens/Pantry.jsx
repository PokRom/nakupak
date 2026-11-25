import { useState } from 'react';
import { useStore, uid, daysLeft, fmtQty, fmtDate, checkMinimum, addItemToList, sectionFor } from '../store.jsx';
import { Header, Modal, Empty, QtyInputs, AddItemBar, SectionPicker } from '../components/ui.jsx';
import { SECTION_TO_LOCATION } from '../data/sections.js';

export default function Pantry({ toast }) {
  const { state, mutate } = useStore();
  const [loc, setLoc] = useState('vse');
  const [editing, setEditing] = useState(null);
  const [gone, setGone] = useState(null); // dojedená položka → nabídka na seznam
  const [query, setQuery] = useState('');

  const items = state.pantry
    .filter((p) => loc === 'vse' || p.locationId === loc)
    .filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (daysLeft(a.expiresAt) ?? 9999) - (daysLeft(b.expiresAt) ?? 9999) || a.name.localeCompare(b.name, 'cs'));
  const expiring = state.pantry.filter((p) => { const d = daysLeft(p.expiresAt); return d != null && d <= 2; });

  function add(item) {
    const sectionId = item.sectionId || 'ostatni';
    mutate((d) => d.pantry.push({
      id: uid(), name: item.name, quantity: item.quantity ?? 1, unit: item.unit || 'ks', sectionId,
      locationId: loc !== 'vse' ? loc : SECTION_TO_LOCATION[sectionId] || 'ostatni',
      addedAt: Date.now(), expiresAt: null, minQuantity: null,
    }));
  }

  function change(id, delta) {
    const cur = state.pantry.find((x) => x.id === id);
    if (!cur) return;
    const step = ['g', 'ml'].includes(cur.unit) ? 100 : 1;
    const qty = Math.max(0, Math.round(((cur.quantity ?? 0) + delta * step) * 100) / 100);
    const belowMin = cur.minQuantity != null && qty < cur.minQuantity;
    mutate((d) => {
      const p = d.pantry.find((x) => x.id === id);
      if (!p) return;
      p.quantity = qty;
      checkMinimum(d, p);
      // Položky s hlídaným minimem necháváme i na nule, aby se dál sledovaly.
      if (qty === 0 && p.minQuantity == null) d.pantry = d.pantry.filter((x) => x.id !== id);
    });
    if (belowMin && delta < 0) toast(`${cur.name}: pod minimem – je na seznamu`);
    else if (qty === 0) setGone(cur);
  }

  function addToList(item, listId) {
    mutate((d) => addItemToList(d, listId, { name: item.name, quantity: null, unit: null, sectionId: item.sectionId || sectionFor(d, item.name) || 'ostatni' }));
    toast(`„${item.name}“ přidáno na seznam`);
    setGone(null);
  }

  return (
    <div className="screen">
      <Header title="Zásoby" />
      <div className="content">
        <div className="chips scroll">
          <button className={'chip' + (loc === 'vse' ? ' active' : '')} onClick={() => setLoc('vse')}>Vše · {state.pantry.length}</button>
          {state.locations.map((l) => (
            <button key={l.id} className={'chip' + (loc === l.id ? ' active' : '')} onClick={() => setLoc(l.id)}>
              {l.icon} {l.name} · {state.pantry.filter((p) => p.locationId === l.id).length}
            </button>
          ))}
        </div>

        {expiring.length > 0 && (
          <div className="hint danger">⏰ Brzy projde: {expiring.map((p) => p.name).join(', ')}</div>
        )}

        <AddItemBar onAdd={add} placeholder="Přidat do zásob… (např. 6 ks vejce)" showPantryHint={false} />
        {state.pantry.length > 5 && <input className="input search" placeholder="🔍 Hledat v zásobách" value={query} onChange={(e) => setQuery(e.target.value)} />}

        {items.length === 0 && <Empty icon="🏠">Tady uvidíš, co máš doma. Po nákupu můžeš koupené věci uložit jedním klepnutím.</Empty>}

        {items.map((p) => {
          const dl = daysLeft(p.expiresAt);
          const cls = dl == null ? '' : dl < 0 ? ' expired' : dl <= 2 ? ' soon' : '';
          const location = state.locations.find((l) => l.id === p.locationId);
          const low = p.minQuantity != null && p.quantity < p.minQuantity;
          return (
            <div key={p.id} className={'pantry-item' + cls}>
              <button className="pantry-main" onClick={() => setEditing(p)}>
                <div className="item-name">{p.name}</div>
                <div className="muted small">
                  {[
                    loc === 'vse' && location && `${location.icon} ${location.name}`,
                    dl != null && (dl < 0 ? `prošlo ${fmtDate(p.expiresAt)}` : dl === 0 ? 'projde dnes' : `do ${fmtDate(p.expiresAt)} (${dl} d)`),
                  ].filter(Boolean).join(' · ')}
                  {low && <span className="low">{loc === 'vse' || dl != null ? ' · ' : ''}pod minimem</span>}
                </div>
              </button>
              <div className="stepper">
                <button onClick={() => change(p.id, -1)} aria-label="Ubrat">−</button>
                <span>{fmtQty(p.quantity, p.unit)}</span>
                <button onClick={() => change(p.id, +1)} aria-label="Přidat">＋</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && <PantryEditor item={editing} onClose={() => setEditing(null)} onConsumed={(p) => { setEditing(null); setGone(p); }} />}

      {gone && (
        <Modal title={`${gone.name} došlo`} onClose={() => setGone(null)}>
          <p>Přidat na nákupní seznam?</p>
          <div className="menu">
            {state.lists.map((l) => <button key={l.id} onClick={() => addToList(gone, l.id)}>📝 {l.name}</button>)}
            {state.lists.length === 0 && <p className="muted">Nemáš žádný seznam.</p>}
            <button onClick={() => setGone(null)}>Ne, díky</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PantryEditor({ item, onClose, onConsumed }) {
  const { state, mutate } = useStore();
  const [d, setD] = useState({ ...item, expiresAt: item.expiresAt || '' });
  const set = (patch) => setD((x) => ({ ...x, ...patch }));

  function save() {
    mutate((s) => {
      const i = s.pantry.findIndex((p) => p.id === item.id);
      s.pantry[i] = { ...d, name: d.name.trim() || item.name, expiresAt: d.expiresAt || null };
      checkMinimum(s, s.pantry[i]);
    });
    onClose();
  }
  function remove(reason) {
    mutate((s) => { s.pantry = s.pantry.filter((p) => p.id !== item.id); });
    if (reason === 'eaten') onConsumed(item); else onClose();
  }

  return (
    <Modal title="Zásoba" onClose={onClose} footer={
      <>
        <button className="btn" onClick={() => remove('eaten')}>✅ Dojedeno</button>
        <button className="btn danger" onClick={() => remove('trash')}>🗑️ Vyhozeno</button>
        <button className="btn primary" onClick={save}>Uložit</button>
      </>
    }>
      <label className="field">Název<input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} /></label>
      <label className="field">Množství<QtyInputs quantity={d.quantity} unit={d.unit} onChange={set} /></label>
      <label className="field">Uloženo v
        <select className="input" value={d.locationId} onChange={(e) => set({ locationId: e.target.value })}>
          {state.locations.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
        </select>
      </label>
      <label className="field">Spotřebujte do<input className="input" type="date" value={d.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} /></label>
      <label className="field">Minimální zásoba <span className="muted small">(při poklesu se doplní na seznam)</span>
        <input className="input" type="number" inputMode="decimal" min="0" placeholder="bez minima" value={d.minQuantity ?? ''}
          onChange={(e) => set({ minQuantity: e.target.value === '' ? null : parseFloat(e.target.value) })} />
      </label>
      <details className="field">
        <summary>Sekce v obchodě</summary>
        <SectionPicker value={d.sectionId} onPick={(sectionId) => set({ sectionId })} />
      </details>
    </Modal>
  );
}
