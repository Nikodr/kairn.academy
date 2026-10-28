// Questionnaire du diagnostic express, sur la page /diagnostic elle-même (FS-1 v2.0, US-1 et US-2).
// 6 questions à choix unique, une par écran : choisir une réponse (clic ou toucher) passe à la suivante.
// Progression gardée dans le stockage de session ; à la fin, une ligne anonyme part vers la Google Sheet
// et les réponses passent à la page résultat par le stockage de session.

import contenu from './contenu.js';
import { lireReponses, calculerResultat, remplir } from './calcul.js';
import { etapes, melanger, estRepondue, versParams } from './questionnaire-logique.js';
import { initialiserMesure, suivre, sourceDe } from './mesure.js';
import { ligneReponse, envoyerSheet } from './sheet.js';
import { session } from './stockage.js';

const PREFIXE = 'kairn-diagnostic:';
const CLE_BROUILLON = `${PREFIXE}brouillon`;
const Q = contenu.questionnaire;
const ETAPES = etapes(contenu);
// Délai avant la question suivante : le temps de voir la réponse cochée.
const DELAI_PASSAGE = 280;
const $ = (id) => document.getElementById(id);

const url = new URL(location.href);
const modeTest = url.searchParams.has('test');
const utmPage = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign'].map((c) => [c, url.searchParams.get(c) ?? '']));

// ── Brouillon : reprise après rechargement ──
function nouvelIdentifiant() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}

let brouillon;
try { brouillon = JSON.parse(session.lire(CLE_BROUILLON) ?? 'null'); } catch { brouillon = null; }
// Un brouillon de l'ancien questionnaire (13 écrans) ne correspond plus aux questions : on repart de zéro.
if (brouillon && (brouillon.etape >= ETAPES.length || !estRepondueOuVide(brouillon))) brouillon = null;
if (!brouillon) {
  brouillon = {
    etape: 0,
    reponses: {},
    ordre: Object.fromEntries(ETAPES.filter((e) => e.aleatoire).map((e) => [e.cle, melanger(e.choix.map(([code]) => code))])),
    id: nouvelIdentifiant(),
    utm: utmPage,
  };
}
const enregistrer = () => session.ecrire(CLE_BROUILLON, JSON.stringify(brouillon));
enregistrer();

/** Le brouillon ne contient que des réponses valides aux questions actuelles. */
function estRepondueOuVide(b) {
  return Object.entries(b.reponses ?? {}).every(([cle, valeur]) => {
    const etape = ETAPES.find((e) => e.cle === cle);
    return etape && estRepondue(etape, valeur);
  });
}

// ── Étape 1 du parcours : comptée à la première réponse validée, une fois par session ──
// (la page /diagnostic affiche la 1re question dès l'arrivée : la simple visite ne compte pas.)
initialiserMesure({ test: modeTest });
function compterDemarrage() {
  if (session.lire(`${PREFIXE}demarre`)) return;
  session.ecrire(`${PREFIXE}demarre`, '1');
  suivre('diagnostic_demarre', { source: sourceDe(brouillon.utm.utm_source) });
}

// ── Affichage d'une étape ──
$('precedent').textContent = Q.precedent;
$('mention').textContent = Q.mention;
$('aide').textContent = Q.aide;
const carte = $('questionnaire');
const petitEcran = matchMedia('(max-width: 959px)');
let minuteur = null;
// Le passage automatique ne suit qu'un clic ou un toucher : au clavier, les flèches changent la réponse sans avancer.
let viaPointeur = false;
$('choix').addEventListener('pointerdown', () => { viaPointeur = true; });
$('choix').addEventListener('keydown', (e) => {
  viaPointeur = false;
  if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); $('etape').requestSubmit(); }
});

function afficher({ focus = true } = {}) {
  clearTimeout(minuteur);
  minuteur = null;
  const etape = ETAPES[brouillon.etape];
  const total = ETAPES.length;
  const valeur = brouillon.reponses[etape.cle];

  $('compteur').textContent = remplir(Q.etape, { n: brouillon.etape + 1, total });
  $('barre').style.width = `${((brouillon.etape + 1) / total) * 100}%`;
  $('question').textContent = etape.texte;

  const zone = $('choix');
  const ordre = brouillon.ordre[etape.cle] ?? etape.choix.map(([code]) => code);
  const libelles = Object.fromEntries(etape.choix);
  zone.replaceChildren(...ordre.map((code) => {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = etape.cle;
    input.value = code;
    input.checked = valeur === code;
    // « click » part aussi quand on reclique sur la réponse déjà cochée (retour en arrière) ; « change », non.
    input.addEventListener('click', () => choisir(code));
    const texte = document.createElement('span');
    texte.textContent = libelles[code];
    label.append(input, texte);
    return label;
  }));

  $('erreur').hidden = true;
  $('precedent').hidden = brouillon.etape === 0;
  $('suivant').textContent = brouillon.etape === total - 1 ? Q.terminer : Q.suivant;
  // « Suivant » ne sert qu'à continuer sans changer une réponse déjà donnée.
  $('suivant').hidden = !estRepondue(etape, valeur);
  if (focus) {
    // Sur petit écran, la question revient en haut ; sur grand écran, seulement si elle est sortie de l'écran.
    const haut = carte.getBoundingClientRect().top;
    if (petitEcran.matches || haut < 0) window.scrollTo({ top: window.scrollY + haut - 16 });
    $('question').focus({ preventScroll: true });
  }
}

function choisir(code) {
  const etape = ETAPES[brouillon.etape];
  brouillon.reponses[etape.cle] = code;
  $('erreur').hidden = true;
  enregistrer();
  if (!viaPointeur) {
    $('suivant').hidden = false;
    return;
  }
  clearTimeout(minuteur);
  minuteur = setTimeout(avancer, DELAI_PASSAGE);
}

// ── Navigation ──
function avancer() {
  minuteur = null;
  const etape = ETAPES[brouillon.etape];
  if (!estRepondue(etape, brouillon.reponses[etape.cle])) {
    $('erreur').textContent = Q.erreur;
    $('erreur').hidden = false;
    ($('choix').querySelector('input') ?? $('question')).focus();
    return;
  }
  compterDemarrage();
  if (brouillon.etape < ETAPES.length - 1) {
    brouillon.etape += 1;
    enregistrer();
    afficher();
    return;
  }
  terminer();
}

$('precedent').addEventListener('click', () => {
  brouillon.etape = Math.max(0, brouillon.etape - 1);
  enregistrer();
  afficher();
});

$('etape').addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(minuteur);
  avancer();
});

// ── Fin : Google Sheet, session, page résultat ──
function terminer() {
  const chaine = versParams(brouillon.reponses, { id: brouillon.id, utm: brouillon.utm });
  const lu = lireReponses(new URLSearchParams(chaine));
  if (!lu.valide) {
    // Ne devrait pas arriver : chaque étape est contrôlée. On revient à la première en défaut.
    console.warn('[diagnostic] Réponses incomplètes :', lu.erreurs);
    const enDefaut = ETAPES.findIndex((et) => !estRepondue(et, brouillon.reponses[et.cle]));
    brouillon.etape = Math.max(0, enDefaut);
    enregistrer();
    afficher();
    return;
  }
  const resultat = calculerResultat(lu.reponses);
  envoyerSheet({ type: 'reponse', ligne: ligneReponse({ reponses: lu.reponses, meta: lu.meta, resultat }) }, { test: modeTest });
  session.ecrire(`${PREFIXE}reponses`, chaine);
  session.effacer(CLE_BROUILLON);
  location.href = modeTest ? '/diagnostic/resultat/?test=session' : '/diagnostic/resultat/';
}

afficher({ focus: false });
