<?php
/**
 * Plugin Name:       Nákupák
 * Description:       Chytrý nákupní seznam seřazený podle sekcí v obchodě, s přehledem o zásobách doma. Aplikace běží na adrese /nakupak/, kód domácnosti pro sdílení najdeš v Nastavení → Nákupák.
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
define('NAKUPAK_SCHEMA', 2);
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
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $table = nakupak_table();
    $charset = $wpdb->get_charset_collate();
    dbDelta("CREATE TABLE $table (
  k varchar(191) NOT NULL,
  data longtext NULL,
  deleted tinyint(1) NOT NULL DEFAULT 0,
  rev bigint(20) unsigned NOT NULL DEFAULT 0,
  updated datetime NOT NULL,
  PRIMARY KEY  (k),
  KEY rev (rev)
) $charset;");

    add_option('nakupak_rev', '0', '', 'no');
    add_option('nakupak_purged_rev', '0', '', 'no');
    if (!get_option('nakupak_code')) {
        update_option('nakupak_code', nakupak_generate_code(), false);
    }
    nakupak_rewrite_rules();
    flush_rewrite_rules();
    update_option('nakupak_schema', NAKUPAK_SCHEMA);
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
    $given = nakupak_normalize_code($given);
    $code = (string) get_option('nakupak_code');
    if ($code === '' || $given === '' || !hash_equals($code, $given)) {
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
                    'k'       => $k,
                    'data'    => $d,
                    'deleted' => $d === null ? 1 : 0,
                    'rev'     => $rev,
                    'updated' => $now,
                ), array('%s', '%s', '%d', '%d', '%s'));
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
        if ($full) {
            $rows = $wpdb->get_results("SELECT k, data, deleted FROM $table WHERE deleted = 0", ARRAY_A);
        } else {
            $rows = $wpdb->get_results($wpdb->prepare("SELECT k, data, deleted FROM $table WHERE rev > %d", $since), ARRAY_A);
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

function nakupak_admin_page() {
    global $wpdb;
    if (!current_user_can('manage_options')) {
        return;
    }
    $table = nakupak_table();
    $notice = '';

    if (isset($_POST['nakupak_action']) && check_admin_referer('nakupak_admin')) {
        $action = sanitize_key(wp_unslash($_POST['nakupak_action']));
        if ($action === 'new_code') {
            update_option('nakupak_code', nakupak_generate_code(), false);
            $notice = 'Vytvořen nový kód. Zadej ho znovu ve všech telefonech (Nastavení → Sdílení).';
        } elseif ($action === 'wipe') {
            $wpdb->query("DELETE FROM $table");
            // Revizi nezahazujeme – telefony si díky „purged“ stáhnou nový (prázdný) stav.
            $rev = (int) get_option('nakupak_rev', 0) + 1;
            update_option('nakupak_rev', (string) $rev, false);
            update_option('nakupak_purged_rev', (string) $rev, false);
            $notice = 'Sdílená data byla smazána. Telefony si při příští synchronizaci ponechají jen nové změny.';
        }
    }

    $code = (string) get_option('nakupak_code');
    $stats = $wpdb->get_row("SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)), 0) AS bytes FROM $table WHERE deleted = 0", ARRAY_A);
    $kb = $stats ? round(((int) $stats['bytes']) / 1024, 1) : 0;
    ?>
    <div class="wrap">
        <h1>Nákupák</h1>
        <?php if ($notice) : ?>
            <div class="notice notice-success"><p><?php echo esc_html($notice); ?></p></div>
        <?php endif; ?>

        <p>Aplikace: <a href="<?php echo esc_url(nakupak_app_url()); ?>" target="_blank"><?php echo esc_html(nakupak_app_url()); ?></a></p>

        <h2>Kód domácnosti</h2>
        <p>Zadej ho v aplikaci v <strong>Nastavení → Sdílení s domácností</strong>. Všechny telefony se stejným kódem sdílí seznamy, lednici, profily i obchody.</p>
        <p style="font-family:monospace;font-size:28px;font-weight:bold;letter-spacing:.12em;background:#fff;border:1px solid #ccd0d4;display:inline-block;padding:12px 20px;border-radius:6px;user-select:all;">
            <?php echo esc_html(nakupak_format_code($code)); ?>
        </p>
        <p class="description">Kód je jako heslo – dej ho jen lidem, se kterými chceš seznamy sdílet.</p>

        <h2>Uložená data</h2>
        <p><?php echo (int) ($stats ? $stats['n'] : 0); ?> záznamů, celkem <?php echo esc_html(number_format_i18n($kb, 1)); ?> kB. Staré smazané položky se uklízí automaticky.</p>

        <h2>Správa</h2>
        <form method="post" style="display:inline-block;margin-right:12px;" onsubmit="return confirm('Vytvořit nový kód? Telefony se starým kódem se odpojí a kód bude potřeba zadat znovu.');">
            <?php wp_nonce_field('nakupak_admin'); ?>
            <input type="hidden" name="nakupak_action" value="new_code">
            <?php submit_button('Vytvořit nový kód', 'secondary', 'submit', false); ?>
        </form>
        <form method="post" style="display:inline-block;" onsubmit="return confirm('Opravdu smazat všechna sdílená data na webu? Tuto akci nelze vrátit.');">
            <?php wp_nonce_field('nakupak_admin'); ?>
            <input type="hidden" name="nakupak_action" value="wipe">
            <?php submit_button('Smazat sdílená data', 'delete', 'submit', false); ?>
        </form>
    </div>
    <?php
}

// Na stránce pluginů odkazy „Otevřít aplikaci“ a „Kód domácnosti“.
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    array_unshift(
        $links,
        '<a href="' . esc_url(nakupak_app_url()) . '" target="_blank">Otevřít aplikaci</a>',
        '<a href="' . esc_url(admin_url('options-general.php?page=nakupak')) . '">Kód domácnosti</a>'
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
