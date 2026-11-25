import { useState } from 'react';
import { useStore, uid, addItemToList, groupBySection, learn, fmtQty, findInPantry, sectionFor } from '../store.jsx';
import { Header, Modal, Empty, AddItemBar, ItemEditor, SectionPicker } from '../components/ui.jsx';
import { parseBulk } from '../data/normalize.js';
import ApplyTemplate from './ApplyTemplate.jsx';

export default function ListDetail({ listId, onBack, onShop }) {
  const { state, mutate } = useStore();
  const list = state.lists.find((l) => l.id === listId);
  const [editing, setEditing] = useState(null);
  const [asking, setAsking] = useState(null); // položka, u které neznáme sekci
  const [menu, setMenu] = useState(false);
  const [saveTpl, setSaveTpl] = useState(false);
  const [tplPick, setTplPick] = useState(false);
  const [tplApply, setTplApply] = useState(null);
  const [rename, setRename] = useState(null);

  if (!list) return null;

  const pending = list.items.filter((i) => !i.checked);
  const groups = groupBySection(state, list.storeId, pending);
  const checkedCount = list.items.length - pending.length;

  function add(item) {
    if (!item.sectionId) { setAsking(item); return; }
    mutate((d) => addItemToList(d, listId, item));
  }

  function bulk(text) {
    const items = parseBulk(text).map((p) => ({ ...p, name: p.name.charAt(0).toUpperCase() + p.name.slice(1) }));
    mutate((d) => {
      for (const it of items) addItemToList(d, listId, { ...it, sectionId: sectionFor(d, it.name) || 'ostatni' });
    });
  }

  function answer(sectionId) {
    const item = asking;
    mutate((d) => { learn(d, item.name, sectionId); addItemToList(d, listId, { ...item, sectionId }); });
    setAsking(null);
  }

  function saveItem(updated) {
    mutate((d) => {
      const l = d.lists.find((x) => x.id === listId);
      const i = l.items.findIndex((x) => x.id === updated.id);
      const before = l.items[i];
      if (before.sectionId !== updated.sectionId) learn(d, updated.name, updated.sectionId);
      l.items[i] = updated;
    });
    setEditing(null);
  }

  return (
    <div className="screen">
      <Header
        title={list.name}
        onBack={onBack}
        right={<button className="icon-btn" onClick={() => setMenu(true)} aria-label="Možnosti">⋯</button>}
      />
      <div className="content">
        <div className="row gap wrap">
          <label className="store-select">
            🏬
            <select value={list.storeId || ''} onChange={(e) => mutate((d) => { d.lists.find((l) => l.id === listId).storeId = e.target.value; d.activeStoreId = e.target.value; })}>
              {state.stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <button className="btn small" onClick={() => setTplPick(true)}>＋ Z profilu</button>
        </div>

        <AddItemBar onAdd={add} onBulk={bulk} placeholder="Přidat… (např. 2 kg brambory)" />

        {pending.length === 0 && <Empty icon="🛒">Seznam je prázdný. Napiš položku nebo vlož celý seznam oddělený čárkami.</Empty>}

        {groups.map(({ section, items }) => (
          <div key={section.id} className="group" style={{ '--c': section.color }}>
            <div className="group-head"><span>{section.icon}</span> {section.name} <span className="muted">· {items.length}</span></div>
            {items.map((it) => {
              const home = findInPantry(state, it.name);
              return (
                <button key={it.id} className="item" onClick={() => setEditing(it)}>
                  <span className="item-name">{it.name}{it.note && <span className="muted"> · {it.note}</span>}</span>
                  {home && <span className="tag" title="Máš doma">🏠 {fmtQty(home.quantity, home.unit) || 'doma'}</span>}
                  <span className="item-qty">{fmtQty(it.quantity, it.unit)}</span>
                </button>
              );
            })}
          </div>
        ))}

        {checkedCount > 0 && (
          <button className="btn ghost full" onClick={() => mutate((d) => { const l = d.lists.find((x) => x.id === listId); l.items = l.items.filter((i) => !i.checked); })}>
            Smazat {checkedCount} koupených
          </button>
        )}
      </div>

      {pending.length > 0 && (
        <div className="fab-wrap">
          <button className="btn primary fab" onClick={onShop}>🛒 Jdu nakupovat</button>
        </div>
      )}

      {editing && (
        <ItemEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSave={saveItem}
          onDelete={() => { mutate((d) => { const l = d.lists.find((x) => x.id === listId); l.items = l.items.filter((i) => i.id !== editing.id); }); setEditing(null); }}
        />
      )}

      {asking && (
        <Modal title={`Kam patří „${asking.name}“?`} onClose={() => answer('ostatni')}>
          <p className="muted">Zapamatuji si to pro příště.</p>
          <SectionPicker value={null} onPick={answer} />
        </Modal>
      )}

      {menu && (
        <Modal title="Možnosti seznamu" onClose={() => setMenu(false)}>
          <div className="menu">
            <button onClick={() => { setMenu(false); setRename(list.name); }}>✏️ Přejmenovat</button>
            <button onClick={() => { setMenu(false); setSaveTpl(true); }}>💾 Uložit jako profil</button>
            <button onClick={() => {
              const text = groups.map((g) => `${g.section.icon} ${g.section.name}\n` + g.items.map((i) => `- ${i.name} ${fmtQty(i.quantity, i.unit)}`.trim()).join('\n')).join('\n\n');
              if (navigator.share) navigator.share({ title: list.name, text }).catch(() => {});
              else navigator.clipboard?.writeText(text);
              setMenu(false);
            }}>📤 Sdílet jako text</button>
            <button className="danger-text" onClick={() => {
              if (!confirm(`Smazat seznam „${list.name}“?`)) return;
              mutate((d) => { d.lists = d.lists.filter((l) => l.id !== listId); });
              onBack();
            }}>🗑️ Smazat seznam</button>
          </div>
        </Modal>
      )}

      {rename != null && (
        <Modal title="Přejmenovat" onClose={() => setRename(null)} footer={
          <button className="btn primary" onClick={() => { mutate((d) => { d.lists.find((l) => l.id === listId).name = rename.trim() || list.name; }); setRename(null); }}>Uložit</button>
        }>
          <input className="input" autoFocus value={rename} onChange={(e) => setRename(e.target.value)} />
        </Modal>
      )}

      {saveTpl && <SaveAsTemplate list={list} onClose={() => setSaveTpl(false)} />}

      {tplPick && (
        <Modal title="Vložit z profilu" onClose={() => setTplPick(false)}>
          {state.templates.length === 0 && <p className="muted">Nemáš žádný profil. Vytvoř ho v záložce Profily.</p>}
          <div className="menu">
            {state.templates.map((t) => (
              <button key={t.id} onClick={() => { setTplPick(false); setTplApply(t); }}>{t.emoji} {t.name} <span className="muted">· {t.items.length} položek</span></button>
            ))}
          </div>
        </Modal>
      )}
      {tplApply && <ApplyTemplate template={tplApply} targetListId={listId} onClose={() => setTplApply(null)} onDone={() => setTplApply(null)} />}
    </div>
  );
}

function SaveAsTemplate({ list, onClose }) {
  const { mutate } = useStore();
  const [name, setName] = useState(list.name);
  const [emoji, setEmoji] = useState('🧺');
  function save() {
    mutate((d) => d.templates.push({
      id: uid(), name: name.trim() || list.name, emoji, servings: null, defaultStoreId: list.storeId,
      items: list.items.map(({ name, quantity, unit, sectionId, note }) => ({ id: uid(), name, quantity, unit, sectionId, note })),
    }));
    onClose();
  }
  return (
    <Modal title="Uložit jako profil" onClose={onClose} footer={<button className="btn primary" onClick={save}>Uložit</button>}>
      <div className="row gap">
        <input className="input emoji-input" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <p className="muted">Uloží se všech {list.items.length} položek včetně množství.</p>
    </Modal>
  );
}
