import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchWithUA } from './http.mjs';
import { isAllowedIconUrl, isValidSlug } from './parse.mjs';

// Download hero icons to public/icons/<slug>.webp (local cache, no CDN hotlinking).
// Exported so data-update.mjs can call it in-process (no shell, no execSync).
// Also runs on its own:
//   node ./scripts/cache-icons.mjs [slug...] (no args = every icon not cached yet)
const ICON_DIR = './public/icons';
const DATA_FILE = './data/heroes.json';

// RIFF....WEBP magic — a remote body is only written when it really is a webp.
const isWebp = (buf) =>
  buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';

export async function cacheIcons({ only = [], dir = ICON_DIR, file = DATA_FILE, log = console.log } = {}) {
  const requested = new Set(only);
  const heroes = JSON.parse(fs.readFileSync(file, 'utf8'));
  const base = path.resolve(dir);
  fs.mkdirSync(base, { recursive: true });

  const targets = heroes.filter((h) => (!requested.size || requested.has(h.id)) && h.icon?.startsWith('http'));
  let ok = 0;
  const fail = [];
  for (const h of targets) {
    // Guard: id becomes a filename, so it must never contain a path separator.
    if (!isValidSlug(h.id)) {
      fail.push(`${h.id}(slug-invalid)`);
      continue;
    }
    const dest = path.resolve(base, `${h.id}.webp`);
    if (!dest.startsWith(base + path.sep)) {
      fail.push(`${h.id}(path-escape)`);
      continue;
    }
    if (!requested.size && fs.existsSync(dest)) {
      h.icon = `/icons/${h.id}.webp`;
      continue;
    }
    // Guard: remote HTML picked this URL, so only the expected image proxy is fetched.
    if (!isAllowedIconUrl(h.icon)) {
      fail.push(`${h.id}(host-invalid)`);
      continue;
    }
    try {
      const res = await fetchWithUA(h.icon.replace('w=64', 'w=128'));
      if (!res.ok) throw new Error(`http ${res.status}`);
      const type = res.headers.get('content-type') ?? '';
      if (!type.startsWith('image/')) throw new Error(`bukan image: ${type}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!isWebp(buf)) throw new Error('bukan webp');
      fs.writeFileSync(dest, buf);
      h.icon = `/icons/${h.id}.webp`;
      ok++;
    } catch {
      fail.push(h.id);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  fs.writeFileSync(file, JSON.stringify(heroes));
  log(`cache: ${ok} unduh, ${targets.length - ok - fail.length} sudah ada, total ${heroes.length}`);
  log('gagal:', fail.join(',') || 'none');
  return { ok, fail };
}

// CLI entry: only when this file is the process entry point.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await cacheIcons({ only: process.argv.slice(2) });
}
