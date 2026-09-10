import fs from 'node:fs';
import path from 'node:path';

// Unduh ikon hero ke public/icons/<slug>.webp (cache lokal, tanpa hotlink CDN).
// Dipanggil dari data-update.mjs untuk hero baru; bisa jalan mandiri:
//   node ./scripts/cache-icons.mjs [slug...] (tanpa arg = semua yg belum ada)
const heroes = JSON.parse(fs.readFileSync('./data/heroes.json', 'utf8'));
const dir = './public/icons';
fs.mkdirSync(dir, { recursive: true });

const only = new Set(process.argv.slice(2));
const targets = heroes.filter((h) => (!only.size || only.has(h.id)) && h.icon?.startsWith('http'));
let ok = 0;
const fail = [];
for (const h of targets) {
  const dest = path.join(dir, `${h.id}.webp`);
  if (!only.size && fs.existsSync(dest)) {
    h.icon = `/icons/${h.id}.webp`;
    continue;
  }
    try {
    const res = await fetch(h.icon.replace('w=64', 'w=128'), { headers: { 'User-Agent': 'mlbb-draft/1.0' } });
    if (!res.ok) throw new Error('http ' + res.status);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    h.icon = `/icons/${h.id}.webp`;
    ok++;
  } catch { fail.push(h.id); }
  await new Promise((r) => setTimeout(r, 150));
}
fs.writeFileSync('./data/heroes.json', JSON.stringify(heroes));
console.log(`cache: ${ok} unduh, ${targets.length - ok - fail.length} sudah ada, total ${heroes.length}`);
console.log('gagal:', fail.join(',') || 'none');
