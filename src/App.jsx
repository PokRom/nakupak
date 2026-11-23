import { useCallback, useEffect, useState } from 'react';
import { useStore, daysLeft } from './store.jsx';
import Lists from './screens/Lists.jsx';
import ListDetail from './screens/ListDetail.jsx';
import Shopping from './screens/Shopping.jsx';
import Pantry from './screens/Pantry.jsx';
import Templates from './screens/Templates.jsx';
import Stores from './screens/Stores.jsx';
import Settings from './screens/Settings.jsx';

const TABS = [
  { id: 'lists', label: 'Seznamy', icon: '📝' },
  { id: 'pantry', label: 'Lednice', icon: '🧊' },
  { id: 'templates', label: 'Profily', icon: '🧺' },
  { id: 'stores', label: 'Obchody', icon: '🏬' },
  { id: 'settings', label: 'Nastavení', icon: '⚙️' },
];

export default function App() {
  const { state, sync } = useStore();
  const [tab, setTab] = useState('lists');
  const [listId, setListId] = useState(null);
  const [shopping, setShopping] = useState(false);
  const [msg, setMsg] = useState(null);

  const toast = useCallback((text) => {
    setMsg(text);
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => setMsg(null), 2600);
  }, []);

  // Seznam mohl smazat druhý telefon – vrátíme se na přehled.
  useEffect(() => {
    if (listId && !state.lists.some((l) => l.id === listId)) { setListId(null); setShopping(false); }
  }, [listId, state.lists]);
  const syncProblem = ['offline', 'badcode', 'server'].includes(sync.status) ? sync.status : null;

  const openList = (id) => { setTab('lists'); setShopping(false); setListId(id); };
  const expiring = state.pantry.filter((p) => { const d = daysLeft(p.expiresAt); return d != null && d <= 2; }).length;

  let screen;
  if (tab === 'lists' && listId && shopping) screen = <Shopping listId={listId} onBack={() => setShopping(false)} />;
  else if (tab === 'lists' && listId) screen = <ListDetail listId={listId} onBack={() => setListId(null)} onShop={() => setShopping(true)} />;
  else if (tab === 'lists') screen = <Lists open={openList} />;
  else if (tab === 'pantry') screen = <Pantry toast={toast} />;
  else if (tab === 'templates') screen = <Templates openList={openList} />;
  else if (tab === 'stores') screen = <Stores />;
  else screen = <Settings toast={toast} />;

  return (
    <div className="app">
      {screen}
      {!shopping && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => { setTab(t.id); if (t.id === 'lists' && tab === 'lists') setListId(null); }}>
              <span className="tab-icon">{t.icon}{t.id === 'pantry' && expiring > 0 && <i className="dot">{expiring}</i>}{t.id === 'settings' && syncProblem && <i className={'sync-dot ' + syncProblem} />}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
