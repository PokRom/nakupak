import { useEffect, useState } from 'react';
import { useStore, uid, groupBySection, fmtQty } from '../store.jsx';
import { Header, Modal, QtyInputs } from '../components/ui.jsx';
import { SECTION_TO_LOCATION } from '../data/sections.js';
import { normalizeName } from '../data/normalize.js';
import { t, locName } from '../i18n.jsx';

export default function Shopping({ listId, onBack }) {
  const { state, mutate } = useStore();
  const list = state.lists.find((l) => l.id === listId);
  const [openDone, setOpenDone] = useState({});
  const [finishing, setFinishing] = useState(false);

  // Obrazovka nezhasne během nákupu (kde to prohlížeč podporuje).
  useEffect(() => {
    let lock;
    const req = () => navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}); };
  }, []);

  if (!list) return null;
  const groups = groupBySection(state, list.storeId, list.items);
  const total = list.items.length;
  const done = list.items.filter((i) => i.checked).length;
  const store = state.stores.find((s) => s.id === list.storeId);

  const toggle = (id) => mutate((d) => {
    const it = d.lists.find((l) => l.id === listId).items.find((i) => i.id === id);
    it.checked = !it.checked;
    it.checkedAt = it.checked ? Date.now() : null;
  });

  // První sekce, ve které ještě něco zbývá = „teď jsi tady“.
  const currentId = groups.find((g) => g.items.some((i) => !i.checked))?.section.id;

  return (
    <div className="screen shopping">
      <Header title={store ? store.name : list.name} onBack={onBack}
        right={<button className="btn small primary" onClick={() => setFinishing(true)} disabled={!done}>{t('Dokončit')}</button>} />
      <div className="progress"><div style={{ width: total ? `${(done / total) * 100}%` : 0 }} /><span>{done} / {total}</span></div>
      <div className="content">
        {groups.map(({ section, items }) => {
          const left = items.filter((i) => !i.checked);
          const complete = left.length === 0;
          const expanded = !complete || openDone[section.id];
          const sorted = [...left, ...items.filter((i) => i.checked)];
          return (
            <div key={section.id} className={'group shop' + (complete ? ' complete' : '') + (section.id === currentId ? ' current' : '')} style={{ '--c': section.color }}>
              <button className="group-head big" onClick={() => complete && setOpenDone((o) => ({ ...o, [section.id]: !o[section.id] }))}>
                <span>{section.icon}</span> {section.name}
                <span className="grow" />
                {complete ? <span className="done-mark">✓</span> : <span className="count">{left.length}</span>}
              </button>
              {expanded && sorted.map((it) => (
                <button key={it.id} className={'item shop-item' + (it.checked ? ' checked' : '')} onClick={() => toggle(it.id)}>
                  <span className="check">{it.checked ? '✓' : ''}</span>
                  <span className="item-name">{it.name}{it.note && <span className="muted"> · {it.note}</span>}</span>
                  <span className="item-qty">{fmtQty(it.quantity, it.unit)}</span>
                </button>
              ))}
            </div>
          );
        })}
        {done === total && total > 0 && <div className="all-done">{t('🎉 Máš všechno! Klepni na')} <b>{t('Dokončit')}</b>.</div>}
      </div>
      {finishing && <FinishShopping list={list} onClose={() => setFinishing(false)} onDone={onBack} />}
    </div>
  );
}

/** Po nákupu nabídne uložení koupených položek do zásob a odebere je ze seznamu. */
function FinishShopping({ list, onClose, onDone }) {
  const { state, mutate } = useStore();
  const bought = list.items.filter((i) => i.checked);
  const [rows, setRows] = useState(() => bought.map((i) => ({
    id: i.id, name: i.name, quantity: i.quantity ?? 1, unit: i.unit || 'ks', sectionId: i.sectionId,
    locationId: SECTION_TO_LOCATION[i.sectionId] || 'ostatni',
    include: !['drogerie', 'domacnost', 'pokladna'].includes(i.sectionId),
    expiresAt: '',
  })));
  const setRow = (id, patch) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  function finish(savePantry) {
    mutate((d) => {
      if (savePantry) {
        for (const r of rows.filter((x) => x.include)) {
          const existing = d.pantry.find((p) => normalizeName(p.name) === normalizeName(r.name) && p.unit === r.unit && p.locationId === r.locationId);
          if (existing) {
            existing.quantity = (existing.quantity || 0) + (r.quantity || 1);
            if (r.expiresAt) existing.expiresAt = r.expiresAt;
          } else {
            d.pantry.push({ id: uid(), name: r.name, quantity: r.quantity, unit: r.unit, sectionId: r.sectionId, locationId: r.locationId, addedAt: Date.now(), expiresAt: r.expiresAt || null, minQuantity: null });
          }
        }
      }
      const l = d.lists.find((x) => x.id === list.id);
      l.items = l.items.filter((i) => !i.checked);
    });
    onDone();
  }

  return (
    <Modal title={t('Uložit nákup do zásob?')} onClose={onClose} footer={
      <>
        <button className="btn" onClick={() => finish(false)}>{t('Neukládat')}</button>
        <button className="btn primary" onClick={() => finish(true)}>{t('Uložit ({n})', { n: rows.filter((r) => r.include).length })}</button>
      </>
    }>
      <p className="muted">{t('Zaškrtnuté položky se přidají do zásob. Koupené položky se ze seznamu odeberou.')}</p>
      {rows.map((r) => (
        <div key={r.id} className={'finish-row' + (r.include ? '' : ' off')}>
          <label className="row gap">
            <input type="checkbox" checked={r.include} onChange={(e) => setRow(r.id, { include: e.target.checked })} />
            <b>{r.name}</b>
          </label>
          {r.include && (
            <div className="row gap wrap">
              <QtyInputs quantity={r.quantity} unit={r.unit} onChange={(p) => setRow(r.id, p)} />
              <select className="input" value={r.locationId} onChange={(e) => setRow(r.id, { locationId: e.target.value })}>
                {state.locations.map((l) => <option key={l.id} value={l.id}>{l.icon} {locName(l)}</option>)}
              </select>
              <input className="input" type="date" title={t('Spotřebujte do')} value={r.expiresAt} onChange={(e) => setRow(r.id, { expiresAt: e.target.value })} />
            </div>
          )}
        </div>
      ))}
    </Modal>
  );
}
