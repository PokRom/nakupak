# Instalace

Nákupák se dá provozovat dvěma způsoby:

| Způsob | Sdílení mezi telefony | Co potřebujete |
|---|---|---|
| **A. WordPress plugin** (doporučeno) | ✅ ano | web s WordPressem, kam můžete nahrát plugin |
| **B. Statické soubory** | ❌ ne, data jsou jen v telefonu | libovolný webhosting s přístupem přes FTP |

## Požadavky

**Pro plugin (způsob A):**

- WordPress 5.0 nebo novější s vlastním hostingem. Na WordPress.com jdou pluginy nahrát jen
  ve vyšších tarifech.
- PHP 7.0 nebo novější, databáze MySQL nebo MariaDB (běžné u každého hostingu WordPressu).
- **HTTPS.** Bez něj nefunguje offline režim ani nezhasínání displeje při nákupu.
- **Trvalé odkazy** jiné než „Výchozí“ (Nastavení → Trvalé odkazy). Plugin na to sám upozorní.

**Pro sestavení ze zdrojového kódu:**

- [Node.js](https://nodejs.org/) 20.11 nebo novější.
- Pro `npm run plugin`: ve Windows 10+ a na macOS stačí vestavěný `tar`, na Linuxu je
  potřeba program `zip`.

---

## A. WordPress plugin

### 1. Získejte ZIP pluginu

- **Hotový:** stáhněte `nakupak-wordpress-plugin.zip` ze stránky Releases tohoto repozitáře,
- **nebo** si ho [sestavte ze zdrojového kódu](#sestavení-ze-zdrojového-kódu).

### 2. Nahrajte plugin

1. Ve správě WordPressu otevřete **Pluginy → Přidat nový**.
2. Nahoře klepněte na **Nahrát plugin**, vyberte ZIP a klepněte na **Instalovat**.
3. Klepněte na **Aktivovat**.

Plugin při aktivaci vytvoří databázovou tabulku, vygeneruje kód domácnosti a zaregistruje
adresu `/nakupak/`.

### 3. Otevřete aplikaci

Aplikace běží na **`https://váš-web.cz/nakupak/`**. Odkaz *Otevřít aplikaci* najdete i v seznamu
pluginů u Nákupáku.

### 4. Kód domácnosti

Ve WordPressu v **Nastavení → Nákupák** je kód domácnosti (např. `K7QM-3XWP-H9TD`). Kdo ho
zadá v aplikaci v Nastavení, sdílí s ostatními seznamy, lednici, profily i obchody. Postup pro
uživatele je v [uživatelské příručce](UZIVATELSKA-PRIRUCKA.md#sdílení-s-domácností).

Na stejné stránce je také:

- velikost uložených dat,
- **Vytvořit nový kód:** starý kód přestane platit a telefony je potřeba připojit znovu,
- **Smazat sdílená data:** smaže data na webu a při příští synchronizaci i v připojených telefonech.

### Co plugin na webu změní

- Přidá adresy `/nakupak/`, `/nakupak/api`, `/nakupak/sw.js` a `/nakupak/manifest.json`.
  Zbytek webu se nezmění.
- Vytvoří tabulku `{prefix}nakupak_records` a volby `nakupak_code`, `nakupak_rev`,
  `nakupak_purged_rev` a `nakupak_schema`.
- Do vzhledu webu ani do jeho stránek nezasahuje. Stránka aplikace je skrytá před vyhledávači.

### Aktualizace

1. Nahrajte nový ZIP stejně jako při instalaci.
2. WordPress nabídne **Nahradit stávající**, potvrďte.

Data se **nesmažou**. Leží v databázi, a ne v souborech pluginu. Telefon načte novou verzi,
až aplikaci zavřete a znovu otevřete.

### Odinstalace

Deaktivace a smazání pluginu **sdílená data nesmaže**, aby nedošlo k nechtěné ztrátě. Pokud je
chcete odstranit, před smazáním pluginu klepněte v Nastavení → Nákupák na **Smazat sdílená
data**, případně v databázi smažte tabulku `{prefix}nakupak_records` a volby `nakupak_*`.

---

## B. Statické soubory (bez sdílení)

1. [Sestavte aplikaci](#sestavení-ze-zdrojového-kódu) příkazem `npm run build`.
2. Celý obsah složky `dist/` **včetně skrytého souboru `.htaccess`** nahrajte přes FTP nebo
   správce souborů hostingu do podsložky webu, např. `public_html/nakupak/`.
3. Aplikace poběží na `https://váš-web.cz/nakupak/`.

Aplikace používá relativní cesty, takže funguje v libovolné podsložce. Data zůstávají jen
v prohlížeči daného telefonu a sekce Sdílení v Nastavení se nepřipojí, protože chybí
serverová část.

---

## Sestavení ze zdrojového kódu

```bash
git clone https://github.com/PokRom/nakupak.git
cd nakupak
npm install
```

| Příkaz | Co dělá |
|---|---|
| `npm run dev` | Vývojový server s automatickým obnovováním. Adresa `Network:` funguje i z telefonu ve stejné Wi-Fi. Sdílení zde nefunguje. |
| `npm run build` | Sestaví aplikaci do složky `dist/` |
| `npm run plugin` | Sestaví aplikaci a zabalí ji do `nakupak-wordpress-plugin.zip` |
| `npm test` | Spustí testy synchronizace (simulace dvou telefonů) |
| `npm run mock` | Testovací server se stejným API jako plugin, bez potřeby WordPressu (nejdřív `npm run build`) |

### Vyzkoušení sdílení bez WordPressu

```bash
npm run build
npm run mock
```

- „Telefon 1“: `http://localhost:5182/nakupak/`
- „Telefon 2“: `http://127.0.0.1:5182/nakupak/` (jiná adresa znamená jiné úložiště prohlížeče)
- Kód domácnosti: `TEST-TEST-TEST`. Jiný kód lze zadat parametrem:
  `node scripts/mock-server.mjs 5182 MUJ-KOD`.

Testovací server drží data jen v paměti a po vypnutí je zapomene.

### Nové číslo verze

Verze pluginu se bere z `package.json` (`"version"`). Před vydáním nové verze ji zvyšte, aby
WordPress při nahrání ukázal, že jde o novější verzi.

---

## Řešení problémů

| Problém | Řešení |
|---|---|
| Na `/nakupak/` je „Stránka nenalezena“ | Nastavení → Trvalé odkazy: zvolte jinou možnost než „Výchozí“ a uložte. Uložení zároveň obnoví adresy pluginu. |
| Ve WordPressu chybí „Nahrát plugin“ | Web běží na WordPress.com v tarifu bez pluginů, nebo nemáte roli administrátora. |
| Aplikace hlásí „Neplatný kód“ | Kód opište ze stránky Nastavení → Nákupák. Na pomlčkách a velikosti písmen nezáleží. |
| Aplikace hlásí „Příliš mnoho pokusů“ | Z vaší IP adresy přišlo 20 špatných kódů za hodinu. Počkejte hodinu, správný kód ale funguje vždy. |
| Ukazuje se stará verze | Zavřete aplikaci úplně (na iPhonu ji vytáhněte z přepínače aplikací) a otevřete znovu. Pokud používáte cache plugin, vyprázdněte jeho mezipaměť. |
| „Chyba serveru“ nebo „Neplatná odpověď serveru“ | Nějaký bezpečnostní plugin nebo firewall hostingu může blokovat požadavky na `/nakupak/api`. Zkuste ho dočasně vypnout, případně adresu povolte. |
| Telefon neukládá data | Soukromé (anonymní) okno prohlížeče data po zavření maže. Používejte běžné okno nebo zástupce na ploše. |
