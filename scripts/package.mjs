// Zips the built extension (dist/) for upload to the Chrome Web Store: manifest.json at the root of the zip.
// Output: release/<package name>-<manifest version>.zip. Run via `npm run package` (builds first).

import { zipSync } from 'fflate';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const releaseDir = path.join(root, 'release');

const manifestPath = path.join(dist, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('dist/manifest.json not found. Run `npm run build` first.');
  process.exit(1);
}
const { version } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const { name } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const debugSource = fs.readFileSync(path.join(root, 'src/shared/debug.ts'), 'utf8');
if (/DEBUG\s*=\s*true/.test(debugSource)) {
  console.warn('Warning: DEBUG is true in src/shared/debug.ts, so the package will log to the console.');
}

/** Every file under dir as { "relative/posix/path": bytes }. */
function collect(dir, prefix = '') {
  const files = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(files, collect(full, rel));
    else files[rel] = fs.readFileSync(full);
  }
  return files;
}

const files = collect(dist);
const zip = zipSync(files, { level: 9 });
fs.mkdirSync(releaseDir, { recursive: true });
const out = path.join(releaseDir, `${name}-${version}.zip`);
fs.writeFileSync(out, zip);

console.log(`Packed ${Object.keys(files).length} files into ${path.relative(root, out)} (${(zip.length / 1024).toFixed(1)} KB)`);
