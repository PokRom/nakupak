import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { Header, Modal } from '../components/ui.jsx';
import { formatCode } from '../sync/engine.js';
import { version } from '../../package.json';

export default function Settings({ toast }) {
  const { state, setState, sync } = useStore();
  const fileRef = useRef(null);

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nakupak-zaloha-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data.lists) || !Array.isArray(data.stores)) throw new Error();
        setState((s) => ({ ...s, ...data }));
        toast('Data obnovena ze zálohy');
      } catch {
        toast('Soubor není platná záloha Nákupáku');
      }
    };
    r.readAsText(file);
  }

  const learnedCount = Object.keys(state.learned).length;

  return (
    <div className="screen">
      <Header title="Nastavení" />
      <div className="content">
        <Sharing toast={toast} />

        <div className="card block">
          <div className="card-title">💾 Záloha</div>
          <p className="muted small">Přenes data do jiného zařízení nebo si je ulož pro jistotu.</p>
          <div className="row gap wrap">
            <button className="btn" onClick={exportData}>Stáhnout zálohu</button>
            <button className="btn" onClick={() => fileRef.current.click()}>Obnovit ze zálohy</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && importData(e.target.files[0])} />
          </div>
        </div>

        <div className="card block">
          <div className="card-title">🧠 Naučené položky</div>
          <p className="muted small">Aplikace si pamatuje {learnedCount} vlastních zařazení do sekcí.</p>
          {learnedCount > 0 && <button className="btn" onClick={() => { if (confirm('Zapomenout naučená zařazení?')) setState((s) => ({ ...s, learned: {} })); }}>Zapomenout</button>}
        </div>

        <div className="card block">
          <div className="card-title">⚠️ Smazat vše</div>
          {sync.connected && <p className="muted small">Smaže data jen v tomto telefonu a odpojí ho od sdílení. Sdílená data na webu zůstanou.</p>}
          <button className="btn danger" onClick={() => {
            if (!confirm(sync.connected ? 'Smazat data v tomto telefonu a odpojit ho od sdílení?' : 'Opravdu smazat všechny seznamy, zásoby, profily a obchody?')) return;
            sync.disconnect();
            localStorage.removeItem('nakupak-state-v1');
            location.reload();
          }}>{sync.connected ? 'Smazat data v telefonu' : 'Smazat všechna data'}</button>
        </div>
        <p className="muted small center">Nákupák {version}</p>
      </div>
    </div>
  );
}

const STATUS = {
  idle: ['⏳', 'Připojuji…'],
  ok: ['✅', 'Sdíleno'],
  offline: ['📴', 'Bez připojení – změny se odešlou, až bude signál'],
  badcode: ['⛔', 'Kód už neplatí – zadej nový kód domácnosti'],
  server: ['⚠️', 'Chyba serveru'],
};

function ago(ts, now) {
  if (!ts) return '';
  const s = Math.round((now - ts) / 1000);
  if (s < 10) return 'právě teď';
  if (s < 60) return `před ${s} s`;
  if (s < 3600) return `před ${Math.round(s / 60)} min`;
  return new Date(ts).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Sharing({ toast }) {
  const { sync } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [choice, setChoice] = useState(null); // { code, resp, remoteCount }
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  async function tryConnect() {
    setBusy(true);
    setError(null);
    try {
      const { resp, remoteCount } = await sync.probe(code);
      if (remoteCount === 0) {
        sync.connect(code, resp, 'merge');
        toast('Propojeno – data z telefonu se nahrávají na web');
      } else {
        setChoice({ code, resp, remoteCount });
      }
    } catch (e) {
      setError(e.kind === 'badcode' ? 'Neplatný kód. Najdeš ho ve WordPressu v Nastavení → Nákupák.'
        : e.kind === 'offline' ? 'Nepodařilo se spojit se serverem. Jsi online?'
        : e.message);
    } finally {
      setBusy(false);
    }
  }

  function finish(mode) {
    sync.connect(choice.code, choice.resp, mode);
    setChoice(null);
    setCode('');
    toast('Propojeno se sdílenou domácností');
  }

  if (sync.connected) {
    const [icon, label] = STATUS[sync.status] || STATUS.idle;
    return (
      <div className="card block">
        <div className="card-title">👪 Sdílení s domácností</div>
        <div className={'sync-status ' + sync.status}>{icon} {label}{sync.status === 'ok' && sync.lastSync ? ` · ${ago(sync.lastSync, now)}` : ''}</div>
        {sync.status === 'server' && sync.error && <p className="muted small">{sync.error}</p>}
        <p className="muted small">Seznamy, zásoby, profily i obchody se sdílí se všemi telefony, které mají stejný kód.</p>
        <div className="code-box">{formatCode(sync.code)}</div>
        <div className="row gap wrap">
          <button className="btn" onClick={() => sync.syncNow()}>🔄 Synchronizovat</button>
          <button className="btn ghost danger-text" onClick={() => {
            if (confirm('Odpojit tento telefon od sdílení? Data v telefonu zůstanou, ale přestanou se sdílet.')) sync.disconnect();
          }}>Odpojit</button>
        </div>
        {sync.status === 'badcode' && <button className="btn primary" onClick={() => sync.disconnect()}>Zadat nový kód</button>}
      </div>
    );
  }

  return (
    <div className="card block">
      <div className="card-title">👪 Sdílení s domácností</div>
      <p className="muted small">
        Zadej kód domácnosti a seznamy, zásoby i profily se budou sdílet s ostatními telefony.
        Kód najdeš ve WordPressu v <b>Nastavení → Nákupák</b>.
      </p>
      <form className="row gap" onSubmit={(e) => { e.preventDefault(); if (code.trim()) tryConnect(); }}>
        <input className="input code-input" placeholder="XXXX-XXXX-XXXX" value={code} autoCapitalize="characters"
          autoComplete="off" autoCorrect="off" spellCheck={false} onChange={(e) => setCode(e.target.value)} />
        <button className="btn primary" disabled={busy || !code.trim()}>{busy ? '…' : 'Připojit'}</button>
      </form>
      {error && <div className="hint danger">{error}</div>}

      {choice && (
        <Modal title="Na webu už jsou sdílená data" onClose={() => setChoice(null)}>
          <p>Co s daty, která máš teď v tomhle telefonu?</p>
          <div className="menu">
            <button onClick={() => finish('replace')}>
              <b>Použít jen sdílená data</b><br />
              <span className="muted small">Data v telefonu se nahradí tím, co je na webu. Doporučeno pro druhý telefon.</span>
            </button>
            <button onClick={() => finish('merge')}>
              <b>Spojit s daty v telefonu</b><br />
              <span className="muted small">Seznamy, zásoby a profily z telefonu se přidají ke sdíleným.</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
