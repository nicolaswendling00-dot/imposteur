// Vérifie la base de paires : nombre, doublons, paires identiques.
// Usage : node outils/verifier.mjs
import { readFileSync } from 'node:fs';

const base = JSON.parse(readFileSync(new URL('../data/paires.json', import.meta.url), 'utf8'));
const vues = new Map();
let total = 0, erreurs = 0;
const cle = m => m.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

for (const t of base.themes) {
  for (const p of t.paires) {
    total++;
    if (p.length !== 2 || !p[0] || !p[1]) { console.log(`✗ ${t.id} : paire mal formée`, p); erreurs++; continue; }
    if (cle(p[0]) === cle(p[1])) { console.log(`✗ ${t.id} : mots identiques`, p); erreurs++; }
    const k = [cle(p[0]), cle(p[1])].sort().join(' | ');
    if (vues.has(k)) { console.log(`✗ doublon : ${p.join(' / ')} (${vues.get(k)} et ${t.id})`); erreurs++; }
    vues.set(k, t.id);
  }
  console.log(`${t.emoji} ${t.nom.padEnd(22)} ${t.paires.length}`);
}
console.log(`\nTotal : ${total} paires, ${erreurs} erreur(s)`);
process.exit(erreurs ? 1 : 0);
