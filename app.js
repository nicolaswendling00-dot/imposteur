// Imposteur — jeu de l'imposteur sur un seul téléphone.
// Tout l'état tient dans S, sauvegardé dans localStorage à chaque rendu (une partie survit à un rechargement).
'use strict';

const CLE_STOCKAGE = 'imposteur-v1';
const MIN_JOUEURS = 3;
const MAX_JOUEURS = 20;
const EMOJIS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🐯', '🐷', '🐰', '🐻', '🐨', '🦁', '🐮', '🐔', '🐧', '🦄', '🐙', '🐢', '🦉', '🐝'];
const COULEURS = ['#FFD23F', '#FF7EB6', '#5CC8FF', '#3DDC97', '#FF9F43', '#B9A8FF', '#FF8A8A', '#9BE15D'];
const POINTS = { civil: 2, imposteur: 10, white: 6 };
const ROLES = {
  civil: { nom: 'Civil', emoji: '🙂', article: 'un Civil' },
  imposteur: { nom: 'Imposteur', emoji: '🕵️', article: 'un Imposteur' },
  white: { nom: 'Mr. White', emoji: '🎩', article: 'Mr. White' }
};

let BASE = null;           // { themes: [...] } chargé depuis data/paires.json
let S = charger();

function etatParDefaut() {
  return {
    joueurs: [],
    reglages: { imposteurs: 1, white: 0, whiteCommence: false, vote: 'secret', themes: null },
    scores: {},
    utilisees: [],
    partie: null
  };
}

function charger() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_STOCKAGE));
    if (brut && Array.isArray(brut.joueurs)) {
      const d = etatParDefaut();
      return { ...d, ...brut, reglages: { ...d.reglages, ...brut.reglages } };
    }
  } catch (e) { /* stockage indisponible : on repart de zéro */ }
  return etatParDefaut();
}

function sauver() {
  try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(S)); } catch (e) { /* mode privé */ }
}

// ---------- Utilitaires ----------
const $app = document.getElementById('app');
const $modale = document.getElementById('modale');

function esc(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hasard(n) { return Math.floor(Math.random() * n); }
function melanger(t) {
  const a = t.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = hasard(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function normaliser(m) {
  return m.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/^(le|la|les|un|une|des|du|de la|l')\s*/, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, '');
}
function avatar(j, taille = '') {
  return `<span class="avatar ${taille}" style="--c:${j.couleur}">${j.emoji}</span>`;
}
function toast(texte) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = texte;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function vibrer(ms = 15) { try { navigator.vibrate?.(ms); } catch (e) { /* ignoré */ } }

// Avatars stables : liés à la position du joueur dans la liste d'accueil.
function identite(i) { return { emoji: EMOJIS[i % EMOJIS.length], couleur: COULEURS[i % COULEURS.length] }; }

// ---------- Réglages : bornes ----------
function maxInfiltres(n) { return Math.max(1, Math.ceil(n / 2) - 1); }   // il faut plus de civils que d'infiltrés
function corrigerReglages() {
  const r = S.reglages;
  const n = S.joueurs.length;
  const max = maxInfiltres(Math.max(n, MIN_JOUEURS));
  r.imposteurs = Math.max(0, Math.min(r.imposteurs, max));
  r.white = Math.max(0, Math.min(r.white, max - r.imposteurs));
  if (r.imposteurs + r.white === 0) r.imposteurs = 1;
}

// ---------- Tirage des mots ----------
function themesActifs() {
  const tous = BASE.themes.map(t => t.id);
  const choisis = (S.reglages.themes || tous).filter(id => tous.includes(id));
  return choisis.length ? choisis : tous;
}

function tirerPaire() {
  const actifs = themesActifs();
  let candidats = [];
  for (const t of BASE.themes) {
    if (!actifs.includes(t.id)) continue;
    t.paires.forEach((p, i) => candidats.push({ cle: `${t.id}:${i}`, paire: p, theme: t }));
  }
  let libres = candidats.filter(c => !S.utilisees.includes(c.cle));
  if (!libres.length) {
    // Toutes les paires de ces thèmes ont servi : on les remet en jeu.
    const cles = new Set(candidats.map(c => c.cle));
    S.utilisees = S.utilisees.filter(k => !cles.has(k));
    libres = candidats;
  }
  const choix = libres[hasard(libres.length)];
  S.utilisees.push(choix.cle);
  if (S.utilisees.length > 2000) S.utilisees = S.utilisees.slice(-1500);
  // Le mot des civils et celui de l'imposteur sont inversés une fois sur deux.
  const [a, b] = Math.random() < 0.5 ? choix.paire : [choix.paire[1], choix.paire[0]];
  return { civil: a, imposteur: b, theme: choix.theme.nom };
}

// ---------- Partie ----------
function nouvellePartie() {
  corrigerReglages();
  const r = S.reglages;
  const n = S.joueurs.length;
  const roles = melanger([
    ...Array(r.imposteurs).fill('imposteur'),
    ...Array(r.white).fill('white'),
    ...Array(n - r.imposteurs - r.white).fill('civil')
  ]);
  const mots = tirerPaire();
  S.partie = {
    motCivil: mots.civil,
    motImposteur: mots.imposteur,
    theme: mots.theme,
    joueurs: S.joueurs.map((nom, i) => ({ nom, role: roles[i], vivant: true, ...identite(i) })),
    ecran: 'distribution',
    distrib: 0,
    montre: false,
    manche: 0,
    ordre: [],
    vote: null,
    elimine: null,
    devine: null,
    gagnant: null,
    gains: null
  };
  afficher();
}

function vivants() { return S.partie.joueurs.map((j, i) => i).filter(i => S.partie.joueurs[i].vivant); }

function nouvelleManche() {
  const P = S.partie;
  P.manche++;
  const v = vivants();
  // Ordre de parole : on garde l'ordre de la table, à partir d'un joueur tiré au sort.
  let departs = v;
  if (!S.reglages.whiteCommence) {
    const sansWhite = v.filter(i => P.joueurs[i].role !== 'white');
    if (sansWhite.length) departs = sansWhite;
  }
  const premier = departs[hasard(departs.length)];
  const k = v.indexOf(premier);
  P.ordre = [...v.slice(k), ...v.slice(0, k)];
  P.ecran = 'debat';
  P.vote = null;
  P.elimine = null;
  P.devine = null;
  afficher();
}

function motDe(j) {
  const P = S.partie;
  if (j.role === 'white') return null;
  return j.role === 'civil' ? P.motCivil : P.motImposteur;
}

function demarrerVote(candidats) {
  const P = S.partie;
  const v = vivants();
  P.vote = {
    candidats: candidats || v,
    votants: v,
    i: 0,
    pret: false,
    choix: null,
    voix: {},
    tours: P.vote && candidats ? P.vote.tours + 1 : 1
  };
  P.ecran = S.reglages.vote === 'secret' ? 'vote' : 'vote-main';
  afficher();
}

function eliminer(i) {
  const P = S.partie;
  P.joueurs[i].vivant = false;
  P.elimine = i;
  P.devine = P.joueurs[i].role === 'white' ? { essai: '', fait: false, ok: false } : null;
  P.ecran = 'elimination';
  vibrer(40);
  afficher();
}

function verifierFin() {
  const P = S.partie;
  const v = vivants().map(i => P.joueurs[i].role);
  const civils = v.filter(r => r === 'civil').length;
  const infiltres = v.length - civils;
  if (infiltres === 0) return terminer('civils');
  if (civils <= 1) return terminer('infiltres');
  nouvelleManche();
}

function terminer(gagnant) {
  const P = S.partie;
  P.gagnant = gagnant;
  P.gains = {};
  P.joueurs.forEach(j => {
    let gagne = false;
    if (gagnant === 'civils') gagne = j.role === 'civil';
    else if (gagnant === 'infiltres') gagne = j.role !== 'civil';
    else if (gagnant === 'white') gagne = j.role === 'white';
    const pts = gagne ? POINTS[j.role] : 0;
    P.gains[j.nom] = pts;
    S.scores[j.nom] = (S.scores[j.nom] || 0) + pts;
  });
  P.ecran = 'fin';
  afficher();
  confettis();
}

function confettis() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let k = 0; k < 40; k++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = COULEURS[k % COULEURS.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
    c.style.animationDelay = Math.random() * 0.6 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

// ---------- Rendu ----------
function afficher() {
  sauver();
  fermerModale();
  const P = S.partie;
  if (!BASE) { $app.innerHTML = `<div class="scene pousse"><div class="logo"><span class="masque">🎭</span></div><p>Chargement…</p></div>`; return; }
  if (!P) $app.innerHTML = vueAccueil();
  else {
    const vues = {
      distribution: vueDistribution, debat: vueDebat, vote: vueVote, 'vote-main': vueVoteMain,
      resultat: vueResultat, elimination: vueElimination, fin: vueFin
    };
    $app.innerHTML = (vues[P.ecran] || vueDebat)();
  }
  window.scrollTo(0, 0);
}

function barreJeu(etiquette, avecMot = true) {
  return `<div class="barre">
    <button class="bouton-rond" data-action="quitter" aria-label="Quitter la partie">✕</button>
    <span class="etiquette">${etiquette}</span>
    ${avecMot ? `<button class="bouton-rond" data-action="revoir">👀 Mon mot</button>` : `<button class="bouton-rond" data-action="regles" aria-label="Règles">?</button>`}
  </div>`;
}

function vueAccueil() {
  corrigerReglages();
  const r = S.reglages;
  const n = S.joueurs.length;
  const max = maxInfiltres(Math.max(n, MIN_JOUEURS));
  const civils = Math.max(0, n - r.imposteurs - r.white);
  const actifs = themesActifs();
  const toutCoche = actifs.length === BASE.themes.length;
  const nbPaires = BASE.themes.filter(t => actifs.includes(t.id)).reduce((s, t) => s + t.paires.length, 0);
  const aDesScores = Object.values(S.scores).some(v => v > 0);

  return `
  <header class="logo">
    <span class="masque">🎭</span>
    <h1>Imposteur</h1>
    <p>Un mot, des amis… et un intrus !</p>
  </header>

  <section class="carte">
    <h3>👫 Les joueurs <span class="petit">(${n})</span></h3>
    <div class="joueurs">
      ${S.joueurs.map((nom, i) => `
        <div class="joueur">
          ${avatar(identite(i))}
          <input value="${esc(nom)}" data-renommer="${i}" maxlength="18" aria-label="Nom du joueur ${i + 1}" enterkeyhint="done">
          <button class="suppr" data-action="retirer" data-i="${i}" aria-label="Retirer ${esc(nom)}">✕</button>
        </div>`).join('')}
    </div>
    ${n < MAX_JOUEURS ? `<form class="ajout" data-form="ajout">
      <input id="nouveau" placeholder="Prénom du joueur" maxlength="18" autocomplete="off" enterkeyhint="send">
      <button type="submit" aria-label="Ajouter">＋</button>
    </form>` : ''}
    ${n < MIN_JOUEURS ? `<p class="petit" style="margin:10px 0 0">Ajoute au moins ${MIN_JOUEURS} joueurs. Rangez-vous dans l'ordre où vous êtes assis !</p>` : `<p class="petit" style="margin:10px 0 0">L'ordre de la liste = l'ordre autour de la table.</p>`}
  </section>

  <section class="carte">
    <h3>⚙️ Réglages</h3>
    <div class="reglage">
      <span class="libelle">🕵️ Imposteurs</span>
      <span class="compteur">
        <button data-action="moins" data-k="imposteurs" ${r.imposteurs <= (r.white ? 0 : 1) ? 'disabled' : ''} aria-label="Moins d'imposteurs">−</button>
        <output>${r.imposteurs}</output>
        <button data-action="plus" data-k="imposteurs" ${r.imposteurs + r.white >= max ? 'disabled' : ''} aria-label="Plus d'imposteurs">+</button>
      </span>
    </div>
    <div class="reglage">
      <span class="libelle">🎩 Mr. White<small>Il n'a aucun mot et doit bluffer</small></span>
      <span class="compteur">
        <button data-action="moins" data-k="white" ${r.white <= (r.imposteurs ? 0 : 1) ? 'disabled' : ''} aria-label="Moins de Mr. White">−</button>
        <output>${r.white}</output>
        <button data-action="plus" data-k="white" ${r.imposteurs + r.white >= max ? 'disabled' : ''} aria-label="Plus de Mr. White">+</button>
      </span>
    </div>
    <div class="reglage">
      <span class="libelle">Mr. White peut parler en premier<small>Sinon, il ne commence jamais une manche</small></span>
      <button class="interrupteur" role="switch" aria-checked="${r.whiteCommence}" data-action="bascule-white" aria-label="Mr. White peut commencer"></button>
    </div>
    <div class="reglage">
      <span class="libelle">🗳️ Vote</span>
      <span class="choix-segment">
        <button data-action="mode-vote" data-v="secret" aria-pressed="${r.vote === 'secret'}">Secret</button>
        <button data-action="mode-vote" data-v="main" aria-pressed="${r.vote === 'main'}">À main levée</button>
      </span>
    </div>
    ${n >= MIN_JOUEURS ? `<div class="repartition">
      <span class="badge civil">🙂 ${civils} civil${civils > 1 ? 's' : ''}</span>
      ${r.imposteurs ? `<span class="badge imposteur">🕵️ ${r.imposteurs} imposteur${r.imposteurs > 1 ? 's' : ''}</span>` : ''}
      ${r.white ? `<span class="badge white">🎩 ${r.white} Mr. White</span>` : ''}
    </div>` : ''}
  </section>

  <section class="carte">
    <details class="themes">
      <summary><span>🎨 Thèmes <span class="petit">(${toutCoche ? 'tous' : actifs.length} · ${nbPaires} paires)</span></span><span class="fleche">▾</span></summary>
      <div class="puces">
        <button class="puce" data-action="themes-tous" aria-pressed="${toutCoche}">✨ Tous</button>
        ${BASE.themes.map(t => `<button class="puce" data-action="theme" data-id="${t.id}" aria-pressed="${!toutCoche && actifs.includes(t.id)}">${t.emoji} ${esc(t.nom)}</button>`).join('')}
      </div>
    </details>
  </section>

  <div class="pile pousse">
    <button class="btn" data-action="jouer" ${n < MIN_JOUEURS ? 'disabled' : ''}>🎲 C'est parti !</button>
    <div class="rangee">
      <button class="btn blanc moyen" data-action="regles">📖 Règles</button>
      ${aDesScores ? `<button class="btn blanc moyen" data-action="scores">🏆 Scores</button>` : ''}
    </div>
  </div>`;
}

function vueDistribution() {
  const P = S.partie;
  const j = P.joueurs[P.distrib];
  const points = P.joueurs.map((_, i) => `<span class="${i < P.distrib ? 'fait' : i === P.distrib ? 'actuel' : ''}"></span>`).join('');
  const dernier = P.distrib === P.joueurs.length - 1;
  let carte;
  if (!P.montre) {
    carte = `<button class="carte-mot cache" data-action="montrer">
      <span class="gros-emoji">🤫</span>
      <strong>Touche pour voir ton mot</strong>
      <span>Cache bien l'écran !</span>
    </button>`;
  } else if (j.role === 'white') {
    carte = `<div class="carte-mot blanc">
      <span class="gros-emoji" style="font-size:3.4rem">🎩</span>
      <span class="le-mot">Tu es Mr. White !</span>
      <span class="petit">Tu n'as pas de mot. Écoute les autres et fais semblant… Si on t'élimine, tu pourras deviner le mot des civils.</span>
    </div>`;
  } else {
    carte = `<div class="carte-mot mot">
      <span class="libelle">Ton mot secret</span>
      <span class="le-mot">${esc(motDe(j))}</span>
    </div>`;
  }
  return `
  ${barreJeu(`Joueur ${P.distrib + 1} / ${P.joueurs.length}`, false)}
  <div class="points">${points}</div>
  <div class="scene">
    ${avatar(j, 'grand')}
    <div>
      <div class="petit">${P.montre ? 'Mémorise bien…' : 'Passe le téléphone à'}</div>
      <div class="nom-joueur">${esc(j.nom)}</div>
    </div>
    ${carte}
  </div>
  <div class="pile pousse">
    ${P.montre ? `<button class="btn menthe" data-action="suivant">${dernier ? '✅ C\'est retenu, on joue !' : '✅ C\'est retenu, joueur suivant'}</button>` : ''}
  </div>`;
}

function vueDebat() {
  const P = S.partie;
  const premier = P.joueurs[P.ordre[0]];
  const morts = P.joueurs.filter(j => !j.vivant);
  return `
  ${barreJeu(`Manche ${P.manche}`)}
  <div class="annonce">C'est
    <strong>${premier.emoji} ${esc(premier.nom)}</strong>
    qui commence !
  </div>
  <section class="carte">
    <h3>🗣️ Chacun dit un mot, à tour de rôle</h3>
    <ol class="ordre">
      ${P.ordre.map((i, k) => {
        const j = P.joueurs[i];
        return `<li class="${k === 0 ? 'premier' : ''}"><span class="num">${k + 1}</span>${avatar(j)} ${esc(j.nom)}</li>`;
      }).join('')}
      ${morts.map(j => `<li class="mort">${avatar(j)} ${esc(j.nom)} <span class="role-mini">${ROLES[j.role].emoji} ${ROLES[j.role].nom}</span></li>`).join('')}
    </ol>
  </section>
  <p class="petit" style="text-align:center;margin:0">Un indice pour montrer que tu connais le mot… sans le donner à l'imposteur ! 😉</p>
  <div class="pile pousse">
    <button class="btn rose" data-action="voter">🗳️ Passer au vote</button>
  </div>`;
}

function vueVote() {
  const P = S.partie;
  const V = P.vote;
  const votant = P.joueurs[V.votants[V.i]];
  const titre = V.candidats.length < vivants().length ? 'Revote' : 'Vote';
  if (!V.pret) {
    return `
    ${barreJeu(`${titre} ${V.i + 1} / ${V.votants.length}`)}
    <div class="scene">
      ${avatar(votant, 'grand')}
      <div>
        <div class="petit">Passe le téléphone à</div>
        <div class="nom-joueur">${esc(votant.nom)}</div>
      </div>
      <p class="petit" style="margin:0">Vote en secret : personne ne doit voir l'écran !</p>
    </div>
    <div class="pile pousse">
      <button class="btn" data-action="pret">👋 Je suis ${esc(votant.nom)}</button>
    </div>`;
  }
  const choix = V.candidats.filter(i => i !== V.votants[V.i]);
  return `
  ${barreJeu(`${titre} ${V.i + 1} / ${V.votants.length}`)}
  <h2>${esc(votant.nom)}, qui est l'imposteur ?</h2>
  <div class="grille">
    ${choix.map(i => {
      const j = P.joueurs[i];
      return `<button class="choix-joueur" data-action="choisir" data-i="${i}" aria-pressed="${V.choix === i}">${avatar(j, 'moyen')}<span>${esc(j.nom)}</span></button>`;
    }).join('')}
  </div>
  <div class="pile pousse">
    <button class="btn rose" data-action="valider-vote" ${V.choix === null ? 'disabled' : ''}>🗳️ Valider mon vote</button>
  </div>`;
}

function vueVoteMain() {
  const P = S.partie;
  const V = P.vote;
  return `
  ${barreJeu('Vote')}
  <h2>À trois, pointez tous l'imposteur du doigt ! 👉</h2>
  <p class="sous">Puis touchez le joueur qui a le plus de voix.</p>
  <div class="grille">
    ${V.candidats.map(i => {
      const j = P.joueurs[i];
      return `<button class="choix-joueur" data-action="choisir" data-i="${i}" aria-pressed="${V.choix === i}">${avatar(j, 'moyen')}<span>${esc(j.nom)}</span></button>`;
    }).join('')}
  </div>
  <div class="pile pousse">
    <button class="btn rose" data-action="eliminer-choix" ${V.choix === null ? 'disabled' : ''}>❌ Éliminer ${V.choix !== null ? esc(P.joueurs[V.choix].nom) : ''}</button>
    <button class="btn blanc moyen" data-action="tirage">🎲 Égalité ? Tirer au sort</button>
  </div>`;
}

function classementVotes() {
  const V = S.partie.vote;
  return V.candidats.map(i => ({ i, n: V.voix[i] || 0 })).sort((a, b) => b.n - a.n);
}

function vueResultat() {
  const P = S.partie;
  const V = P.vote;
  const cl = classementVotes();
  const max = cl[0].n;
  const ex = cl.filter(c => c.n === max);
  const egalite = ex.length > 1;
  return `
  ${barreJeu('Résultats')}
  <h2>${egalite ? '😱 Égalité !' : '📢 Le verdict'}</h2>
  <section class="carte resultats">
    ${cl.map(c => {
      const j = P.joueurs[c.i];
      const pc = V.votants.length ? Math.round(c.n / V.votants.length * 100) : 0;
      return `<div class="ligne-vote">${avatar(j)}<span class="qui">${esc(j.nom)}</span>
        <span class="jauge"><span class="${c.n ? '' : 'vide'}" style="width:${pc}%"></span></span>
        <span class="nb">${c.n}</span></div>`;
    }).join('')}
  </section>
  <div class="pile pousse">
    ${egalite ? `
      <p class="sous" style="margin:0">${ex.map(c => esc(P.joueurs[c.i].nom)).join(', ')} sont à égalité.</p>
      <button class="btn" data-action="revote">🔁 Revoter entre eux</button>
      <button class="btn blanc moyen" data-action="tirage-ex">🎲 Tirer au sort</button>
    ` : `
      <button class="btn rose" data-action="eliminer-max">❌ Éliminer ${esc(P.joueurs[cl[0].i].nom)}</button>
    `}
  </div>`;
}

function vueElimination() {
  const P = S.partie;
  const j = P.joueurs[P.elimine];
  const role = ROLES[j.role];
  const D = P.devine;
  let suite;
  if (D && !D.fait) {
    suite = `
    <section class="carte jaune pile">
      <h3 style="justify-content:center;margin:0">🎩 Dernière chance !</h3>
      <p style="margin:0;text-align:center">${esc(j.nom)}, devine le mot des civils. Si tu trouves, tu gagnes la partie !</p>
      <form class="pile" data-form="devine">
        <input class="champ" id="essai" placeholder="Le mot des civils…" autocomplete="off" autocapitalize="off" enterkeyhint="done">
        <button class="btn" type="submit">🔮 Proposer</button>
      </form>
    </section>`;
  } else if (D && D.fait && !D.ok) {
    suite = `
    <section class="carte rose pile" style="text-align:center">
      <h3 style="justify-content:center;margin:0">❌ Raté !</h3>
      <p style="margin:0">« ${esc(D.essai)} » n'est pas le bon mot.</p>
      <p class="petit" style="margin:0">Juste une faute de frappe ? Les civils peuvent l'accepter.</p>
      <button class="btn blanc moyen" data-action="accepter-devine">👍 Accepter quand même</button>
    </section>
    <div class="pile pousse"><button class="btn" data-action="continuer">➡️ Continuer</button></div>`;
  } else {
    suite = `<div class="pile pousse"><button class="btn" data-action="continuer">➡️ Continuer</button></div>`;
  }
  return `
  ${barreJeu('Éliminé', false)}
  <div class="revelation">
    ${avatar(j, 'grand')}
    <div class="nom-joueur" style="font-size:2rem;font-weight:700">${esc(j.nom)}</div>
    <div>était…</div>
    <div class="role ${j.role}">${role.emoji} ${role.article} !</div>
  </div>
  ${suite}`;
}

function vueFin() {
  const P = S.partie;
  const titres = {
    civils: { emoji: '🎉', titre: 'Les Civils gagnent !', sous: 'Tous les intrus ont été démasqués.' },
    infiltres: { emoji: '😈', titre: P.joueurs.some(j => j.role === 'imposteur') ? 'Les Imposteurs gagnent !' : 'Mr. White gagne !', sous: 'Les civils se sont fait berner…' },
    white: { emoji: '🎩', titre: 'Mr. White gagne !', sous: 'Il a deviné le mot des civils !' }
  }[P.gagnant];
  const classement = P.joueurs.slice().sort((a, b) => (S.scores[b.nom] || 0) - (S.scores[a.nom] || 0));
  return `
  ${barreJeu('Fin de partie', false)}
  <div class="victoire ${P.gagnant}">
    <div class="trophee">${titres.emoji}</div>
    <h2>${titres.titre}</h2>
    <div>${titres.sous}</div>
  </div>
  <div class="mots-reveles">
    <div class="carte menthe"><div class="t">🙂 Mot des civils</div><div class="m">${esc(P.motCivil)}</div></div>
    <div class="carte rose"><div class="t">🕵️ Mot de l'imposteur</div><div class="m">${esc(P.motImposteur)}</div></div>
  </div>
  <section class="carte">
    <h3>🏆 Scores</h3>
    <ul class="tableau">
      ${classement.map(j => `<li>${avatar(j)}<span class="nom">${esc(j.nom)} <span class="petit">${ROLES[j.role].emoji} ${ROLES[j.role].nom}</span></span>
        <span class="gain">${P.gains[j.nom] ? '+' + P.gains[j.nom] : ''}</span>
        <span class="pts">${S.scores[j.nom] || 0} pts</span></li>`).join('')}
    </ul>
  </section>
  <div class="pile pousse">
    <button class="btn jaune" data-action="rejouer">⚡ Rejouer avec les mêmes joueurs</button>
    <button class="btn blanc moyen" data-action="accueil">✏️ Changer les joueurs ou les réglages</button>
  </div>`;
}

// ---------- Modales ----------
function ouvrirModale(html) {
  $modale.innerHTML = `<div class="boite" role="dialog" aria-modal="true">${html}</div>`;
  $modale.hidden = false;
}
function fermerModale() { $modale.hidden = true; $modale.innerHTML = ''; }

function modaleRevoir(etape, i) {
  const P = S.partie;
  if (etape === 'liste') {
    const qui = P.joueurs.map((j, k) => k).filter(k => P.joueurs[k].vivant);
    ouvrirModale(`
      <h2>👀 Revoir son mot</h2>
      <p class="sous">Qui a oublié son mot ?</p>
      <div class="grille">
        ${qui.map(k => `<button class="choix-joueur" data-action="revoir-qui" data-i="${k}">${avatar(P.joueurs[k], 'moyen')}<span>${esc(P.joueurs[k].nom)}</span></button>`).join('')}
      </div>
      <button class="btn blanc moyen" data-action="fermer">Annuler</button>`);
  } else if (etape === 'confirmer') {
    const j = P.joueurs[i];
    ouvrirModale(`
      <div class="scene">${avatar(j, 'grand')}
        <h2>Seul·e ${esc(j.nom)} doit regarder !</h2>
        <p class="sous">Les autres, fermez les yeux 🙈</p>
      </div>
      <button class="btn" data-action="revoir-montrer" data-i="${i}">🤫 Voir mon mot</button>
      <button class="btn blanc moyen" data-action="fermer">Annuler</button>`);
  } else {
    const j = P.joueurs[i];
    const m = motDe(j);
    ouvrirModale(`
      ${m === null
        ? `<div class="carte-mot blanc"><span style="font-size:3rem">🎩</span><span class="le-mot">Tu es Mr. White !</span><span class="petit">Tu n'as pas de mot, continue de bluffer.</span></div>`
        : `<div class="carte-mot mot"><span class="libelle">Le mot de ${esc(j.nom)}</span><span class="le-mot">${esc(m)}</span></div>`}
      <button class="btn menthe" data-action="fermer">✅ C'est bon, je cache</button>`);
  }
}

function modaleRegles() {
  ouvrirModale(`
    <h2>📖 Comment jouer ?</h2>
    <div class="regles pile">
      <p>Tout le monde reçoit le <b>même mot secret</b>… sauf les intrus !</p>
      <ul>
        <li>🙂 <b>Les Civils</b> ont tous le même mot.</li>
        <li>🕵️ <b>L'Imposteur</b> a un mot proche, mais différent. Il ne sait pas qu'il est l'imposteur !</li>
        <li>🎩 <b>Mr. White</b> n'a aucun mot : il doit improviser.</li>
      </ul>
      <p><b>1.</b> Le téléphone passe de main en main : chacun découvre son mot en secret.</p>
      <p><b>2.</b> À tour de rôle, chacun dit <b>un seul mot</b> en rapport avec son mot secret.</p>
      <p><b>3.</b> On vote pour éliminer un suspect. Son rôle est révélé.</p>
      <p><b>4.</b> Si Mr. White est éliminé, il peut deviner le mot des civils pour gagner tout seul.</p>
      <p>🏆 Les Civils gagnent s'ils éliminent tous les intrus. Les intrus gagnent s'il ne reste plus qu'un civil.</p>
      <p class="petit">Points : Civil gagnant +${POINTS.civil}, Mr. White gagnant +${POINTS.white}, Imposteur gagnant +${POINTS.imposteur}.</p>
    </div>
    <button class="btn" data-action="fermer">J'ai compris !</button>`);
}

function modaleScores() {
  const liste = Object.entries(S.scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  ouvrirModale(`
    <h2>🏆 Scores</h2>
    <ul class="tableau">
      ${liste.map(([nom, pts], k) => `<li><span class="num" style="width:28px;text-align:center">${['🥇', '🥈', '🥉'][k] || k + 1}</span><span class="nom">${esc(nom)}</span><span class="pts">${pts} pts</span></li>`).join('')}
    </ul>
    <button class="btn blanc moyen" data-action="raz-scores">🧹 Remettre à zéro</button>
    <button class="btn" data-action="fermer">Fermer</button>`);
}

function modaleQuitter() {
  ouvrirModale(`
    <h2>Quitter la partie ?</h2>
    <p class="sous">La partie en cours sera perdue.</p>
    <button class="btn rouge" data-action="quitter-oui">🚪 Oui, quitter</button>
    <button class="btn blanc moyen" data-action="fermer">Non, on continue</button>`);
}

// ---------- Actions ----------
const actions = {
  retirer(d) { S.joueurs.splice(+d.i, 1); afficher(); },
  plus(d) { S.reglages[d.k]++; corrigerReglages(); afficher(); },
  moins(d) { S.reglages[d.k]--; corrigerReglages(); afficher(); },
  'bascule-white'() { S.reglages.whiteCommence = !S.reglages.whiteCommence; afficher(); },
  'mode-vote'(d) { S.reglages.vote = d.v; afficher(); },
  'themes-tous'() { S.reglages.themes = null; afficher(); ouvrirThemes(); },
  theme(d) {
    const tous = BASE.themes.map(t => t.id);
    let sel = S.reglages.themes ? S.reglages.themes.slice() : [];
    sel = sel.includes(d.id) ? sel.filter(x => x !== d.id) : [...sel, d.id];
    S.reglages.themes = sel.length && sel.length < tous.length ? sel : null;
    afficher();
    ouvrirThemes();
  },
  jouer() {
    const noms = S.joueurs.map(n => n.trim().toLowerCase());
    if (new Set(noms).size !== noms.length) return toast('Deux joueurs ont le même prénom !');
    nouvellePartie();
  },
  regles: modaleRegles,
  scores: modaleScores,
  'raz-scores'() { S.scores = {}; sauver(); fermerModale(); afficher(); },
  montrer() { S.partie.montre = true; vibrer(); afficher(); },
  suivant() {
    const P = S.partie;
    P.montre = false;
    if (P.distrib < P.joueurs.length - 1) { P.distrib++; afficher(); }
    else nouvelleManche();
  },
  voter() { demarrerVote(); },
  pret() { S.partie.vote.pret = true; afficher(); },
  choisir(d) { S.partie.vote.choix = +d.i; vibrer(); afficher(); },
  'valider-vote'() {
    const V = S.partie.vote;
    V.voix[V.choix] = (V.voix[V.choix] || 0) + 1;
    V.choix = null;
    V.pret = false;
    if (V.i < V.votants.length - 1) { V.i++; afficher(); }
    else { S.partie.ecran = 'resultat'; afficher(); }
  },
  'eliminer-choix'() { eliminer(S.partie.vote.choix); },
  'eliminer-max'() { eliminer(classementVotes()[0].i); },
  revote() {
    const cl = classementVotes();
    demarrerVote(cl.filter(c => c.n === cl[0].n).map(c => c.i));
  },
  'tirage-ex'() {
    const cl = classementVotes();
    const ex = cl.filter(c => c.n === cl[0].n);
    const i = ex[hasard(ex.length)].i;
    toast(`🎲 Le sort désigne ${S.partie.joueurs[i].nom}`);
    eliminer(i);
  },
  tirage() {
    const c = S.partie.vote.candidats;
    const i = c[hasard(c.length)];
    toast(`🎲 Le sort désigne ${S.partie.joueurs[i].nom}`);
    eliminer(i);
  },
  'accepter-devine'() { terminer('white'); },
  continuer() { verifierFin(); },
  rejouer() { nouvellePartie(); },
  accueil() { S.partie = null; afficher(); },
  quitter: modaleQuitter,
  'quitter-oui'() { fermerModale(); S.partie = null; afficher(); },
  revoir() { modaleRevoir('liste'); },
  'revoir-qui'(d) { modaleRevoir('confirmer', +d.i); },
  'revoir-montrer'(d) { vibrer(); modaleRevoir('mot', +d.i); },
  fermer: fermerModale
};

function ouvrirThemes() { document.querySelector('details.themes')?.setAttribute('open', ''); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) {
    e.preventDefault();
    actions[el.dataset.action](el.dataset);
    return;
  }
  if (e.target === $modale) fermerModale();
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target.dataset.form;
  if (f === 'ajout') {
    const champ = document.getElementById('nouveau');
    const nom = champ.value.trim().replace(/\s+/g, ' ');
    if (!nom) return;
    if (S.joueurs.some(n => n.toLowerCase() === nom.toLowerCase())) return toast('Ce prénom est déjà pris !');
    if (S.joueurs.length >= MAX_JOUEURS) return;
    S.joueurs.push(nom);
    afficher();
    document.getElementById('nouveau')?.focus();
  } else if (f === 'devine') {
    const essai = document.getElementById('essai').value.trim();
    if (!essai) return;
    const P = S.partie;
    const ok = normaliser(essai) === normaliser(P.motCivil);
    P.devine = { essai, fait: true, ok };
    if (ok) terminer('white');
    else afficher();
  }
});

// Renommer un joueur sans re-rendre à chaque frappe (le clavier resterait ouvert).
document.addEventListener('change', e => {
  const i = e.target.dataset?.renommer;
  if (i === undefined) return;
  const nom = e.target.value.trim().replace(/\s+/g, ' ');
  if (!nom) { e.target.value = S.joueurs[i]; return; }
  if (S.joueurs.some((n, k) => k !== +i && n.toLowerCase() === nom.toLowerCase())) {
    toast('Ce prénom est déjà pris !');
    e.target.value = S.joueurs[i];
    return;
  }
  // Les scores suivent le joueur renommé.
  const ancien = S.joueurs[i];
  if (S.scores[ancien] !== undefined && ancien !== nom) { S.scores[nom] = S.scores[ancien]; delete S.scores[ancien]; }
  S.joueurs[i] = nom;
  sauver();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset?.renommer !== undefined) e.target.blur();
  if (e.key === 'Escape' && !$modale.hidden) fermerModale();
});

// ---------- Démarrage ----------
afficher();
fetch('data/paires.json')
  .then(r => r.json())
  .then(b => { BASE = b; afficher(); })
  .catch(() => { $app.innerHTML = `<div class="scene pousse"><h2>😢 Oups</h2><p>Impossible de charger les mots. Vérifie ta connexion et recharge la page.</p></div>`; });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
