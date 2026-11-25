import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, sectionFor, findInPantry, fmtQty, daysLeft } from '../store.jsx';
import { UNITS } from '../data/sections.js';
import { normalizeName, parseItem, plain } from '../data/normalize.js';
import { WORDS_CS, WORDS_EN } from '../data/dictionary.js';
import { t, getLang, secName, unitLabel } from '../i18n.jsx';

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Zavřít')}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Header({ title, onBack, right }) {
  return (
    <header className="topbar">
      {onBack ? <button className="icon-btn" onClick={onBack} aria-label={t('Zpět')}>‹</button> : <span className="topbar-spacer" />}
      <h1>{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

export function Empty({ icon, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div>{children}</div>
    </div>
  );
}

export function SectionPicker({ value, onPick }) {
  const { state } = useStore();
  return (
    <div className="section-grid">
      {state.sections.map((s) => (
        <button
          key={s.id}
          type="button"
          className={'section-chip' + (value === s.id ? ' active' : '')}
          style={{ '--c': s.color }}
          onClick={() => onPick(s.id)}
        >
          <span>{s.icon}</span> {secName(s)}
        </button>
      ))}
    </div>
  );
}

export function QtyInputs({ quantity, unit, onChange }) {
  return (
    <div className="row gap">
      <input
        className="input qty"
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        placeholder={t('Množ.')}
        value={quantity ?? ''}
        onChange={(e) => onChange({ quantity: e.target.value === '' ? null : parseFloat(e.target.value), unit: unit || 'ks' })}
      />
      <select className="input" value={unit || 'ks'} onChange={(e) => onChange({ quantity, unit: e.target.value })}>
        {UNITS.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
      </select>
    </div>
  );
}

/** Editor položky seznamu / šablony. */
export function ItemEditor({ item, onSave, onDelete, onClose, title = t('Upravit položku') }) {
  const [draft, setDraft] = useState(item);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          {onDelete && <button className="btn danger" onClick={onDelete}>{t('Smazat')}</button>}
          <button className="btn primary" disabled={!draft.name.trim()} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>{t('Uložit')}</button>
        </>
      }
    >
      <label className="field">{t('Název')}
        <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
      </label>
      <label className="field">{t('Množství')}
        <QtyInputs quantity={draft.quantity} unit={draft.unit} onChange={set} />
      </label>
      <label className="field">{t('Poznámka')}
        <input className="input" value={draft.note || ''} placeholder={t('např. bio, větší balení')} onChange={(e) => set({ note: e.target.value })} />
      </label>
      <div className="field">{t('Sekce v obchodě')}
        <SectionPicker value={draft.sectionId} onPick={(sectionId) => set({ sectionId })} />
      </div>
    </Modal>
  );
}

/**
 * Pole pro přidání položky s našeptávačem.
 * onAdd({name, quantity, unit, sectionId|null}) – sectionId je null, když položku neznáme.
 */
export function AddItemBar({ onAdd, onBulk, placeholder = t('Přidat položku…'), showPantryHint = true }) {
  const { state } = useStore();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const suggestions = useMemo(() => {
    const q = plain(text);
    if (q.length < 2) return [];
    const hist = Object.values(state.history).sort((a, b) => b.count - a.count).map((h) => h.name);
    const words = getLang() === 'en' ? WORDS_EN : WORDS_CS;
    const pool = [...new Set([...hist, ...words.map(cap)])];
    return pool.filter((w) => plain(w).includes(q)).sort((a, b) => plain(a).indexOf(q) - plain(b).indexOf(q)).slice(0, 6);
  }, [text, state.history]);

  const parsed = parseItem(text);
  const inPantry = showPantryHint && parsed.name.length > 1 ? findInPantry(state, parsed.name) : null;

  // Text bereme přímo z pole: iPhone může mít rozepsané slovo z návrhů klávesnice,
  // které se do stavu Reactu ještě nepropsalo.
  function submit(name = inputRef.current?.value ?? text) {
    const raw = name.trim();
    if (!raw) return;
    if (/[\n,;]/.test(raw) && onBulk) {
      onBulk(raw);
    } else {
      const p = parseItem(raw);
      onAdd({ ...p, name: cap(p.name), sectionId: sectionFor(state, p.name) });
    }
    setText('');
    inputRef.current?.focus();
  }

  return (
    <div className="addbar-wrap">
      <form className="addbar" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input
          ref={inputRef}
          className="input"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text');
            if (/[\n,;]/.test(t) && onBulk) { e.preventDefault(); onBulk(t); }
          }}
          enterKeyHint="done"
          autoComplete="off"
        />
        {/* Na iPhonu by klepnutí nejdřív zavřelo klávesnici, stránka by poskočila a klepnutí
            by minulo tlačítko. Proto pole fokus neztratí a přidáváme přímo při klepnutí. */}
        <button
          className="btn primary"
          type="button"
          aria-label={t('Přidat')}
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => submit()}
        >＋</button>
      </form>
      {inPantry && (
        <div className="hint warn">
          🏠 {t('Doma máš:')} <b>{inPantry.name}</b> {fmtQty(inPantry.quantity, inPantry.unit)}
          {inPantry.expiresAt && <> {t('· spotřeba za {n} dní', { n: daysLeft(inPantry.expiresAt) })}</>}
        </div>
      )}
      {focused && suggestions.length > 0 && (
        <div className="suggest">
          {suggestions.map((s) => (
            <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => submit(prefixQty(text) + s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function prefixQty(text) {
  const m = text.match(/^(\d+(?:[.,]\d+)?\s*(?:ks|g|kg|ml|l|bal|pcs|pc|pack)?\.?\s+)/i);
  return m ? m[1] : '';
}

export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function sameName(a, b) {
  return normalizeName(a) === normalizeName(b);
}
