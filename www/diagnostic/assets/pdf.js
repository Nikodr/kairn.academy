// PDF du diagnostic complet, au format présentation 16:9 : un CTO peut le projeter en interne tel quel.
// Généré dans le navigateur (aucun serveur). jsPDF est hébergé avec le site et chargé seulement au clic,
// avec contrôle d'intégrité. Le PDF ne contient aucune donnée personnelle : ni email, ni titre.

import config from './config.js';
import contenu from './contenu.js';
import { ORDRE_MATURITE, lireReponses, calculerResultat, remplir, comparerPerception, compterNsp } from './calcul.js';
import exemples from './exemples.js';
import { expliquerEcart } from './ecart.js';

const JSPDF = {
  src: '/diagnostic/assets/vendor/jspdf-4.2.1.umd.min.js',
  integrite: 'sha512-plOdviVmws4Y3JAvbnpfKb2hVxKM1lCwsi3vmElYRj+tiDLffZ4FVUj5a8vyKJ9pIgl8JCAHEJ4D1iUKBecswg==',
};

let chargement = null;
function chargerJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  chargement ??= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = JSPDF.src;
    s.integrity = JSPDF.integrite;
    s.crossOrigin = 'anonymous';
    s.onload = () => (window.jspdf?.jsPDF ? ok(window.jspdf.jsPDF) : ko(new Error('jsPDF absent')));
    s.onerror = () => { chargement = null; ko(new Error('jsPDF non chargé')); };
    document.head.append(s);
  });
  return chargement;
}

// Charte (home.html)
const C = {
  plum: [63, 4, 52], plum950: [36, 2, 30], plum800: [78, 14, 67], plum600: [110, 63, 102], plum200: [232, 213, 228],
  lilac: [244, 236, 242], line: [234, 220, 230], ground: [251, 247, 250], bone: [245, 239, 244],
  orange: [241, 107, 82], orangeInk: [180, 67, 44], orangeWash: [253, 237, 232], blanc: [255, 255, 255],
};
const DIAPO = { l: 254, h: 142.875 }; // 16:9
const M = 14; // marges
const L = DIAPO.l - 2 * M; // largeur utile
const PT = 0.3528; // mm par point

/** Découpe un texte à {variables} en segments, les valeurs en gras. */
function segmentsAvecGras(texte, variables, couleur, couleurGras = C.plum) {
  return texte.split(/(\{\w+\})/).filter(Boolean).map((m) => {
    const cle = m.match(/^\{(\w+)\}$/)?.[1];
    return cle && cle in variables ? { texte: variables[cle], gras: true, couleur: couleurGras } : { texte: m, couleur };
  });
}

/**
 * Compose la présentation : une idée par diapositive.
 * @param {{ resultat: object, reponses: object, dateComparatif?: string }} donnees
 *   dateComparatif : par défaut config.DATE_COMPARATIF ; vide, la diapositive « La suite » est retirée (11 diapositives).
 * @returns {Promise<{ enregistrer: () => void, doc: object }>}
 */
export async function creerPdf({ resultat, reponses, dateComparatif = config.DATE_COMPARATIF }) {
  const jsPDF = await chargerJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: [DIAPO.l, DIAPO.h], orientation: 'landscape' });
  const UI = contenu.interface;
  const T = contenu.textes;
  const profil = contenu.profils[resultat.profil];

  doc.setProperties({ title: `${UI.pdf_titre} · ${profil.nom}`, author: 'kairn.academy', subject: UI.pdf_titre });
  doc.setLanguage?.('fr');

  // ── Outils ──
  const police = (taille, gras = false) => { doc.setFont('helvetica', gras ? 'bold' : 'normal'); doc.setFontSize(taille); };
  const couleur = (c) => doc.setTextColor(...c);

  /** Texte riche : segments { texte, gras, couleur }, retour à la ligne par mot, dessiné à (x, y). Renvoie la hauteur. */
  function texte(segments, { x = M, y = 0, largeur = L, taille = 11, interligne = 1.4, dessiner = true } = {}) {
    if (!Array.isArray(segments)) segments = [{ texte: segments }];
    // Mots : suites de morceaux sans espace ordinaire (l'espace insécable garde « Nom » ensemble).
    const mots = [[]];
    for (const seg of segments) {
      seg.texte.split(' ').forEach((part, i) => {
        if (i > 0 && mots.at(-1).length) mots.push([]);
        if (part) mots.at(-1).push({ ...seg, texte: part.replace(/ /g, ' ') });
      });
    }
    const largeurDe = (mot) => mot.reduce((t, p) => { police(taille, p.gras); return t + doc.getTextWidth(p.texte); }, 0);
    police(taille);
    const espace = doc.getTextWidth(' ');
    const lignes = [[]];
    let courant = 0;
    for (const mot of mots.filter((m) => m.length)) {
      const w = largeurDe(mot);
      if (lignes.at(-1).length && courant + espace + w > largeur) { lignes.push([]); courant = 0; }
      const xMot = lignes.at(-1).length ? courant + espace : 0;
      lignes.at(-1).push({ mot, x: xMot });
      courant = xMot + w;
    }
    const hLigne = taille * PT * interligne;
    if (dessiner) {
      lignes.forEach((ligne, n) => {
        for (const { mot, x: xMot } of ligne) {
          let xp = x + xMot;
          for (const p of mot) {
            police(taille, p.gras);
            couleur(p.couleur ?? C.plum600);
            doc.text(p.texte, xp, y + n * hLigne, { baseline: 'top' });
            xp += doc.getTextWidth(p.texte);
          }
        }
      });
    }
    return lignes.length * hLigne;
  }

  /** Nouvelle diapositive, fond clair et titre ; renvoie l'ordonnée sous le titre. */
  function diapo(titre, { sousTitre, tailleSousTitre = 10.5 } = {}) {
    doc.addPage([DIAPO.l, DIAPO.h], 'landscape');
    doc.setFillColor(...C.ground); doc.rect(0, 0, DIAPO.l, DIAPO.h, 'F');
    doc.setFillColor(...C.orange); doc.rect(M, M - 4, 10, 1.4, 'F');
    let y = M + 1;
    y += texte([{ texte: titre, gras: true, couleur: C.plum }], { y, taille: 22, interligne: 1.15 });
    if (sousTitre) { y += 2; y += texte(sousTitre, { y, taille: tailleSousTitre, interligne: 1.4 }); }
    return y + 8;
  }

  /** Barre segmentée de 0 à 3, comme sur la page résultat. */
  function barre(note, x, y, largeur, hauteur = 3) {
    const ecart = 1.2;
    const w = (largeur - 2 * ecart) / 3;
    for (let i = 0; i < 3; i++) {
      doc.setFillColor(...(i < note ? C.plum : C.plum200));
      doc.roundedRect(x + i * (w + ecart), y, w, hauteur, 1, 1, 'F');
    }
  }

  const libelleSuperieur = remplir(UI.niveau_superieur, { texte: '' }).trim();
  const phraseSuperieur = (axe, note, couleurTexte = C.plum800) => (axe.superieur[note]
    ? [{ texte: `${libelleSuperieur} `, gras: true, couleur: C.plum }, { texte: axe.superieur[note], couleur: couleurTexte }]
    : [{ texte: UI.niveau_max, couleur: couleurTexte }]);
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ── 1. Couverture ──
  doc.setFillColor(...C.plum); doc.rect(0, 0, DIAPO.l, DIAPO.h, 'F');
  police(16, true);
  let x = M;
  for (const [morceau, c] of [['k', C.bone], ['ai', C.orange], ['rn', C.bone]]) { couleur(c); doc.text(morceau, x, M, { baseline: 'top' }); x += doc.getTextWidth(morceau); }
  police(16, false); couleur(C.plum200); doc.text('.academy', x, M, { baseline: 'top' });
  police(12, true); couleur(C.orange); doc.text(UI.pdf_titre.toUpperCase(), M, 48, { baseline: 'top', charSpace: 0.6 });
  police(42, true);
  const largeurNom = Math.min(doc.getTextWidth(profil.nom), L);
  doc.setFillColor(...C.orange);
  doc.rect(M - 1, 56 + 42 * PT * 0.56, largeurNom + 2, 42 * PT * 0.38, 'F');
  couleur(C.bone); doc.text(profil.nom, M, 56, { baseline: 'top' });
  texte([{ texte: profil.lecture, couleur: C.plum200 }], { y: 80, largeur: 180, taille: 16, interligne: 1.35 });
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  police(10); couleur(C.plum200); doc.text(remplir(UI.pdf_date, { jour: date }), M, DIAPO.h - M, { baseline: 'bottom' });

  // ── 2. Votre lecture et vos réponses ──
  let y = diapo(UI.pdf_titre_lecture);
  const colG = 96;
  const hNom = texte([{ texte: profil.nom, gras: true, couleur: C.plum }], { y, largeur: colG, taille: 16, interligne: 1.2 });
  texte([{ texte: profil.description, couleur: C.plum800 }], { y: y + hNom + 3, largeur: colG, taille: 12, interligne: 1.5 });
  const xB = M + colG + 12;
  const lB = L - colG - 12;
  const percu = contenu.profils[reponses.q1].nom;
  const type = comparerPerception(reponses.q1, resultat.profil);
  const phrase = segmentsAvecGras(type === 'ecart' ? T.ecart : T.confirmation, { percu, calcule: profil.nom }, C.plum800);
  const explication = type === 'ecart' ? expliquerEcart(reponses.q1, resultat, contenu) : '';
  const pad = 7;
  const lt = lB - 2 * pad;
  const hB = texte(phrase, { largeur: lt, taille: 13, dessiner: false })
    + (explication ? 5 + texte(explication, { largeur: lt, taille: 10.5, interligne: 1.45, dessiner: false }) : 0) + 2 * pad;
  doc.setFillColor(...C.lilac); doc.roundedRect(xB, y - 1, lB, hB, 4, 4, 'F');
  const hPhrase = texte(phrase, { x: xB + pad, y: y - 1 + pad, largeur: lt, taille: 13 });
  if (explication) texte(explication, { x: xB + pad, y: y - 1 + pad + hPhrase + 5, largeur: lt, taille: 10.5, interligne: 1.45 });

  // ── 3. Vos 4 axes ──
  y = diapo(UI.titre_axes);
  const ecartCol = 8;
  const lCol = (L - 3 * ecartCol) / 4;
  contenu.axes.forEach((axe, i) => {
    const xc = M + i * (lCol + ecartCol);
    const note = resultat.axes[axe.cle];
    const hAxe = texte([{ texte: axe.nom, gras: true, couleur: C.plum }], { x: xc, y, largeur: lCol - 14, taille: 12, interligne: 1.2 });
    police(12, true); couleur(C.plum600); doc.text(`${note} / 3`, xc + lCol, y, { baseline: 'top', align: 'right' });
    const yb = y + Math.max(hAxe, 6) + 3;
    barre(note, xc, yb, lCol, 3.4);
    const hNiv = texte([{ texte: axe.niveaux[note], gras: true, couleur: C.plum800 }], { x: xc, y: yb + 8, largeur: lCol, taille: 11, interligne: 1.3 });
    texte(axe.situations[note], { x: xc, y: yb + 10 + hNiv, largeur: lCol, taille: 10, interligne: 1.45 });
  });
  const notes = [];
  if (resultat.dispersion) notes.push([{ texte: contenu.dispersion, gras: true, couleur: C.plum950 }]);
  const nsp = compterNsp(reponses);
  if (nsp) notes.push([{ texte: nsp === 1 ? UI.note_nsp_une : remplir(UI.note_nsp, { n: nsp }), couleur: C.plum600 }]);
  let yNote = DIAPO.h - M - 4;
  for (const n of notes.reverse()) {
    const h = texte(n, { largeur: L - 12, taille: 10, dessiner: false });
    yNote -= h + 6;
    doc.setFillColor(...C.orangeWash); doc.roundedRect(M, yNote, L, h + 6, 3, 3, 'F');
    texte(n, { x: M + 6, y: yNote + 3, largeur: L - 12, taille: 10 });
    yNote -= 3;
  }

  // ── 4. Pour atteindre le niveau supérieur ──
  y = diapo(UI.pdf_titre_superieur);
  const hLigneAxe = (DIAPO.h - y - M - 4) / 4;
  contenu.axes.forEach((axe, i) => {
    const yl = y + i * hLigneAxe;
    const note = resultat.axes[axe.cle];
    if (i > 0) { doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, yl - 4, M + L, yl - 4); }
    const hNomAxe = texte([{ texte: axe.nom, gras: true, couleur: C.plum }], { y: yl, largeur: 48, taille: 12, interligne: 1.2 });
    barre(note, M, yl + hNomAxe + 2, 30, 2.4);
    police(9, true); couleur(C.plum600); doc.text(`${note} / 3`, M + 34, yl + hNomAxe + 3.2, { baseline: 'middle' });
    const suite = axe.superieur[note] ? majuscule(axe.superieur[note]) : UI.niveau_max;
    texte([{ texte: suite, couleur: C.plum800 }], { x: M + 60, y: yl, largeur: L - 60, taille: 12.5, interligne: 1.4 });
  });

  // ── 5. 3 questions à vous poser ──
  y = diapo(UI.titre_questions) + 2;
  for (const [i, q] of profil.questions.entries()) {
    doc.setFillColor(...C.plum); doc.circle(M + 6, y + 4.5, 6, 'F');
    police(14, true); couleur(C.blanc); doc.text(String(i + 1), M + 6, y + 4.7, { align: 'center', baseline: 'middle' });
    y += Math.max(12, texte([{ texte: q, couleur: C.plum950 }], { x: M + 19, y, largeur: L - 19, taille: 16, interligne: 1.3 })) + 10;
  }

  // ── 6. Les 6 profils d'équipe : niveau type de chaque profil sur les 4 axes, en jauge ──
  y = diapo(UI.pdf_titre_carte, { sousTitre: UI.pdf_intro_carte, tailleSousTitre: 9.5 }) - 4;
  const couleursLegende = [C.plum, C.plum200, C.orange];
  let xLegende = M;
  UI.pdf_legende.forEach((libelle, i) => {
    doc.setFillColor(...couleursLegende[i]);
    doc.roundedRect(xLegende, y, 3.6, 3.6, 0.6, 0.6, 'F');
    police(9.5, false); couleur(C.plum800);
    doc.text(libelle, xLegende + 5.4, y - 0.2, { baseline: 'top' });
    xLegende += 5.4 + doc.getTextWidth(libelle) + 10;
  });
  y += 8;
  // Niveau type de chaque profil : celui de ses réponses d'exemple (chacune vérifiée par les tests).
  const niveauType = Object.fromEntries(Object.entries(exemples).map(([code, ex]) => [code, calculerResultat(lireReponses(new URLSearchParams(ex)).reponses).axes]));
  const COL = { profil: 60, axe: 30 };
  COL.suivant = L - COL.profil - 4 * COL.axe;
  const xAxe = (i) => M + COL.profil + i * COL.axe;
  const xSuivant = M + COL.profil + 4 * COL.axe;
  const CASE = 4;
  const ESP = 1.6;
  const xCase = (i, n) => xAxe(i) + (COL.axe - (4 * CASE + 3 * ESP)) / 2 + n * (CASE + ESP);
  police(9, true); couleur(C.plum600);
  doc.text(UI.pdf_colonne_profil, M + 2, y, { baseline: 'top' });
  contenu.axes.forEach((axe, i) => doc.text(doc.splitTextToSize(axe.nom, COL.axe - 2), xAxe(i) + COL.axe / 2, y, { baseline: 'top', align: 'center' }));
  doc.text(UI.pdf_colonne_suivant, xSuivant + 3, y, { baseline: 'top' });
  y += 7;
  police(7.5, false); couleur(C.plum600);
  contenu.axes.forEach((axe, i) => { for (let n = 0; n <= 3; n++) doc.text(String(n), xCase(i, n) + CASE / 2, y, { baseline: 'top', align: 'center' }); });
  y += 3.6;
  doc.setDrawColor(...C.plum); doc.setLineWidth(0.5); doc.line(M, y, M + L, y);
  const yHaut = y;
  const hRang = 8.5;
  for (const code of ORDRE_MATURITE) {
    const p = contenu.profils[code];
    const sien = code === resultat.profil;
    const milieu = y + hRang / 2;
    if (sien) { doc.setFillColor(...C.orangeWash); doc.rect(M, y, L, hRang, 'F'); }
    police(10.5, true); couleur(C.plum); doc.text(p.nom, M + 2, milieu, { baseline: 'middle' });
    if (sien) {
      const xTag = M + 2 + doc.getTextWidth(p.nom) + 3;
      police(8, true); couleur(C.orangeInk); doc.text(UI.pdf_vous, xTag, milieu, { baseline: 'middle' });
    }
    // Jauge : remplie de gauche à droite jusqu'au niveau (niveau type, ou niveau réel sur la ligne de l'équipe).
    contenu.axes.forEach((axe, i) => {
      const niveau = sien ? resultat.axes[axe.cle] : niveauType[code][axe.cle];
      for (let n = 0; n <= 3; n++) {
        doc.setFillColor(...(n > niveau ? C.plum200 : sien ? C.orange : C.plum));
        doc.roundedRect(xCase(i, n), milieu - CASE / 2, CASE, CASE, 0.7, 0.7, 'F');
      }
    });
    police(9.5, false); couleur(C.plum800);
    doc.text(p.suivant ? contenu.profils[p.suivant].nom : UI.pdf_suivant_dernier, xSuivant + 3, milieu, { baseline: 'middle' });
    y += hRang;
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, y, M + L, y);
  }
  // Traits verticaux entre les 4 axes
  doc.setDrawColor(...C.plum200); doc.setLineWidth(0.3);
  for (let i = 0; i <= 4; i++) doc.line(xAxe(i), yHaut, xAxe(i), y);
  y += 3;
  for (const note of UI.pdf_notes_carte) y += texte(note, { y, taille: 8, interligne: 1.35 }) + 0.6;

  // ── 7 à 10. L'échelle, une diapositive par axe ──
  for (const axe of contenu.axes) {
    y = diapo(remplir(UI.pdf_titre_echelle_axe, { axe: axe.nom }), { sousTitre: UI.pdf_intro_echelle });
    const sienne = resultat.axes[axe.cle];
    const ec = 5;
    const lc = (L - 3 * ec) / 4;
    const hc = DIAPO.h - y - M - 1;
    const pc = 5;
    for (let n = 0; n <= 3; n++) {
      const xc = M + n * (lc + ec);
      const elle = n === sienne;
      doc.setFillColor(...(elle ? C.orangeWash : C.blanc));
      doc.roundedRect(xc, y - 3, lc, hc, 3, 3, 'F');
      doc.setDrawColor(...(elle ? C.orange : C.line)); doc.setLineWidth(elle ? 0.6 : 0.3);
      doc.roundedRect(xc, y - 3, lc, hc, 3, 3, 'S');
      let yc = y + 1;
      police(9, true); couleur(elle ? C.orangeInk : C.plum600);
      doc.text(remplir(UI.pdf_niveau, { n }).toUpperCase(), xc + pc, yc, { baseline: 'top', charSpace: 0.3 });
      if (elle) doc.text(UI.pdf_votre_niveau, xc + lc - pc, yc, { baseline: 'top', align: 'right' });
      barre(n, xc + pc, yc + 5.5, 24, 2.2);
      yc += 11;
      yc += texte([{ texte: axe.niveaux[n], gras: true, couleur: C.plum }], { x: xc + pc, y: yc, largeur: lc - 2 * pc, taille: 11.5, interligne: 1.25 }) + 3;
      yc += texte([{ texte: axe.situations[n], couleur: C.plum800 }], { x: xc + pc, y: yc, largeur: lc - 2 * pc, taille: 9.5, interligne: 1.35 }) + 3.5;
      texte(phraseSuperieur(axe, n, C.plum600), { x: xc + pc, y: yc, largeur: lc - 2 * pc, taille: 9, interligne: 1.35 });
    }
  }

  // ── 11. La suite : le comparatif annoncé, en diapositive de transition (fond prune, comme la couverture) ──
  // Seulement si la date d'envoi est connue (config.DATE_COMPARATIF) : sinon 11 diapositives.
  let pageSuite = null;
  if (dateComparatif) {
    doc.addPage([DIAPO.l, DIAPO.h], 'landscape');
    pageSuite = doc.getNumberOfPages();
    doc.setFillColor(...C.plum); doc.rect(0, 0, DIAPO.l, DIAPO.h, 'F');
    const phraseComparatif = remplir(UI.pdf_suite_comparatif, { date: dateComparatif });
    const hComparatif = texte([{ texte: phraseComparatif, couleur: C.bone }], { largeur: 200, taille: 24, interligne: 1.3, dessiner: false });
    const yComparatif = (DIAPO.h - hComparatif) / 2 + 4;
    police(12, true); couleur(C.orange); doc.text(UI.pdf_titre_suite.toUpperCase(), M, yComparatif - 10, { baseline: 'top', charSpace: 0.6 });
    texte([{ texte: phraseComparatif, couleur: C.bone }], { y: yComparatif, largeur: 200, taille: 24, interligne: 1.3 });
  }

  // ── 12 (ou 11). L'offre kairn, puis le lien vers la page contact ──
  y = diapo(UI.pdf_titre_offre);
  // La carte Formations, plus riche (2 tracks, financement OPCO), est plus large que les autres.
  const ecOffre = 5;
  const pOffre = 5;
  const poids = UI.pdf_offres.map((o) => (o.tracks ? 1.5 : 1));
  const unite = (L - 3 * ecOffre) / poids.reduce((a, b) => a + b, 0);
  const TO = { nom: 12, texte: 9.5, interligne: 1.4 };
  /** Compose une carte d'offre ; renvoie sa hauteur. Le lien de la carte exclut celui du financement. */
  function carteOffre(o, xo, yo, lo, dessiner) {
    const lt = lo - 2 * pOffre;
    const xt = xo + pOffre;
    let yc = yo + pOffre + 2.5;
    yc += texte([{ texte: o.nom, gras: true, couleur: C.plum }], { x: xt, y: yc, largeur: lt, taille: TO.nom, interligne: 1.25, dessiner }) + 1.5;
    yc += texte([{ texte: o.texte, couleur: C.plum800 }], { x: xt, y: yc, largeur: lt, taille: TO.texte, interligne: TO.interligne, dessiner });
    for (const [nom, detail] of o.tracks ?? []) {
      yc += 1.5;
      if (dessiner) { doc.setFillColor(...C.orange); doc.circle(xt + 1, yc + 1.9, 0.8, 'F'); }
      yc += texte([{ texte: nom, gras: true, couleur: C.plum }, { texte: ` : ${detail}`, couleur: C.plum800 }], { x: xt + 3.5, y: yc, largeur: lt - 3.5, taille: TO.texte, interligne: TO.interligne, dessiner });
    }
    const yLien = yc;
    if (o.financement) {
      yc += 3;
      yc += texte([{ texte: o.financement, gras: true, couleur: C.plum800 }], { x: xt, y: yc, largeur: lt, taille: TO.texte, interligne: TO.interligne, dessiner });
      const hl = texte([{ texte: o.lien.texte, gras: true, couleur: C.orangeInk }], { x: xt, y: yc, largeur: lt, taille: TO.texte, interligne: TO.interligne, dessiner });
      if (dessiner) {
        police(TO.texte, true);
        doc.setDrawColor(...C.orangeInk); doc.setLineWidth(0.25);
        doc.line(xt, yc + hl - 0.6, xt + doc.getTextWidth(o.lien.texte), yc + hl - 0.6);
        doc.link(xt - 1, yc - 1, lt + 2, hl + 2, { url: o.lien.url });
      }
      yc += hl;
    }
    if (dessiner) doc.link(xo, yo, lo, (o.financement ? yLien + 1 : yc) - yo, { url: o.url });
    return yc - yo + pOffre;
  }
  const hOffre = Math.max(...UI.pdf_offres.map((o, i) => carteOffre(o, 0, 0, poids[i] * unite, false)));
  let xo = M;
  UI.pdf_offres.forEach((o, i) => {
    const lo = poids[i] * unite;
    doc.setFillColor(...C.blanc); doc.roundedRect(xo, y, lo, hOffre, 3, 3, 'F');
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.roundedRect(xo, y, lo, hOffre, 3, 3, 'S');
    doc.setFillColor(...C.orange); doc.rect(xo + pOffre, y + pOffre - 1, 8, 1.2, 'F');
    carteOffre(o, xo, y, lo, true);
    xo += lo + ecOffre;
  });
  y += hOffre + 8;
  // Bouton vers la page contact, cliquable dans le PDF
  police(11, true);
  const libelleContact = `${UI.pdf_cta[resultat.profil]}  ·  ${UI.pdf_contact_lien}`;
  const lContact = doc.getTextWidth(libelleContact) + 14;
  doc.setFillColor(...C.orange); doc.roundedRect(M, y, lContact, 10, 5, 5, 'F');
  couleur(C.plum950); doc.text(libelleContact, M + 7, y + 5.2, { baseline: 'middle' });
  doc.link(M, y, lContact, 10, { url: UI.pdf_contact_url });

  // ── Pied de page, sauf sur la couverture ──
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    police(8); couleur(p === pageSuite ? C.plum200 : C.plum600);
    doc.text(UI.pdf_pied, M, DIAPO.h - 6, { baseline: 'bottom' });
    doc.text(`${p} / ${total}`, M + L, DIAPO.h - 6, { baseline: 'bottom', align: 'right' });
  }

  return { doc, enregistrer: () => doc.save(remplir(UI.pdf_nom_fichier, { profil: resultat.profil })) };
}
