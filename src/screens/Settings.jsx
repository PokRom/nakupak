import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { Header, Modal } from '../components/ui.jsx';
import { formatCode } from '../sync/engine.js';
import { version } from '../../package.json';
import { t, locale, useLang, LANGUAGES } from '../i18n.jsx';

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
        toast(t('Data obnovena ze zálohy'));
      } catch {
        toast(t('Soubor není platná záloha Nákupáku'));
      }
    };
    r.readAsText(file);
  }

  const learnedCount = Object.keys(state.learned).length;

  return (
    <div className="screen">
      <Header title={t('Nastavení')} />
      <div className="content">
        <Language />
        <Sharing toast={toast} />

        <div className="card block">
          <div className="card-title">{t('💾 Záloha')}</div>
          <p className="muted small">{t('Přenes data do jiného zařízení nebo si je ulož pro jistotu.')}</p>
          <div className="row gap wrap">
            <button className="btn" onClick={exportData}>{t('Stáhnout zálohu')}</button>
            <button className="btn" onClick={() => fileRef.current.click()}>{t('Obnovit ze zálohy')}</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && importData(e.target.files[0])} />
          </div>
        </div>

        <div className="card block">
          <div className="card-title">{t('🧠 Naučené položky')}</div>
          <p className="muted small">{t('Aplikace si pamatuje {n} vlastních zařazení do sekcí.', { n: learnedCount })}</p>
          {learnedCount > 0 && <button className="btn" onClick={() => { if (confirm(t('Zapomenout naučená zařazení?'))) setState((s) => ({ ...s, learned: {} })); }}>{t('Zapomenout')}</button>}
        </div>

        <div className="card block">
          <div className="card-title">{t('⚠️ Smazat vše')}</div>
          {sync.connected && <p className="muted small">{t('Smaže data jen v tomto telefonu a odpojí ho od sdílení. Sdílená data na webu zůstanou.')}</p>}
          <button className="btn danger" onClick={() => {
            if (!confirm(sync.connected ? t('Smazat data v tomto telefonu a odpojit ho od sdílení?') : t('Opravdu smazat všechny seznamy, zásoby, profily a obchody?'))) return;
            sync.disconnect();
            localStorage.removeItem('nakupak-state-v1');
            location.reload();
          }}>{sync.connected ? t('Smazat data v telefonu') : t('Smazat všechna data')}</button>
        </div>
        <p className="muted small center">Nákupák {version}</p>
      </div>
    </div>
  );
}

/** Chybové hlášky synchronizace jsou česky (modul běží i v testech mimo prohlížeč) – přeložíme je tady. */
function errorText(msg) {
  const m = /^Server odpověděl (\d+)$/.exec(msg || '');
  return m ? t('Server odpověděl {n}', { n: m[1] }) : t(msg);
}

/** Volba jazyka – platí jen pro tento telefon. */
function Language() {
  const { lang, setLang } = useLang();
  return (
    <div className="card block">
      <div className="card-title">{t('🌐 Jazyk')}</div>
      <div className="chips">
        {LANGUAGES.map((l) => (
          <button key={l.id} className={'chip' + (lang === l.id ? ' active' : '')} onClick={() => setLang(l.id)} aria-pressed={lang === l.id}>
            {l.label}
          </button>
        ))}
      </div>
      <p className="muted small">{t('Jazyk platí jen pro tento telefon.')}</p>
    </div>
  );
}

// Popisky se překládají až při zobrazení.
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
  if (s < 10) return t('právě teď');
  if (s < 60) return t('před {n} s', { n: s });
  if (s < 3600) return t('před {n} min', { n: Math.round(s / 60) });
  return new Date(ts).toLocaleString(locale(), { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
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
        toast(t('Propojeno – data z telefonu se nahrávají na web'));
      } else {
        setChoice({ code, resp, remoteCount });
      }
    } catch (e) {
      setError(e.kind === 'badcode' ? t('Neplatný kód. Najdeš ho ve WordPressu v Nastavení → Nákupák.')
        : e.kind === 'offline' ? t('Nepodařilo se spojit se serverem. Jsi online?')
        : errorText(e.message));
    } finally {
      setBusy(false);
    }
  }

  function finish(mode) {
    sync.connect(choice.code, choice.resp, mode);
    setChoice(null);
    setCode('');
    toast(t('Propojeno se sdílenou domácností'));
  }

  if (sync.connected) {
    const [icon, labelCs] = STATUS[sync.status] || STATUS.idle;
    const label = t(labelCs);
    return (
      <div className="card block">
        <div className="card-title">{t('👪 Sdílení s domácností')}</div>
        <div className={'sync-status ' + sync.status}>{icon} {label}{sync.status === 'ok' && sync.lastSync ? ` · ${ago(sync.lastSync, now)}` : ''}</div>
        {sync.status === 'server' && sync.error && <p className="muted small">{errorText(sync.error)}</p>}
        <p className="muted small">{t('Seznamy, zásoby, profily i obchody se sdílí se všemi telefony, které mají stejný kód.')}</p>
        <div className="code-box">{formatCode(sync.code)}</div>
        <div className="row gap wrap">
          <button className="btn" onClick={() => sync.syncNow()}>{t('🔄 Synchronizovat')}</button>
          <button className="btn ghost danger-text" onClick={() => {
            if (confirm(t('Odpojit tento telefon od sdílení? Data v telefonu zůstanou, ale přestanou se sdílet.'))) sync.disconnect();
          }}>{t('Odpojit')}</button>
        </div>
        {sync.status === 'badcode' && <button className="btn primary" onClick={() => sync.disconnect()}>{t('Zadat nový kód')}</button>}
      </div>
    );
  }

  return (
    <div className="card block">
      <div className="card-title">{t('👪 Sdílení s domácností')}</div>
      <p className="muted small">
        {t('Zadej kód domácnosti a seznamy, zásoby i profily se budou sdílet s ostatními telefony.')}
        {' '}{t('Kód najdeš ve WordPressu v')} <b>{t('Nastavení')} → Nákupák</b>.
      </p>
      <form className="row gap" onSubmit={(e) => { e.preventDefault(); if (code.trim()) tryConnect(); }}>
        <input className="input code-input" placeholder="XXXX-XXXX-XXXX" value={code} autoCapitalize="characters"
          autoComplete="off" autoCorrect="off" spellCheck={false} onChange={(e) => setCode(e.target.value)} />
        <button className="btn primary" disabled={busy || !code.trim()}>{busy ? '…' : t('Připojit')}</button>
      </form>
      {error && <div className="hint danger">{error}</div>}

      {choice && (
        <Modal title={t('Na webu už jsou sdílená data')} onClose={() => setChoice(null)}>
          <p>{t('Co s daty, která máš teď v tomhle telefonu?')}</p>
          <div className="menu">
            <button onClick={() => finish('replace')}>
              <b>{t('Použít jen sdílená data')}</b><br />
              <span className="muted small">{t('Data v telefonu se nahradí tím, co je na webu. Doporučeno pro druhý telefon.')}</span>
            </button>
            <button onClick={() => finish('merge')}>
              <b>{t('Spojit s daty v telefonu')}</b><br />
              <span className="muted small">{t('Seznamy, zásoby a profily z telefonu se přidají ke sdíleným.')}</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
