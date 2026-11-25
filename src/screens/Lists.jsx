import { useState } from 'react';
import { useStore, uid } from '../store.jsx';
import { Header, Modal, Empty } from '../components/ui.jsx';
import ApplyTemplate from './ApplyTemplate.jsx';
import { t } from '../i18n.jsx';

export default function Lists({ open }) {
  const { state, mutate } = useStore();
  const [creating, setCreating] = useState(false);
  const [fromTemplate, setFromTemplate] = useState(null);
  const [name, setName] = useState('');

  function create() {
    const id = uid();
    mutate((d) => d.lists.push({ id, name: name.trim() || t('Nákup'), storeId: d.activeStoreId, createdAt: Date.now(), items: [] }));
    setCreating(false);
    setName('');
    open(id);
  }

  return (
    <div className="screen">
      <Header title={t('Seznamy')} right={<button className="btn small primary" onClick={() => setCreating(true)}>{t('＋ Nový')}</button>} />
      <div className="content">
        {state.lists.length === 0 && <Empty icon="📝">{t('Zatím žádný seznam. Vytvoř nový nebo použij profil.')}</Empty>}
        {state.lists.map((l) => {
          const left = l.items.filter((i) => !i.checked).length;
          const store = state.stores.find((s) => s.id === l.storeId);
          return (
            <button key={l.id} className="card list-card" onClick={() => open(l.id)}>
              <div>
                <div className="card-title">{l.name}</div>
                <div className="muted">{store ? '🏬 ' + store.name : ''}</div>
              </div>
              <div className="badge">{left ? t('{n} zbývá', { n: left }) : l.items.length ? t('hotovo ✓') : t('prázdný')}</div>
            </button>
          );
        })}

        {state.templates.length > 0 && (
          <>
            <h3 className="section-label">{t('Rychle z profilu')}</h3>
            <div className="chips">
              {state.templates.map((t) => (
                <button key={t.id} className="chip" onClick={() => setFromTemplate(t)}>
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {creating && (
        <Modal title={t('Nový seznam')} onClose={() => setCreating(false)} footer={<button className="btn primary" onClick={create}>{t('Vytvořit')}</button>}>
          <input className="input" autoFocus placeholder={t('Název (např. Velký nákup)')} value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        </Modal>
      )}
      {fromTemplate && <ApplyTemplate template={fromTemplate} onClose={() => setFromTemplate(null)} onDone={(listId) => { setFromTemplate(null); open(listId); }} />}
    </div>
  );
}
