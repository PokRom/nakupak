import { useState } from 'react';
import { useStore, uid, addItemToList, findInPantry, fmtQty } from '../store.jsx';
import { Modal } from '../components/ui.jsx';

/**
 * Vloží položky profilu do nového nebo existujícího seznamu.
 * Co je doma v lednici, je předem odškrtnuté.
 */
export default function ApplyTemplate({ template, targetListId, onClose, onDone }) {
  const { state, mutate } = useStore();
  const [servings, setServings] = useState(template.servings || null);
  const factor = template.servings && servings ? servings / template.servings : 1;
  const [rows, setRows] = useState(() => template.items.map((it) => {
    const home = findInPantry(state, it.name);
    return { ...it, include: !home, home };
  }));
  const [target, setTarget] = useState(targetListId || 'new');

  function apply() {
    // Id určíme mimo updater – React ho nemusí spustit hned.
    const listId = target === 'new' ? uid() : target;
    mutate((d) => {
      if (target === 'new') {
        const storeId = template.defaultStoreId && d.stores.some((s) => s.id === template.defaultStoreId) ? template.defaultStoreId : d.activeStoreId;
        d.lists.push({ id: listId, name: template.name, storeId, createdAt: Date.now(), items: [] });
      }
      for (const r of rows.filter((x) => x.include)) {
        addItemToList(d, listId, {
          name: r.name,
          quantity: r.quantity != null ? Math.round(r.quantity * factor * 100) / 100 : null,
          unit: r.unit, sectionId: r.sectionId || 'ostatni', note: r.note || '',
        });
      }
    });
    onDone(listId);
  }

  const count = rows.filter((r) => r.include).length;
  return (
    <Modal title={`${template.emoji} ${template.name}`} onClose={onClose} footer={
      <button className="btn primary" disabled={!count} onClick={apply}>Přidat {count} položek</button>
    }>
      {!targetListId && (
        <label className="field">Kam
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="new">➕ Nový seznam „{template.name}“</option>
            {state.lists.map((l) => <option key={l.id} value={l.id}>📝 {l.name}</option>)}
          </select>
        </label>
      )}
      {template.servings && (
        <label className="field">Počet porcí
          <div className="stepper inline">
            <button onClick={() => setServings(Math.max(1, (servings || 1) - 1))}>−</button>
            <span>{servings}</span>
            <button onClick={() => setServings((servings || 1) + 1)}>＋</button>
          </div>
        </label>
      )}
      <div className="row between"><span className="muted small">Doma = podle lednice</span>
        <button className="link" onClick={() => setRows((r) => r.map((x) => ({ ...x, include: !r.every((y) => y.include) })))}>vše / nic</button>
      </div>
      {rows.map((r) => (
        <label key={r.id} className={'check-row' + (r.include ? '' : ' off')}>
          <input type="checkbox" checked={r.include} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, include: e.target.checked } : x)))} />
          <span className="item-name">{r.name}</span>
          {r.home && <span className="tag">🧊 doma {fmtQty(r.home.quantity, r.home.unit)}</span>}
          <span className="item-qty">{r.quantity != null ? fmtQty(Math.round(r.quantity * factor * 100) / 100, r.unit) : ''}</span>
        </label>
      ))}
    </Modal>
  );
}
