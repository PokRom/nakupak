import { useState } from 'react';
import { useStore, uid } from '../store.jsx';
import { Header, Modal } from '../components/ui.jsx';
import { t, secName } from '../i18n.jsx';

export default function Stores() {
  const { state, mutate } = useStore();
  const [editId, setEditId] = useState(null);
  const [newName, setNewName] = useState(null);

  function create() {
    const id = uid();
    mutate((d) => d.stores.push({ id, name: newName.trim() || t('Obchod'), sectionOrder: d.sections.map((s) => s.id), hidden: [] }));
    setNewName(null);
    setEditId(id);
  }

  if (editId) return <StoreEditor id={editId} onBack={() => setEditId(null)} />;

  return (
    <div className="screen">
      <Header title={t('Obchody')} right={<button className="btn small primary" onClick={() => setNewName('')}>{t('＋ Nový')}</button>} />
      <div className="content">
        <p className="muted">{t('Každému obchodu nastav pořadí sekcí tak, jak jimi procházíš od vchodu k pokladnám.')}</p>
        {state.stores.map((s) => (
          <button key={s.id} className="card list-card" onClick={() => setEditId(s.id)}>
            <div>
              <div className="card-title">🏬 {s.name}</div>
              <div className="muted small">{t('{n} sekcí', { n: s.sectionOrder.length - s.hidden.length })}</div>
            </div>
            <span className="muted">›</span>
          </button>
        ))}
      </div>
      {newName != null && (
        <Modal title={t('Nový obchod')} onClose={() => setNewName(null)} footer={<button className="btn primary" onClick={create}>{t('Vytvořit')}</button>}>
          <input className="input" autoFocus placeholder={t('např. Albert Chodov')} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        </Modal>
      )}
    </div>
  );
}

function StoreEditor({ id, onBack }) {
  const { state, mutate } = useStore();
  const store = state.stores.find((s) => s.id === id);
  const [drag, setDrag] = useState(null);
  const [addSection, setAddSection] = useState(null);
  const [renaming, setRenaming] = useState(null);
  if (!store) return null;

  const byId = Object.fromEntries(state.sections.map((s) => [s.id, { ...s, name: secName(s) }]));
  const order = [...store.sectionOrder.filter((sid) => byId[sid]), ...state.sections.map((s) => s.id).filter((sid) => !store.sectionOrder.includes(sid))];
  const upd = (fn) => mutate((d) => fn(d.stores.find((s) => s.id === id), d));

  const move = (from, to) => {
    if (to < 0 || to >= order.length || from === to) return;
    upd((s) => { const o = [...order]; const [x] = o.splice(from, 1); o.splice(to, 0, x); s.sectionOrder = o; });
  };

  return (
    <div className="screen">
      <Header title={t('Rozložení obchodu')} onBack={onBack} />
      <div className="content">
        <input className="input" value={store.name} onChange={(e) => upd((s) => { s.name = e.target.value; })} />
        <p className="muted small">{t('🚪 Vchod nahoře, 🧾 pokladny dole. Přesouvej šipkami nebo přetažením (podrž ≡). Oko skryje sekci, kterou obchod nemá.')}</p>
        <div className="order-list">
          {order.map((sid, i) => {
            const s = byId[sid];
            const hidden = store.hidden.includes(sid);
            return (
              <div key={sid} className={'order-row' + (hidden ? ' off' : '') + (drag === i ? ' dragging' : '')} style={{ '--c': s.color }}
                onDragOver={(e) => { e.preventDefault(); if (drag != null && drag !== i) { move(drag, i); setDrag(i); } }}>
                <span className="handle" draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}
                  onTouchStart={() => setDrag(i)}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const el = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-idx]');
                    const to = el ? +el.dataset.idx : null;
                    if (to != null && drag != null && to !== drag) { move(drag, to); setDrag(to); }
                  }}
                  onTouchEnd={() => setDrag(null)} data-idx={i}>≡</span>
                <span className="order-num" data-idx={i}>{i + 1}</span>
                <button className="order-name" data-idx={i} onClick={() => setRenaming({ id: sid, name: s.name, icon: s.icon })}>{s.icon} {s.name}</button>
                <button className="icon-btn" onClick={() => move(i, i - 1)} aria-label={t('Nahoru')}>▲</button>
                <button className="icon-btn" onClick={() => move(i, i + 1)} aria-label={t('Dolů')}>▼</button>
                <button className="icon-btn" onClick={() => upd((st) => { st.sectionOrder = order; st.hidden = hidden ? st.hidden.filter((x) => x !== sid) : [...st.hidden, sid]; })} aria-label={t('Skrýt')}>{hidden ? '🙈' : '👁️'}</button>
              </div>
            );
          })}
        </div>
        <div className="row gap wrap">
          <button className="btn ghost" onClick={() => setAddSection({ name: '', icon: '🛍️' })}>{t('＋ Vlastní sekce')}</button>
          <button className="btn ghost" onClick={() => upd((s, d) => { s.sectionOrder = d.sections.map((x) => x.id); s.hidden = []; })}>{t('↺ Výchozí pořadí')}</button>
          {state.stores.length > 1 && (
            <button className="btn ghost danger-text" onClick={() => {
              if (!confirm(t('Smazat obchod „{name}“?', { name: store.name }))) return;
              mutate((d) => {
                d.stores = d.stores.filter((s) => s.id !== id);
                const fallback = d.stores[0].id;
                d.lists.forEach((l) => { if (l.storeId === id) l.storeId = fallback; });
                if (d.activeStoreId === id) d.activeStoreId = fallback;
              });
              onBack();
            }}>{t('🗑️ Smazat obchod')}</button>
          )}
        </div>
      </div>

      {addSection && (
        <Modal title={t('Nová sekce')} onClose={() => setAddSection(null)} footer={
          <button className="btn primary" disabled={!addSection.name.trim()} onClick={() => {
            const sid = 'vlastni-' + uid();
            mutate((d) => {
              d.sections.push({ id: sid, name: addSection.name.trim(), icon: addSection.icon || '🛍️', color: '#78909c' });
              d.stores.forEach((s) => { const p = s.sectionOrder.indexOf('pokladna'); if (p < 0) s.sectionOrder.push(sid); else s.sectionOrder.splice(p, 0, sid); });
            });
            setAddSection(null);
          }}>{t('Přidat')}</button>
        }>
          <div className="row gap">
            <input className="input emoji-input" value={addSection.icon} maxLength={4} onChange={(e) => setAddSection({ ...addSection, icon: e.target.value })} />
            <input className="input" autoFocus placeholder={t('např. Bio a zdravá výživa')} value={addSection.name} onChange={(e) => setAddSection({ ...addSection, name: e.target.value })} />
          </div>
        </Modal>
      )}

      {renaming && (
        <Modal title={t('Upravit sekci')} onClose={() => setRenaming(null)} footer={
          <button className="btn primary" onClick={() => { mutate((d) => { const s = d.sections.find((x) => x.id === renaming.id); s.name = renaming.name.trim() || s.name; s.icon = renaming.icon || s.icon; }); setRenaming(null); }}>{t('Uložit')}</button>
        }>
          <div className="row gap">
            <input className="input emoji-input" value={renaming.icon} maxLength={4} onChange={(e) => setRenaming({ ...renaming, icon: e.target.value })} />
            <input className="input" value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
          </div>
          <p className="muted small">{t('Název sekce se změní ve všech obchodech.')}</p>
        </Modal>
      )}
    </div>
  );
}
