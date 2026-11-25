// Jazyk aplikace (čeština / angličtina).
// Texty se píší česky a funkce t() vrací překlad podle zvoleného jazyka.
// Jazyk je nastavení telefonu – nesdílí se s domácností.
import { createContext, Fragment, useCallback, useContext, useState } from 'react';
import { DEFAULT_SECTIONS, DEFAULT_LOCATIONS } from './data/sections.js';

const LANG_KEY = 'nakupak-lang';

export const LANGUAGES = [
  { id: 'cs', label: 'Čeština' },
  { id: 'en', label: 'English' },
];

function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'cs' || saved === 'en') return saved;
  } catch {}
  return /^(cs|sk)\b/i.test(navigator.language || 'cs') ? 'cs' : 'en';
}

let current = detectLang();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const getLang = () => current;
export const locale = () => (current === 'en' ? 'en-GB' : 'cs-CZ');

/** Přeloží český text; {jméno} v textu nahradí hodnotou z vars. */
export function t(text, vars) {
  let s = current === 'en' ? (EN[text] ?? text) : text;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

const Ctx = createContext({ lang: current, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(current);
  const setLang = useCallback((l) => {
    current = l;
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    document.documentElement.lang = l;
    setLangState(l);
  }, []);
  // Klíč podle jazyka znovu vykreslí celou aplikaci; data jsou v úložišti nad ní, nic se neztratí.
  return (
    <Ctx.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </Ctx.Provider>
  );
}

export const useLang = () => useContext(Ctx);

// ---------- Výchozí sekce a místa uložení ----------
// Uložené jsou česky; dokud je uživatel nepřejmenuje, zobrazí se v angličtině přeložené.

const SECTION_EN = {
  zelenina: 'Fruit & vegetables', pecivo: 'Bakery', maso: 'Meat & deli', ryby: 'Fish',
  mlecne: 'Dairy & eggs', syry: 'Cheese', trvanlive: 'Dry goods', konzervy: 'Tins & sauces',
  koreni: 'Spices & seasoning', sladkosti: 'Sweets & snacks', kava: 'Coffee & tea', napoje: 'Drinks',
  alkohol: 'Alcohol', mrazene: 'Frozen food', drogerie: 'Toiletries', domacnost: 'Household & cleaning',
  ostatni: 'Other', pokladna: 'Checkout',
};
const LOCATION_EN = { lednice: 'Fridge', mrazak: 'Freezer', spiz: 'Pantry', ostatni: 'Other' };
const SECTION_CS = Object.fromEntries(DEFAULT_SECTIONS.map((s) => [s.id, s.name]));
const LOCATION_CS = Object.fromEntries(DEFAULT_LOCATIONS.map((l) => [l.id, l.name]));

export function secName(s) {
  return current === 'en' && SECTION_EN[s.id] && SECTION_CS[s.id] === s.name ? SECTION_EN[s.id] : s.name;
}
export function locName(l) {
  return current === 'en' && LOCATION_EN[l.id] && LOCATION_CS[l.id] === l.name ? LOCATION_EN[l.id] : l.name;
}

// Jednotky jsou uložené česky (ks, bal…), zobrazují se podle jazyka.
const UNIT_EN = { ks: 'pcs', bal: 'pack', plech: 'tray' };
export const unitLabel = (u) => (current === 'en' ? UNIT_EN[u] || u : u);

// ---------- Anglické překlady ----------
const EN = {
  // Navigace
  'Seznamy': 'Lists', 'Zásoby': 'Supplies', 'Profily': 'Profiles', 'Obchody': 'Stores', 'Nastavení': 'Settings',
  'Zavřít': 'Close', 'Zpět': 'Back',

  // Společné
  'Uložit': 'Save', 'Smazat': 'Delete', 'Vytvořit': 'Create', 'Přidat': 'Add', 'Název': 'Name',
  'Množství': 'Quantity', 'Množ.': 'Qty', 'Poznámka': 'Note', 'Sekce v obchodě': 'Store section',
  'Upravit položku': 'Edit item', 'např. bio, větší balení': 'e.g. organic, large pack',
  'Přidat položku…': 'Add item…', '＋ Nový': '＋ New', 'Přejmenovat': 'Rename',
  'Doma máš:': 'At home:', '· spotřeba za {n} dní': '· use within {n} days',
  'položek': 'items',

  // Seznamy
  'Nákup': 'Shopping', 'Můj obchod': 'My store', 'Snídaně': 'Breakfast',
  'Zatím žádný seznam. Vytvoř nový nebo použij profil.': 'No lists yet. Create one or use a profile.',
  '{n} zbývá': '{n} left', 'hotovo ✓': 'done ✓', 'prázdný': 'empty',
  'Rychle z profilu': 'Quick from profile', 'Nový seznam': 'New list',
  'Název (např. Velký nákup)': 'Name (e.g. Weekly shop)',
  'Možnosti': 'Options', '＋ Z profilu': '＋ From profile', 'Přidat… (např. 2 kg brambory)': 'Add… (e.g. 2 kg potatoes)',
  'Seznam je prázdný. Napiš položku nebo vlož celý seznam oddělený čárkami.': 'The list is empty. Type an item or paste a whole list separated by commas.',
  'Máš doma': 'At home', 'doma': 'at home', 'Smazat {n} koupených': 'Remove {n} bought',
  '🛒 Jdu nakupovat': '🛒 Go shopping', 'Kam patří „{name}“?': 'Where does “{name}” go?',
  'Zapamatuji si to pro příště.': 'I’ll remember it next time.', 'Možnosti seznamu': 'List options',
  '✏️ Přejmenovat': '✏️ Rename', '💾 Uložit jako profil': '💾 Save as profile', '📤 Sdílet jako text': '📤 Share as text',
  'Smazat seznam „{name}“?': 'Delete list “{name}”?', '🗑️ Smazat seznam': '🗑️ Delete list',
  'Vložit z profilu': 'Add from profile', 'Nemáš žádný profil. Vytvoř ho v záložce Profily.': 'You have no profiles yet. Create one in the Profiles tab.',
  '· {n} položek': '· {n} items', 'Uložit jako profil': 'Save as profile',
  'Uloží se všech {n} položek včetně množství.': 'All {n} items will be saved including quantities.',

  // Nákupní režim
  'Dokončit': 'Finish', '🎉 Máš všechno! Klepni na': '🎉 You’ve got everything! Tap',
  'Uložit nákup do zásob?': 'Save shopping to supplies?', 'Neukládat': 'Don’t save', 'Uložit ({n})': 'Save ({n})',
  'Zaškrtnuté položky se přidají do zásob. Koupené položky se ze seznamu odeberou.': 'Ticked items will be added to your supplies. Bought items will be removed from the list.',
  'Spotřebujte do': 'Use by',

  // Zásoby
  'Vše · {n}': 'All · {n}', '⏰ Brzy projde: {names}': '⏰ Expiring soon: {names}',
  'Přidat do zásob… (např. 6 ks vejce)': 'Add to supplies… (e.g. 6 pcs eggs)', '🔍 Hledat v zásobách': '🔍 Search supplies',
  'Tady uvidíš, co máš doma. Po nákupu můžeš koupené věci uložit jedním klepnutím.': 'Here you’ll see what you have at home. After shopping you can save what you bought with one tap.',
  'prošlo {date}': 'expired {date}', 'projde dnes': 'expires today', 'do {date} ({n} d)': 'until {date} ({n} d)',
  'pod minimem': 'below minimum', 'Ubrat': 'Decrease',
  '{name}: pod minimem – je na seznamu': '{name}: below minimum – added to list',
  '„{name}“ přidáno na seznam': '“{name}” added to list', '{name} došlo': '{name} ran out',
  'Přidat na nákupní seznam?': 'Add to a shopping list?', 'Nemáš žádný seznam.': 'You have no lists.', 'Ne, díky': 'No, thanks',
  'Zásoba': 'Supply item', '✅ Dojedeno': '✅ Used up', '🗑️ Vyhozeno': '🗑️ Thrown away', 'Uloženo v': 'Stored in',
  'Minimální zásoba': 'Minimum stock', '(při poklesu se doplní na seznam)': '(when it drops below, it’s added to the list)',
  'bez minima': 'no minimum', 'pod minimem v zásobách': 'below minimum in supplies', 'Doplnit zásoby': 'Restock',

  // Profily
  'Nový profil': 'New profile',
  'Předpřipravené seznamy, které stačí jedním klepnutím vložit do nákupu. To, co máš doma v zásobách, se automaticky odškrtne.': 'Ready-made lists you can add to your shopping with one tap. Things you already have at home are unticked automatically.',
  'Žádné profily. Vytvoř nový, nebo ulož existující seznam přes ⋯ → Uložit jako profil.': 'No profiles yet. Create one, or save an existing list via ⋯ → Save as profile.',
  '{n} položek': '{n} items', ' · {n} porce': ' · {n} servings', 'Použít': 'Use',
  'Upravit profil': 'Edit profile', 'Výchozí obchod': 'Default store', '— podle seznamu —': '— same as list —',
  'Recept pro porcí': 'Recipe servings', 'Přidej položky, které v tomhle nákupu kupuješ vždycky.': 'Add the items you always buy in this shop.',
  ' (kopie)': ' (copy)', '📄 Duplikovat': '📄 Duplicate', 'Smazat profil „{name}“?': 'Delete profile “{name}”?', '🗑️ Smazat profil': '🗑️ Delete profile',
  'Přidat {n} položek': 'Add {n} items', 'Kam': 'Where', '➕ Nový seznam „{name}“': '➕ New list “{name}”',
  'Počet porcí': 'Servings', 'Doma = podle zásob': 'At home = from supplies', 'vše / nic': 'all / none', 'doma {qty}': 'at home {qty}',

  // Obchody
  'Obchod': 'Store', 'Každému obchodu nastav pořadí sekcí tak, jak jimi procházíš od vchodu k pokladnám.': 'Set each store’s section order the way you walk through it, from the entrance to the checkout.',
  '{n} sekcí': '{n} sections', 'Nový obchod': 'New store', 'např. Albert Chodov': 'e.g. Tesco Express',
  'Rozložení obchodu': 'Store layout',
  '🚪 Vchod nahoře, 🧾 pokladny dole. Přesouvej šipkami nebo přetažením (podrž ≡). Oko skryje sekci, kterou obchod nemá.': '🚪 Entrance at the top, 🧾 checkout at the bottom. Reorder with the arrows or by dragging (hold ≡). The eye hides a section the store doesn’t have.',
  'Nahoru': 'Up', 'Dolů': 'Down', 'Skrýt': 'Hide', '＋ Vlastní sekce': '＋ Custom section', '↺ Výchozí pořadí': '↺ Default order',
  'Smazat obchod „{name}“?': 'Delete store “{name}”?', '🗑️ Smazat obchod': '🗑️ Delete store', 'Nová sekce': 'New section',
  'např. Bio a zdravá výživa': 'e.g. Organic & health food', 'Upravit sekci': 'Edit section',
  'Název sekce se změní ve všech obchodech.': 'The section name changes in all stores.',

  // Nastavení
  '🌐 Jazyk': '🌐 Language', 'Jazyk platí jen pro tento telefon.': 'The language applies to this phone only.',
  '💾 Záloha': '💾 Backup', 'Přenes data do jiného zařízení nebo si je ulož pro jistotu.': 'Move your data to another device or keep it safe.',
  'Stáhnout zálohu': 'Download backup', 'Obnovit ze zálohy': 'Restore from backup',
  'Data obnovena ze zálohy': 'Data restored from backup', 'Soubor není platná záloha Nákupáku': 'This file is not a valid Nákupák backup',
  '🧠 Naučené položky': '🧠 Learned items', 'Aplikace si pamatuje {n} vlastních zařazení do sekcí.': 'The app remembers {n} of your own section assignments.',
  'Zapomenout naučená zařazení?': 'Forget learned assignments?', 'Zapomenout': 'Forget', '⚠️ Smazat vše': '⚠️ Delete everything',
  'Smaže data jen v tomto telefonu a odpojí ho od sdílení. Sdílená data na webu zůstanou.': 'Deletes data on this phone only and disconnects it from sharing. Shared data on the web stays.',
  'Smazat data v tomto telefonu a odpojit ho od sdílení?': 'Delete data on this phone and disconnect it from sharing?',
  'Opravdu smazat všechny seznamy, zásoby, profily a obchody?': 'Really delete all lists, supplies, profiles and stores?',
  'Smazat data v telefonu': 'Delete data on phone', 'Smazat všechna data': 'Delete all data',

  // Sdílení
  'Připojuji…': 'Connecting…', 'Sdíleno': 'Synced', 'Bez připojení – změny se odešlou, až bude signál': 'Offline – changes will be sent when you’re back online',
  'Kód už neplatí – zadej nový kód domácnosti': 'The code is no longer valid – enter a new household code', 'Chyba serveru': 'Server error',
  'právě teď': 'just now', 'před {n} s': '{n} s ago', 'před {n} min': '{n} min ago',
  'Propojeno – data z telefonu se nahrávají na web': 'Connected – data from this phone is being uploaded',
  'Neplatný kód. Najdeš ho ve WordPressu v Nastavení → Nákupák.': 'Invalid code. You’ll find it in WordPress under Settings → Nákupák.',
  'Nepodařilo se spojit se serverem. Jsi online?': 'Couldn’t reach the server. Are you online?',
  'Propojeno se sdílenou domácností': 'Connected to the shared household', '👪 Sdílení s domácností': '👪 Household sharing',
  'Seznamy, zásoby, profily i obchody se sdílí se všemi telefony, které mají stejný kód.': 'Lists, supplies, profiles and stores are shared with all phones that use the same code.',
  '🔄 Synchronizovat': '🔄 Sync now', 'Odpojit tento telefon od sdílení? Data v telefonu zůstanou, ale přestanou se sdílet.': 'Disconnect this phone from sharing? Data stays on the phone but stops being shared.',
  'Odpojit': 'Disconnect', 'Zadat nový kód': 'Enter new code',
  'Zadej kód domácnosti a seznamy, zásoby i profily se budou sdílet s ostatními telefony.': 'Enter a household code to share lists, supplies and profiles with other phones.',
  'Kód najdeš ve WordPressu v': 'You’ll find the code in WordPress under', 'Připojit': 'Connect',
  'Na webu už jsou sdílená data': 'There is already shared data on the web', 'Co s daty, která máš teď v tomhle telefonu?': 'What should happen to the data on this phone?',
  'Použít jen sdílená data': 'Use shared data only', 'Data v telefonu se nahradí tím, co je na webu. Doporučeno pro druhý telefon.': 'Data on this phone will be replaced with what’s on the web. Recommended for a second phone.',
  'Spojit s daty v telefonu': 'Merge with data on this phone', 'Seznamy, zásoby a profily z telefonu se přidají ke sdíleným.': 'Lists, supplies and profiles from this phone will be added to the shared ones.',
  'Příliš mnoho pokusů, zkus to za chvíli.': 'Too many attempts, please try again later.', 'Server odpověděl {n}': 'Server responded {n}',
  'Neplatná odpověď serveru – je plugin aktuální?': 'Invalid server response – is the plugin up to date?',

  // Výchozí profil
  'Rohlíky': 'Bread rolls', 'Máslo': 'Butter', 'Šunka': 'Ham', 'Vejce': 'Eggs', 'Mléko': 'Milk',
};
