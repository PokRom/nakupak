// Sestaví WordPress plugin: wp-plugin/nakupak.php + dist/ → nakupak-wordpress-plugin.zip
// Použití: npm run plugin
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const work = path.join(tmpdir(), 'nakupak-plugin-build');
const pluginDir = path.join(work, 'nakupak');
const zip = path.join(root, 'nakupak-wordpress-plugin.zip');

rmSync(work, { recursive: true, force: true });
mkdirSync(pluginDir, { recursive: true });

const php = readFileSync(path.join(root, 'wp-plugin', 'nakupak.php'), 'utf8').replace('{{VERSION}}', version);
writeFileSync(path.join(pluginDir, 'nakupak.php'), php);
// .htaccess z dist/ do pluginu nepatří – adresy obsluhuje PHP.
cpSync(path.join(root, 'dist'), path.join(pluginDir, 'app'), { recursive: true, filter: (src) => !src.endsWith('.htaccess') });

rmSync(zip, { force: true });
// ZIP musí mít v cestách dopředná lomítka, jinak ho WordPress špatně rozbalí.
if (process.platform === 'win32') {
  // Systémový bsdtar (Windows 10+), ne GNU tar z Git Bash – ten ZIP neumí.
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  execFileSync(tar, ['-a', '-c', '-f', zip, 'nakupak'], { cwd: work, stdio: 'inherit' });
} else if (process.platform === 'darwin') {
  execFileSync('tar', ['-a', '-c', '-f', zip, 'nakupak'], { cwd: work, stdio: 'inherit' });
} else {
  // Linux: GNU tar ZIP neumí, použijeme program zip.
  execFileSync('zip', ['-r', '-q', zip, 'nakupak'], { cwd: work, stdio: 'inherit' });
}
console.log(`OK ${path.relative(root, zip)} (verze ${version})`);
