<?php
/**
 * Plugin Name:       Nákupák
 * Description:       Chytrý nákupní seznam seřazený podle sekcí v obchodě, s přehledem o zásobách doma. Aplikace běží na adrese /nakupak/, domácnosti a jejich kódy pro sdílení najdeš v Nastavení → Nákupák.
 * Version:           {{VERSION}}
 * Requires at least: 5.0
 * Requires PHP:      7.0
 * Author:            Jan Pokrajac
 * License:           GPL-2.0-or-later
 * Text Domain:       nakupak
 */

if (!defined('ABSPATH')) {
    exit;
}

define('NAKUPAK_SLUG', 'nakupak');
define('NAKUPAK_DIR', plugin_dir_path(__FILE__) . 'app/');
define('NAKUPAK_URL', plugin_dir_url(__FILE__) . 'app/');
// Zvýšit při změně adres nebo databázové tabulky – projeví se i po „Nahradit stávající“,
// kdy WordPress aktivační hook nespouští.
define('NAKUPAK_SCHEMA', 3);
define('NAKUPAK_TOMBSTONE_DAYS', 30);
define('NAKUPAK_MAX_RECORD', 200000);
define('NAKUPAK_MAX_CHANGES', 10000);

function nakupak_table() {
    global $wpdb;
    return $wpdb->prefix . 'nakupak_records';
}

/* ---------------------------------------------------------------------------
 * Adresy aplikace
 * ------------------------------------------------------------------------ */

/** Adresy /nakupak/, /nakupak/sw.js, /nakupak/manifest.json a /nakupak/api obsluhuje plugin. */
function nakupak_rewrite_rules() {
    add_rewrite_rule('^' . NAKUPAK_SLUG . '/?$', 'index.php?nakupak=index', 'top');
    add_rewrite_rule('^' . NAKUPAK_SLUG . '/sw\.js$', 'index.php?nakupak=sw', 'top');
    add_rewrite_rule('^' . NAKUPAK_SLUG . '/manifest\.json$', 'index.php?nakupak=manifest', 'top');
    add_rewrite_rule('^' . NAKUPAK_SLUG . '/api/?$', 'index.php?nakupak=api', 'top');
}
add_action('init', 'nakupak_rewrite_rules');

add_filter('query_vars', function ($vars) {
    $vars[] = 'nakupak';
    return $vars;
});

/* ---------------------------------------------------------------------------
 * Instalace a aktualizace
 * ------------------------------------------------------------------------ */

function nakupak_install() {
    global $wpdb;
    // Instalace může běžet souběžně ve dvou požadavcích – změny tabulky jen pod zámkem.
    if ((int) $wpdb->get_var("SELECT GET_LOCK('nakupak_install', 10)") !== 1) {
        return;
    }
    try {
        if ((int) get_option('nakupak_schema') === NAKUPAK_SCHEMA) {
            return; // mezitím nainstaloval jiný požadavek
        }
        $table = nakupak_table();
        $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) === $table;

        if (!$exists) {
            require_once ABSPATH . 'wp-admin/includes/upgrade.php';
            $charset = $wpdb->get_charset_collate();
            dbDelta("CREATE TABLE $table (
  household bigint(20) unsigned NOT NULL DEFAULT 1,
  k varchar(191) NOT NULL,
  data longtext NULL,
  deleted tinyint(1) NOT NULL DEFAULT 0,
  rev bigint(20) unsigned NOT NULL DEFAULT 0,
  updated datetime NOT NULL,
  PRIMARY KEY  (household,k),
  KEY household_rev (household,rev),
  KEY rev (rev)
) $charset;");
        } elseif (!$wpdb->get_var("SHOW COLUMNS FROM $table LIKE 'household'")) {
            // Verze 0.2.x měla jen jednu domácnost: dosavadní data patří domácnosti č. 1.
            $wpdb->query("ALTER TABLE $table
                ADD COLUMN household bigint(20) unsigned NOT NULL DEFAULT 1 FIRST,
                DROP PRIMARY KEY,
                ADD PRIMARY KEY (household, k),
                ADD KEY household_rev (household, rev)");
        }

        add_option('nakupak_rev', '0', '', 'no');
        add_option('nakupak_purged_rev', '0', '', 'no');

        if (!is_array(get_option('nakupak_households'))) {
            // Dosavadní kód (pokud byl) zůstává platný pro první domácnost.
            $old = (string) get_option('nakupak_code');
            update_option('nakupak_households', array(
                1 => array('name' => 'Moje domácnost', 'code' => $old !== '' ? $old : nakupak_generate_code(), 'created' => current_time('mysql')),
            ), false);
            update_option('nakupak_next_household', 2, false);
            delete_option('nakupak_code');
        }

        nakupak_rewrite_rules();
        flush_rewrite_rules();
        update_option('nakupak_schema', NAKUPAK_SCHEMA);
    } finally {
        $wpdb->query("SELECT RELEASE_LOCK('nakupak_install')");
    }
}
register_activation_hook(__FILE__, 'nakupak_install');
register_deactivation_hook(__FILE__, 'flush_rewrite_rules');

add_action('init', function () {
    if ((int) get_option('nakupak_schema') !== NAKUPAK_SCHEMA) {
        nakupak_install();
    }
}, 20);

/** Kód bez zaměnitelných znaků (0/O, 1/I/L), 12 znaků ≈ 60 bitů. */
function nakupak_generate_code() {
    $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < 12; $i++) {
        $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $code;
}

function nakupak_normalize_code($code) {
    return preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $code));
}

function nakupak_format_code($code) {
    return implode('-', str_split($code, 4));
}

function nakupak_app_url() {
    return home_url('/' . NAKUPAK_SLUG . '/');
}

/* ---------------------------------------------------------------------------
 * Domácnosti: id => { name, code, created }. Každá má vlastní data v tabulce.
 * ------------------------------------------------------------------------ */

function nakupak_households() {
    $h = get_option('nakupak_households');
    return is_array($h) ? $h : array();
}

function nakupak_save_households($households) {
    update_option('nakupak_households', $households, false);
}

/** Id domácnosti podle kódu, nebo 0. Porovnává všechny kódy v konstantním čase. */
function nakupak_household_by_code($given) {
    $found = 0;
    if ($given === '') {
        return 0;
    }
    foreach (nakupak_households() as $id => $h) {
        if (hash_equals((string) $h['code'], $given)) {
            $found = (int) $id;
        }
    }
    return $found;
}

/** Nový kód, který nemá žádná jiná domácnost. */
function nakupak_unique_code() {
    $codes = wp_list_pluck(nakupak_households(), 'code');
    do {
        $code = nakupak_generate_code();
    } while (in_array($code, $codes, true));
    return $code;
}

/* ---------------------------------------------------------------------------
 * Obsluha požadavků
 * ------------------------------------------------------------------------ */

add_action('template_redirect', function () {
    $what = get_query_var('nakupak');
    if (!$what) {
        return;
    }

    // Aplikaci ani API nesmí cachovat cache pluginy.
    if (!defined('DONOTCACHEPAGE')) {
        define('DONOTCACHEPAGE', true);
    }
    nocache_headers();

    if ($what === 'api') {
        nakupak_api();
        exit;
    }

    status_header(200);

    if ($what === 'sw') {
        header('Content-Type: application/javascript; charset=utf-8');
        readfile(NAKUPAK_DIR . 'sw.js');
        exit;
    }

    if ($what === 'manifest') {
        header('Content-Type: application/manifest+json; charset=utf-8');
        echo wp_json_encode(array(
            'name'             => 'Nákupák – chytrý nákupní seznam',
            'short_name'       => 'Nákupák',
            'start_url'        => nakupak_app_url(),
            'scope'            => nakupak_app_url(),
            'display'          => 'standalone',
            'background_color' => '#f4f6f3',
            'theme_color'      => '#2e7d4f',
            'lang'             => 'cs',
            'icons'            => array(
                array('src' => NAKUPAK_URL . 'apple-touch-icon.png', 'sizes' => '180x180', 'type' => 'image/png'),
                array('src' => NAKUPAK_URL . 'icon-512.png', 'sizes' => '512x512', 'type' => 'image/png'),
            ),
        ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // Relativní cesty v aplikaci (./sw.js, ./api) potřebují adresu končící lomítkem.
    $path = wp_parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '', PHP_URL_PATH);
    if ($path && substr($path, -1) !== '/') {
        wp_safe_redirect(nakupak_app_url(), 301);
        exit;
    }

    $html = file_get_contents(NAKUPAK_DIR . 'index.html');
    // Soubory aplikace (skripty, styly, ikony) leží ve složce pluginu.
    $html = preg_replace('#(src|href)="\./(assets/|apple-touch-icon\.png|icon-512\.png)#', '$1="' . esc_url(NAKUPAK_URL) . '$2', $html);
    header('Content-Type: text/html; charset=utf-8');
    echo $html;
    exit;
});

function nakupak_json($status, $data) {
    status_header($status);
    header('Content-Type: application/json; charset=utf-8');
    echo wp_json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function nakupak_client_ip() {
    return isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
}

/**
 * Synchronizace: POST { since, changes: [{k, d}] } → { rev, full, records: [{k, d}] }.
 * Každá dávka změn dostane nové číslo revize; u stejného záznamu vyhrává poslední zápis.
 */
function nakupak_api() {
    global $wpdb;

    if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
        nakupak_json(405, array('error' => 'method'));
        return;
    }

    // Probíhá převod dat na novou verzi – telefon to za chvíli zkusí znovu (ne „neplatný kód“).
    if ((int) get_option('nakupak_schema') !== NAKUPAK_SCHEMA) {
        nakupak_json(503, array('error' => 'upgrading'));
        return;
    }

    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        nakupak_json(400, array('error' => 'bad_json'));
        return;
    }

    // Kód přichází v hlavičce; některé hostingy vlastní hlavičky zahazují, proto i v těle.
    $given = isset($_SERVER['HTTP_X_NAKUPAK_CODE']) ? $_SERVER['HTTP_X_NAKUPAK_CODE'] : '';
    if ($given === '' && isset($body['code']) && is_string($body['code'])) {
        $given = $body['code'];
    }
    $household = nakupak_household_by_code(nakupak_normalize_code($given));
    if ($household === 0) {
        // Ochrana proti hádání kódu: po 20 chybných pokusech z jedné adresy hodinu jen 429.
        // Správný kód se nikdy neblokuje (za Cloudflare apod. mívají všichni stejnou IP).
        $fail_key = 'nakupak_fail_' . md5(nakupak_client_ip());
        $fails = (int) get_transient($fail_key);
        if ($fails >= 20) {
            nakupak_json(429, array('error' => 'too_many_attempts'));
            return;
        }
        set_transient($fail_key, $fails + 1, HOUR_IN_SECONDS);
        nakupak_json(401, array('error' => 'bad_code'));
        return;
    }
    $since = isset($body['since']) ? max(0, (int) $body['since']) : 0;
    $changes = isset($body['changes']) && is_array($body['changes']) ? $body['changes'] : array();
    if (count($changes) > NAKUPAK_MAX_CHANGES) {
        nakupak_json(413, array('error' => 'too_many_changes'));
        return;
    }

    $clean = array();
    foreach ($changes as $c) {
        if (!is_array($c) || !isset($c['k']) || !is_string($c['k'])) {
            continue;
        }
        $k = $c['k'];
        if (strlen($k) > 191 || !preg_match('/^[a-z]+:./', $k)) {
            continue;
        }
        $d = array_key_exists('d', $c) ? $c['d'] : null;
        if ($d !== null && (!is_string($d) || strlen($d) > NAKUPAK_MAX_RECORD)) {
            continue;
        }
        $clean[$k] = $d; // při duplicitě platí poslední
    }

    $table = nakupak_table();
    $locked = (int) $wpdb->get_var("SELECT GET_LOCK('nakupak_sync', 10)") === 1;
    if (!$locked) {
        nakupak_json(503, array('error' => 'busy'));
        return;
    }

    try {
        // Číslo revize čteme přímo z DB, ne z cache voleb.
        $rev = (int) $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", 'nakupak_rev'));

        if ($clean) {
            $rev++;
            $now = current_time('mysql', true);
            foreach ($clean as $k => $d) {
                $wpdb->replace($table, array(
                    'household' => $household,
                    'k'         => $k,
                    'data'      => $d,
                    'deleted'   => $d === null ? 1 : 0,
                    'rev'       => $rev,
                    'updated'   => $now,
                ), array('%d', '%s', '%s', '%d', '%d', '%s'));
            }
            update_option('nakupak_rev', (string) $rev, false);
        }

        // Občas uklidit staré záznamy o smazání.
        if (wp_rand(1, 50) === 1) {
            nakupak_purge_tombstones();
        }

        $purged = (int) $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", 'nakupak_purged_rev'));
        // Revize telefonu vyšší než serverová = databáze se vrátila ze zálohy → poslat vše.
        $full = $since <= 0 || $since < $purged || $since > $rev;
        // Revize je společná pro všechny domácnosti; data se vrací jen té, které patří kód.
        if ($full) {
            $rows = $wpdb->get_results($wpdb->prepare("SELECT k, data, deleted FROM $table WHERE household = %d AND deleted = 0", $household), ARRAY_A);
        } else {
            $rows = $wpdb->get_results($wpdb->prepare("SELECT k, data, deleted FROM $table WHERE household = %d AND rev > %d", $household, $since), ARRAY_A);
        }
    } finally {
        $wpdb->query("SELECT RELEASE_LOCK('nakupak_sync')");
    }

    $records = array();
    foreach ((array) $rows as $r) {
        $records[] = array('k' => $r['k'], 'd' => (int) $r['deleted'] === 1 ? null : $r['data']);
    }
    nakupak_json(200, array('rev' => $rev, 'full' => $full, 'records' => $records));
}

/** Smaže záznamy o smazání starší než 30 dní; zařízení se starší revizí si pak stáhnou vše znovu. */
function nakupak_purge_tombstones() {
    global $wpdb;
    $table = nakupak_table();
    $cutoff = gmdate('Y-m-d H:i:s', time() - NAKUPAK_TOMBSTONE_DAYS * DAY_IN_SECONDS);
    $max = (int) $wpdb->get_var($wpdb->prepare("SELECT MAX(rev) FROM $table WHERE deleted = 1 AND updated < %s", $cutoff));
    if ($max > 0) {
        $wpdb->query($wpdb->prepare("DELETE FROM $table WHERE deleted = 1 AND rev <= %d AND updated < %s", $max, $cutoff));
        $purged = (int) get_option('nakupak_purged_rev', 0);
        update_option('nakupak_purged_rev', (string) max($purged, $max), false);
    }
}

/* ---------------------------------------------------------------------------
 * Administrace: Nastavení → Nákupák
 * ------------------------------------------------------------------------ */

add_action('admin_menu', function () {
    add_options_page('Nákupák', 'Nákupák', 'manage_options', 'nakupak', 'nakupak_admin_page');
});

/** Smaže data jedné domácnosti; telefony si při další synchronizaci stáhnou prázdný stav. */
function nakupak_wipe_household($id) {
    global $wpdb;
    $table = nakupak_table();
    $wpdb->query($wpdb->prepare("DELETE FROM $table WHERE household = %d", $id));
    // Revizi nezahazujeme – telefony díky „purged“ dostanou úplný (prázdný) stav.
    $rev = (int) get_option('nakupak_rev', 0) + 1;
    update_option('nakupak_rev', (string) $rev, false);
    update_option('nakupak_purged_rev', (string) $rev, false);
}

function nakupak_admin_page() {
    global $wpdb;
    if (!current_user_can('manage_options')) {
        return;
    }
    $table = nakupak_table();
    $notice = '';
    $households = nakupak_households();

    if (isset($_POST['nakupak_action']) && check_admin_referer('nakupak_admin')) {
        $action = sanitize_key(wp_unslash($_POST['nakupak_action']));
        $id = isset($_POST['household']) ? (int) $_POST['household'] : 0;
        $name = isset($_POST['name']) ? trim(sanitize_text_field(wp_unslash($_POST['name']))) : '';

        if ($action === 'add') {
            $next = max((int) get_option('nakupak_next_household', 2), $households ? max(array_keys($households)) + 1 : 1);
            $households[$next] = array('name' => $name !== '' ? $name : 'Domácnost ' . $next, 'code' => nakupak_unique_code(), 'created' => current_time('mysql'));
            update_option('nakupak_next_household', $next + 1, false);
            nakupak_save_households($households);
            $notice = 'Domácnost „' . $households[$next]['name'] . '“ je vytvořená. Kód najdeš v tabulce níže.';
        } elseif (isset($households[$id])) {
            $label = $households[$id]['name'];
            if ($action === 'rename' && $name !== '') {
                $households[$id]['name'] = $name;
                nakupak_save_households($households);
                $notice = 'Jméno uloženo: „' . $name . '“.';
            } elseif ($action === 'new_code') {
                $households[$id]['code'] = nakupak_unique_code();
                nakupak_save_households($households);
                $notice = 'Domácnost „' . $label . '“ má nový kód. Je potřeba ho znovu zadat v jejích telefonech.';
            } elseif ($action === 'wipe') {
                nakupak_wipe_household($id);
                $notice = 'Data domácnosti „' . $label . '“ byla smazána.';
            } elseif ($action === 'delete') {
                nakupak_wipe_household($id);
                unset($households[$id]);
                nakupak_save_households($households);
                $notice = 'Domácnost „' . $label . '“ i její data byly smazány. Její kód už neplatí.';
            }
        }
    }

    $stats = array();
    foreach ((array) $wpdb->get_results("SELECT household, COUNT(*) AS n, COALESCE(SUM(LENGTH(data)), 0) AS bytes FROM $table WHERE deleted = 0 GROUP BY household", ARRAY_A) as $row) {
        $stats[(int) $row['household']] = $row;
    }
    $code_style = 'font-family:monospace;font-size:18px;font-weight:bold;letter-spacing:.1em;user-select:all;white-space:nowrap;';
    ?>
    <div class="wrap">
        <h1>Nákupák</h1>
        <?php if ($notice) : ?>
            <div class="notice notice-success"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>

        <p>Aplikace: <a href="<?php echo esc_url(nakupak_app_url()); ?>" target="_blank"><?php echo esc_html(nakupak_app_url()); ?></a></p>

        <h2>Domácnosti</h2>
        <p>Každá domácnost má vlastní kód a vlastní data. Telefony se stejným kódem sdílí seznamy, zásoby, profily i obchody;
            různé domácnosti svá data navzájem nevidí. Kód se zadává v aplikaci v <strong>Nastavení → Sdílení s domácností</strong>.</p>

        <table class="widefat striped" style="max-width:1100px;">
            <thead>
                <tr><th style="width:34%;">Komu kód patří</th><th>Kód domácnosti</th><th>Data</th><th>Správa</th></tr>
            </thead>
            <tbody>
            <?php foreach ($households as $id => $h) :
                $s = isset($stats[$id]) ? $stats[$id] : array('n' => 0, 'bytes' => 0);
                $kb = round(((int) $s['bytes']) / 1024, 1); ?>
                <tr>
                    <td>
                        <form method="post" style="display:flex;gap:6px;">
                            <?php wp_nonce_field('nakupak_admin'); ?>
                            <input type="hidden" name="nakupak_action" value="rename">
                            <input type="hidden" name="household" value="<?php echo (int) $id; ?>">
                            <input type="text" name="name" value="<?php echo esc_attr($h['name']); ?>" class="regular-text" style="flex:1;min-width:0;" aria-label="Komu kód patří">
                            <?php submit_button('Uložit', 'secondary', 'submit', false); ?>
                        </form>
                    </td>
                    <td><span style="<?php echo esc_attr($code_style); ?>"><?php echo esc_html(nakupak_format_code($h['code'])); ?></span></td>
                    <td><?php echo (int) $s['n']; ?> záznamů<br><span class="description"><?php echo esc_html(number_format_i18n($kb, 1)); ?> kB</span></td>
                    <td>
                        <form method="post" style="display:inline;" onsubmit="return confirm('Vytvořit pro tuto domácnost nový kód? Její telefony se odpojí a kód bude potřeba zadat znovu.');">
                            <?php wp_nonce_field('nakupak_admin'); ?>
                            <input type="hidden" name="nakupak_action" value="new_code">
                            <input type="hidden" name="household" value="<?php echo (int) $id; ?>">
                            <?php submit_button('Nový kód', 'small', 'submit', false); ?>
                        </form>
                        <form method="post" style="display:inline;" onsubmit="return confirm('Smazat všechna data této domácnosti? Kód zůstane platný. Tuto akci nelze vrátit.');">
                            <?php wp_nonce_field('nakupak_admin'); ?>
                            <input type="hidden" name="nakupak_action" value="wipe">
                            <input type="hidden" name="household" value="<?php echo (int) $id; ?>">
                            <?php submit_button('Smazat data', 'small', 'submit', false); ?>
                        </form>
                        <form method="post" style="display:inline;" onsubmit="return confirm('Smazat celou domácnost včetně dat? Její kód přestane platit. Tuto akci nelze vrátit.');">
                            <?php wp_nonce_field('nakupak_admin'); ?>
                            <input type="hidden" name="nakupak_action" value="delete">
                            <input type="hidden" name="household" value="<?php echo (int) $id; ?>">
                            <?php submit_button('Smazat domácnost', 'delete small', 'submit', false); ?>
                        </form>
                    </td>
                </tr>
            <?php endforeach; ?>
            <?php if (!$households) : ?>
                <tr><td colspan="4">Zatím žádná domácnost.</td></tr>
            <?php endif; ?>
            </tbody>
        </table>

        <h2 style="margin-top:28px;">Přidat domácnost</h2>
        <form method="post" style="display:flex;gap:8px;align-items:center;">
            <?php wp_nonce_field('nakupak_admin'); ?>
            <input type="hidden" name="nakupak_action" value="add">
            <input type="text" name="name" class="regular-text" placeholder="Komu kód patří, např. Ondřej Pešek" required>
            <?php submit_button('Vytvořit domácnost a kód', 'primary', 'submit', false); ?>
        </form>
        <p class="description">Kód je jako heslo – dej ho jen lidem, kteří mají sdílet data dané domácnosti. Staré smazané položky se uklízí automaticky.</p>
    </div>
    <?php
}

// Na stránce pluginů odkazy „Otevřít aplikaci“ a „Kód domácnosti“.
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    array_unshift(
        $links,
        '<a href="' . esc_url(nakupak_app_url()) . '" target="_blank">Otevřít aplikaci</a>',
        '<a href="' . esc_url(admin_url('options-general.php?page=nakupak')) . '">Domácnosti a kódy</a>'
    );
    return $links;
});

// Upozornění, když web používá „jednoduché“ odkazy – pak adresa /nakupak/ nefunguje.
add_action('admin_notices', function () {
    if (get_option('permalink_structure') || !current_user_can('manage_options')) {
        return;
    }
    echo '<div class="notice notice-warning"><p><strong>Nákupák:</strong> aby fungovala adresa <code>/nakupak/</code>, '
        . 'nastav v <a href="' . esc_url(admin_url('options-permalink.php')) . '">Nastavení → Trvalé odkazy</a> jinou volbu než „Výchozí“.</p></div>';
});
