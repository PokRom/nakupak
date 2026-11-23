import { useState } from 'react';
import { useStore, uid, sectionFor, fmtQty, learn } from '../store.jsx';
import { Header, Modal, Empty, AddItemBar, ItemEditor, SectionPicker } from '../components/ui.jsx';
import { parseBulk } from '../data/normalize.js';
import ApplyTemplate from './ApplyTemplate.jsx';

export default function Templates({ openList }) {
  const { state, mutate } = useStore();
  const [editId, setEditId] = useState(null);
  const [applying, setApplying] = useState(null);

  function create() {
    const id = uid();
    mutate((d) => d.templates.push({ id, name: 'Nový profil', emoji: '🧺', servings: null, defaultStoreId: null, items: [] }));
    setEditId(id);
  }

  if (editId) return <TemplateEditor id={editId} onBack={() => setEditId(null)} />;

  return (
    <div className="screen">
      <Header title="Profily" right={<button className="btn small primary" onClick={create}>＋ Nový</button>} />
      <div className="content">
        <p className="muted">Předpřipravené seznamy, které stačí jedním klepnutím vložit do nákupu. To, co máš doma v lednici, se automaticky odškrtne.</p>
        {state.templates.length === 0 && <Empty icon="🧺">Žádné profily. Vytvoř nový, nebo ulož existující seznam přes ⋯ → Uložit jako profil.</Empty>}
        {state.templates.map((t) => (
          <div key={t.id} className="card tpl-card">
            <button className="tpl-main" onClick={() => setEditId(t.id)}>
              <span className="tpl-emoji">{t.emoji}</span>
              <div>
                <div className="card-title">{t.name}</div>
                <div className="muted small">{t.items.length} položek{t.servings ? ` · ${t.servings} porce` : ''}</div>
              </div>
            </button>
            <button className="btn primary small" disabled={!t.items.length} onClick={() => setApplying(t)}>Použít</button>
          </div>
        ))}
      </div>
      {applying && <ApplyTemplate template={applying} onClose={() => setApplying(null)} onDone={(listId) => { setApplying(null); openList(listId); }} />}
    </div>
  );
}

function TemplateEditor({ id, onBack }) {
  const { state, mutate } = useStore();
  const t = state.templates.find((x) => x.id === id);
  const [editing, setEditing] = useState(null);
  const [asking, setAsking] = useState(null);
  if (!t) return null;

  const upd = (fn) => mutate((d) => fn(d.templates.find((x) => x.id === id), d));
  const sections = Object.fromEntries(state.sections.map((s) => [s.id, s]));

  function add(item) {
    if (!item.sectionId) { setAsking(item); return; }
    upd((tt) => tt.items.push({ id: uid(), note: '', ...item }));
  }

  return (
    <div className="screen">
      <Header title="Upravit profil" onBack={onBack} />
      <div className="content">
        <div className="row gap">
          <input className="input emoji-input" value={t.emoji} maxLength={4} onChange={(e) => upd((tt) => { tt.emoji = e.target.value; })} />
          <input className="input" value={t.name} onChange={(e) => upd((tt) => { tt.name = e.target.value; })} />
        </div>
        <div className="row gap wrap">
          <label className="field compact">Výchozí obchod
            <select className="input" value={t.defaultStoreId || ''} onChange={(e) => upd((tt) => { tt.defaultStoreId = e.target.value || null; })}>
              <option value="">— podle seznamu —</option>
              {state.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field compact">Recept pro porcí
            <input className="input qty" type="number" min="1" placeholder="—" value={t.servings ?? ''}
              onChange={(e) => upd((tt) => { tt.servings = e.target.value ? parseInt(e.target.value, 10) : null; })} />
          </label>
        </div>

        <AddItemBar onAdd={add} showPantryHint={false}
          onBulk={(text) => upd((tt, d) => { for (const p of parseBulk(text)) tt.items.push({ id: uid(), note: '', ...p, sectionId: sectionFor(d, p.name) || 'ostatni' }); })} />

        {t.items.length === 0 && <Empty icon="➕">Přidej položky, které v tomhle nákupu kupuješ vždycky.</Empty>}
        {t.items.map((it) => (
          <button key={it.id} className="item" onClick={() => setEditing(it)}>
            <span>{sections[it.sectionId]?.icon || '📦'}</span>
            <span className="item-name">{it.name}{it.note && <span className="muted"> · {it.note}</span>}</span>
            <span className="item-qty">{fmtQty(it.quantity, it.unit)}</span>
          </button>
        ))}

        <div className="row gap">
          <button className="btn ghost" onClick={() => mutate((d) => {
            const copy = structuredClone(t);
            copy.id = uid(); copy.name = t.name + ' (kopie)';
            copy.items.forEach((i) => { i.id = uid(); });
            d.templates.push(copy);
          })}>📄 Duplikovat</button>
          <button className="btn ghost danger-text" onClick={() => {
            if (!confirm(`Smazat profil „${t.name}“?`)) return;
            mutate((d) => { d.templates = d.templates.filter((x) => x.id !== id); });
            onBack();
          }}>🗑️ Smazat profil</button>
        </div>
      </div>

      {editing && (
        <ItemEditor item={editing} onClose={() => setEditing(null)}
          onSave={(u) => { upd((tt, d) => { const i = tt.items.findIndex((x) => x.id === u.id); if (tt.items[i].sectionId !== u.sectionId) learn(d, u.name, u.sectionId); tt.items[i] = u; }); setEditing(null); }}
          onDelete={() => { upd((tt) => { tt.items = tt.items.filter((x) => x.id !== editing.id); }); setEditing(null); }} />
      )}
      {asking && (
        <Modal title={`Kam patří „${asking.name}“?`} onClose={() => setAsking(null)}>
          <SectionPicker value={null} onPick={(sid) => { upd((tt, d) => { learn(d, asking.name, sid); tt.items.push({ id: uid(), note: '', ...asking, sectionId: sid }); }); setAsking(null); }} />
        </Modal>
      )}
    </div>
  );
}
