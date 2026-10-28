// Page résultat du diagnostic express (/diagnostic/resultat).
// Ordre : lecture des réponses, nettoyage de l'URL, calcul, affichage, mesure, formulaire.

import config from './config.js';
import contenu from './contenu.js';
import exemples from './exemples.js';
import { CONTRAT, TAILLES_EQUIPE, lireReponses, calculerResultat, comparerPerception, remplir, compterNsp } from './calcul.js';
import { expliquerEcart } from './ecart.js';
import { initialiserMesure, suivre, sourceDe } from './mesure.js';
import { champsBrevo, envoyerBrevo } from './brevo.js';
import { creerPdf } from './pdf.js';
import { envoyerSheet } from './sheet.js';
import { session } from './stockage.js';

const PREFIXE = 'kairn-diagnostic:';
const $ = (id) => document.getElementById(id);
const T = contenu.textes;
const UI = contenu.interface;
const reduireMouvement = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Questionnaire d'équipe (FS-3) : tant que son URL est vide, ni bouton ni promesse.
const questionnaireEquipe = Boolean(config.invitationEquipeUrl);
// Comparatif avec d'autres entreprises : puce, phrase et diapositive « La suite » seulement si la date est connue.
const dateComparatif = (config.DATE_COMPARATIF ?? '').trim();
const nbDiapositives = dateComparatif ? 12 : 11;
let telechargerPdf = async () => {};
let pdfAutoLance = false;
// Le bouton de repli n'apparaît que si l'onglet ne s'est pas ouvert (ou au retour sur la page).
let repliNecessaire = false;
function majRepli() {
  $('pdf-repli').hidden = !repliNecessaire;
  $('pdf-secours').hidden = !pdfAutoLance; // « Il ne s'est pas ouvert ? » n'a de sens qu'après une tentative
  // « s'est ouvert dans un nouvel onglet » seulement si c'est vrai.
  $('pdf-description').textContent = remplir(repliNecessaire ? UI.pdf_description_retour : UI.pdf_description, { n: nbDiapositives });
}

// ── 1. Réponses : URL, mode test, ou session (après rechargement) ──
const url = new URL(location.href);
const modeTest = url.searchParams.has('test');
const choixTest = url.searchParams.get('test') || 'acceleres';
let params;

if (modeTest && choixTest === 'session') {
  // Questionnaire passé en mode test : réponses de la session, sans envoi.
  params = new URLSearchParams(session.lire(`${PREFIXE}reponses`) ?? '');
} else if (modeTest) {
  const exemple = choixTest === 'invalide' ? { ...exemples.acceleres, q2: 'hors-liste' } : exemples[choixTest];
  params = new URLSearchParams(choixTest === 'vide' ? {} : exemple ?? {});
} else if (Object.keys(CONTRAT).some((q) => url.searchParams.has(q))) {
  params = url.searchParams;
  session.ecrire(`${PREFIXE}reponses`, params.toString());
  // Retirer les réponses de l'URL affichée, avant tout chargement de l'outil de mesure.
  history.replaceState(null, '', url.pathname);
} else {
  params = new URLSearchParams(session.lire(`${PREFIXE}reponses`) ?? '');
}

for (const [cle, valeur] of Object.entries({ sheetUrl: config.sheetUrl, brevoUrl: config.brevoUrl })) {
  if (!valeur) console.warn(`[diagnostic] config.${cle} est vide.`);
}

initialiserMesure({ test: modeTest });
if (modeTest) installerBarreTest();

const lu = lireReponses(params);
if (!lu.valide) {
  if (params.toString()) console.warn('[diagnostic] Réponses invalides :', lu.erreurs);
  afficherVide();
} else {
  afficherResultat(lu.reponses, lu.meta);
}

// ── 2. Sans réponses valides ──
function afficherVide() {
  $('vide-titre').textContent = T.sans_resultat;
  $('vide-lien').textContent = UI.lien_sans_resultat;
  $('vide').hidden = false;
}

// ── 3. Résultat ──
function afficherResultat(reponses, meta) {
  const resultat = calculerResultat(reponses);
  const profil = contenu.profils[resultat.profil];
  const source = sourceDe(meta.utm_source);
  const cle = meta.rid || Object.keys(CONTRAT).map((q) => `${q}=${[].concat(reponses[q] ?? '').join(',')}`).join('&');
  const cleSession = `${PREFIXE}${cle}:`;

  document.title = `${profil.nom} · Diagnostic express · kairn.academy`;
  $('profil-nom-texte').textContent = profil.nom;
  $('profil-lecture').textContent = profil.lecture;
  $('profil-description').textContent = profil.description;

  const percu = contenu.profils[reponses.q1].nom;
  const type = comparerPerception(reponses.q1, resultat.profil);
  remplirAvecGras($('perception'), type === 'ecart' ? T.ecart : T.confirmation, { percu, calcule: profil.nom });
  if (type === 'ecart') {
    $('perception-explication').textContent = expliquerEcart(reponses.q1, resultat, contenu);
    $('perception-explication').hidden = false;
  }

  afficherDetail(resultat, compterNsp(reponses));
  $('resultat').hidden = false;

  // Étape 2 du parcours, comptée une seule fois par session pour ce résultat.
  if (!session.lire(`${cleSession}vu`)) {
    session.ecrire(`${cleSession}vu`, '1');
    suivre('resultat_affiche', { source, profil: resultat.profil });
  }

  const contexte = { resultat, reponses, meta, source, cleSession };
  if (session.lire(`${cleSession}debloque`)) {
    afficherAcces({ arrivee: false });
  } else {
    preparerFormulaire(contexte);
  }
  preparerPdf(contexte);
  preparerInvitation(contexte);
}

/** Remplit un texte à {variables} en mettant les valeurs en gras, sans innerHTML. */
function remplirAvecGras(el, texte, variables) {
  const morceaux = texte.split(/(\{\w+\})/);
  el.replaceChildren(...morceaux.map((m) => {
    const cle = m.match(/^\{(\w+)\}$/)?.[1];
    if (!cle || !(cle in variables)) return document.createTextNode(m);
    const b = document.createElement('strong');
    b.textContent = variables[cle];
    return b;
  }));
}

function ligneAxe(axe, note, index = 0) {
  const li = document.createElement('li');
  li.style.setProperty('--axis', index);
  const tete = document.createElement('div');
  tete.className = 'axis-head';
  const b = document.createElement('b');
  b.textContent = axe.nom;
  tete.append(b);
  const score = document.createElement('span');
  score.className = 'score';
  score.textContent = `${note} / 3`;
  tete.append(score);
  const barre = document.createElement('div');
  barre.className = 'axis-bar';
  for (let i = 0; i < 3; i++) {
    const seg = document.createElement('i');
    seg.style.setProperty('--seg', i);
    if (i < note) seg.className = 'on';
    barre.append(seg);
  }
  li.append(tete, barre);

  // Détail : libellé du niveau, situation, et ce qu'il faudrait pour le niveau supérieur.
  const paragraphe = (classe, texte) => {
    const p = document.createElement('p');
    p.className = classe;
    p.textContent = texte;
    return p;
  };
  const suivant = document.createElement('p');
  suivant.className = 'axis-next';
  if (axe.superieur[note]) {
    const [debut, fin] = remplir(UI.niveau_superieur, { texte: '\u0000' }).split('\u0000');
    const lead = document.createElement('strong');
    lead.textContent = debut;
    suivant.append(lead, axe.superieur[note] + (fin ?? ''));
  } else {
    suivant.textContent = UI.niveau_max;
  }
  li.append(paragraphe('axis-level', axe.niveaux[note]), paragraphe('axis-text', axe.situations[note]), suivant);
  return li;
}

// ── Carrousel des aperçus : toutes les diapositives, titre lisible et contenu flou ──
function initialiserCarousel() {
  const piste = $('apercus-piste');
  const [prec, suiv] = [$('apercus-prec'), $('apercus-suiv')];
  const etat = () => {
    prec.disabled = piste.scrollLeft <= 2;
    suiv.disabled = piste.scrollLeft + piste.clientWidth >= piste.scrollWidth - 2;
  };
  // Deux diapositives à la fois : on avance d'une « page » (la largeur visible plus l'espace).
  const aller = (sens) => piste.scrollBy({ left: sens * (piste.clientWidth + 10), behavior: reduireMouvement ? 'auto' : 'smooth' });
  prec.addEventListener('click', () => aller(-1));
  suiv.addEventListener('click', () => aller(1));
  piste.addEventListener('scroll', etat, { passive: true });
  piste.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); aller(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); aller(-1); }
  });
  // La page est masquée au moment de l'initialisation : on recalcule dès que la piste a une taille.
  new ResizeObserver(etat).observe(piste);
  piste.addEventListener('load', etat, true); // les images se chargent après coup : la largeur défilable change
  etat();
  return etat;
}

// ── 4. Formulaire email ──
function preparerFormulaire(contexte) {
  const form = $('formulaire');
  const email = $('email');
  const consentement = $('consentement');
  const bouton = $('envoyer');

  $('formulaire-titre').textContent = questionnaireEquipe ? T.titre_formulaire : T.titre_formulaire_sans_questionnaire;
  const avantages = [
    UI.avantages[0],
    ...(questionnaireEquipe ? [UI.avantage_questionnaire] : []),
    ...(dateComparatif ? [remplir(UI.avantage_comparaison, { date: dateComparatif })] : []),
  ];
  for (const img of document.querySelectorAll('#apercus img')) img.alt = UI.apercu_alt;
  const majCarousel = initialiserCarousel();
  $('avantages').replaceChildren(...avantages.map((texte) => {
    const li = document.createElement('li');
    li.insertAdjacentHTML('afterbegin', '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="#F16B52"/><path d="m6 10.2 2.7 2.7L14 7.6" fill="none" stroke="#24021E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    const span = document.createElement('span');
    span.textContent = texte;
    li.append(span);
    return li;
  }));
  $('email-libelle').textContent = UI.libelle_email;
  $('poste-libelle').textContent = UI.libelle_poste;
  $('poste').placeholder = UI.exemple_poste;
  $('taille-libelle').textContent = UI.libelle_taille;
  $('taille').replaceChildren(new Option(UI.invite_taille, ''), ...UI.tailles.map(([code, libelle]) => new Option(libelle, code)));
  $('consentement-texte').textContent = T.consentement;
  bouton.textContent = UI.bouton_envoi;

  const signaler = (champ, idErreur, message) => {
    champ.setAttribute('aria-invalid', message ? 'true' : 'false');
    const p = $(idErreur);
    p.hidden = !message;
    p.replaceChildren();
    if (message) {
      p.insertAdjacentHTML('afterbegin', '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.5v4.2M8 11.2v.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>');
      p.append(message);
    }
  };
  const emailValide = () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
  email.addEventListener('input', () => { if (email.getAttribute('aria-invalid') === 'true' && emailValide()) signaler(email, 'email-erreur', ''); });
  consentement.addEventListener('change', () => { if (consentement.checked) signaler(consentement, 'consentement-erreur', ''); });

  $('offre').hidden = false;
  majCarousel(); // la piste vient d'apparaître : l'état des flèches se calcule maintenant

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('envoi-erreur').hidden = true;
    const erreurs = [];
    if (!emailValide()) { signaler(email, 'email-erreur', UI.erreur_email); erreurs.push(email); } else signaler(email, 'email-erreur', '');
    if (!consentement.checked) { signaler(consentement, 'consentement-erreur', UI.erreur_consentement); erreurs.push(consentement); } else signaler(consentement, 'consentement-erreur', '');
    if (erreurs.length) { erreurs[0].focus(); return; }

    bouton.disabled = true;
    bouton.textContent = UI.envoi_en_cours;
    // Le diagnostic s'ouvre dans un nouvel onglet au premier clic, dans le geste de l'utilisateur, en parallèle de l'envoi Brevo.
    // Une seule fois : un nouvel essai après un échec Brevo ne rouvre pas d'onglet.
    if (!pdfAutoLance) { pdfAutoLance = true; telechargerPdf(); }
    // Poste et taille : optionnels ; une taille hors liste reste vide.
    const poste = $('poste').value.trim().slice(0, 120);
    const taille = TAILLES_EQUIPE.includes($('taille').value) ? $('taille').value : '';
    const champs = champsBrevo({ ...contexte, email: email.value.trim(), poste, taille });
    const envoi = await envoyerBrevo(champs, { simuler: modeTest ? $('test-brevo')?.value : undefined });
    bouton.disabled = false;
    bouton.textContent = UI.bouton_envoi;

    if (!envoi.ok) {
      // Les réponses et les champs restent en place : rien n'est perdu.
      if (envoi.champ === 'email') { signaler(email, 'email-erreur', UI.erreur_email); email.focus(); return; }
      $('envoi-erreur').textContent = T.erreur_envoi;
      $('envoi-erreur').hidden = false;
      return;
    }

    session.ecrire(`${contexte.cleSession}debloque`, '1');
    suivre('email_envoye', { source: contexte.source, profil: contexte.resultat.profil });
    // La Google Sheet reçoit l'email avec le poste et la taille : seulement ici, après le consentement.
    if (contexte.meta.rid) {
      envoyerSheet({ type: 'email', id: contexte.meta.rid, email: email.value.trim(), titre: poste, taille }, { test: modeTest });
    }
    afficherAcces({ arrivee: true });
  });
}

// ── 4 bis. Détail en accès libre : 4 axes et 3 questions ──
function afficherDetail(resultat, nsp = 0) {
  const profil = contenu.profils[resultat.profil];

  $('axes-titre').textContent = UI.titre_axes;
  $('axes').replaceChildren(...contenu.axes.map((axe, i) => ligneAxe(axe, resultat.axes[axe.cle], i)));
  $('dispersion-texte').textContent = contenu.dispersion;
  $('dispersion').hidden = !resultat.dispersion;
  // Les « Je ne sais pas » comptent comme le niveau le plus bas : on le dit.
  $('note-nsp').textContent = nsp === 1 ? UI.note_nsp_une : remplir(UI.note_nsp, { n: nsp });
  $('note-nsp').hidden = nsp === 0;
  // Les barres se remplissent jusqu'à la note à l'arrivée sur la page.
  if (!reduireMouvement) $('detail').classList.add('is-arriving');

  $('questions-titre').textContent = UI.titre_questions;
  $('questions').replaceChildren(...profil.questions.map((q) => {
    const li = document.createElement('li');
    li.textContent = q;
    return li;
  }));
}

// ── 5. Après l'email : PDF complet et questionnaire d'équipe, à la place du formulaire ──
function afficherAcces({ arrivee }) {
  $('acces-titre').textContent = UI.titre_acces;
  // Au retour sur la page (session déjà débloquée), rien ne s'est ouvert : le bouton est proposé tout de suite.
  if (!arrivee) repliNecessaire = true;
  $('pdf-secours').textContent = UI.pdf_secours;
  majRepli();
  // La phrase sur la comparaison n'existe que si la date est connue.
  $('resultats-partages').textContent = dateComparatif ? UI.resultats_partages : '';
  $('resultats-partages').hidden = !dateComparatif;

  $('offre').hidden = true;
  const acces = $('acces');
  acces.hidden = false;
  if (arrivee) {
    acces.focus({ preventScroll: true });
    acces.scrollIntoView({ behavior: reduireMouvement ? 'auto' : 'smooth', block: 'start' });
  }
}

// ── 5 bis. Diagnostic complet : ouvert dans un nouvel onglet au clic du bouton de l'email ──
// L'onglet est ouvert tout de suite, dans le geste de l'utilisateur (sinon le navigateur le bloque), puis rempli
// quand le PDF est prêt. Le bouton « Ouvrir le diagnostic complet » ne sert que de repli.
function preparerPdf({ resultat, reponses, source, cleSession }) {
  const bouton = $('pdf');
  const libelle = $('pdf-libelle');
  libelle.textContent = UI.bouton_pdf;
  let urlPdf = null;
  let enCours = false;
  telechargerPdf = async () => {
    if (enCours) return;
    enCours = true;
    $('pdf-erreur').hidden = true;
    bouton.disabled = true;
    libelle.textContent = UI.pdf_en_cours;
    const onglet = window.open('', '_blank');
    try {
      if (onglet) { onglet.document.title = UI.pdf_titre; onglet.document.body.textContent = UI.pdf_en_cours; }
    } catch { /* onglet inaccessible : sans importance */ }
    try {
      if (!urlPdf) {
        const pdf = await creerPdf({ resultat, reponses, dateComparatif });
        urlPdf = URL.createObjectURL(new Blob([pdf.doc.output('arraybuffer')], { type: 'application/pdf' }));
      }
      if (!onglet) throw new Error('ouverture bloquée');
      onglet.location.href = urlPdf;
      repliNecessaire = false;
      // « pdf_telecharge » : une seule fois par session, que l'onglet s'ouvre à l'envoi ou depuis le repli.
      if (!session.lire(`${cleSession}pdf`)) {
        session.ecrire(`${cleSession}pdf`, '1');
        suivre('pdf_telecharge', { source, profil: resultat.profil });
      }
    } catch (erreur) {
      console.error('[diagnostic] Diagnostic en échec :', erreur?.message ?? erreur, erreur);
      onglet?.close();
      repliNecessaire = true;
      $('pdf-erreur').textContent = onglet === null ? UI.pdf_bloque : UI.pdf_erreur;
      $('pdf-erreur').hidden = false;
    } finally {
      bouton.disabled = false;
      libelle.textContent = UI.bouton_pdf;
      enCours = false;
      majRepli();
    }
  };
  bouton.addEventListener('click', telechargerPdf);
}

// ── 6. Invitation au diagnostic d'équipe ──
function preparerInvitation({ resultat, source }) {
  $('invitation').hidden = !questionnaireEquipe;
  if (!questionnaireEquipe) return;
  $('invitation-texte').textContent = T.invitation_equipe;
  $('invitation-detail').textContent = UI.invitation_detail;
  const lien = $('invitation-lien');
  lien.textContent = UI.bouton_invitation;
  lien.href = config.invitationEquipeUrl;
  lien.addEventListener('click', async (e) => {
    e.preventDefault();
    await suivre('invitation_equipe_cliquee', { source, profil: resultat.profil });
    location.href = config.invitationEquipeUrl;
  });
}

// ── Mode test : /diagnostic/resultat/?test=<profil> ──
function installerBarreTest() {
  const barre = $('testbar');
  const libelles = { vide: 'Sans paramètre', invalide: 'Valeur hors liste', session: 'Questionnaire passé en test' };
  const options = [...Object.keys(exemples), 'vide', 'invalide', 'session']
    .map((p) => `<option value="${p}"${p === choixTest ? ' selected' : ''}>${contenu.profils[p]?.nom ?? libelles[p]}</option>`).join('');
  barre.innerHTML = `<div class="wrap">
    <b>Mode test</b>
    <label>Réponses d'exemple <select id="test-profil">${options}</select></label>
    <label>Envoi Brevo simulé <select id="test-brevo"><option value="succes">Succès</option><option value="echec">Échec</option></select></label>
    <button type="button" id="test-reset">Réinitialiser la session</button>
    <ol id="test-journal" aria-label="Événements de mesure"></ol>
  </div>`;
  barre.hidden = false;
  $('test-profil').addEventListener('change', (e) => { location.search = `?test=${e.target.value}`; });
  $('test-reset').addEventListener('click', () => { session.effacer(PREFIXE); location.reload(); });
  document.addEventListener('diagnostic:mesure', ({ detail }) => {
    const li = document.createElement('li');
    li.textContent = `${detail.nom} ${JSON.stringify(detail.props)}`;
    $('test-journal').append(li);
  });
}
