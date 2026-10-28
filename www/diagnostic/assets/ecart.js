// Explication de l'écart entre le profil perçu (Q1) et le profil calculé.
// Module pur : il compare ce que suppose le profil perçu aux axes calculés,
// et cite les axes qui divergent. Les textes viennent de contenu.js.

import { remplir } from './calcul.js';

// Ce que suppose chaque profil, d'après les règles d'attribution du chapitre 6 (FS-1 v2.1).
// Chaque condition : une clé de texte (contenu.ecart.attendus) et le constat à citer si elle échoue.
const C = {
  diffusionLarge: { texte: 'diffusionLarge', vraie: (a) => a.diffusion >= 2, cite: ['diffusion'] },
  diffusionRestreinte: { texte: 'diffusionRestreinte', vraie: (a) => a.diffusion <= 1, cite: ['diffusion'] },
  sansDispersion: { texte: 'sansDispersion', vraie: (a, d) => !d, cite: ['dispersion'] },
  avanceDeQuelquesUns: { texte: 'avanceDeQuelquesUns', vraie: (a, d) => d, cite: ['dispersion'] },
  capitalIndividuel: { texte: 'capitalIndividuel', vraie: (a) => a.capital === 0, cite: ['capital'] },
  capitalPartage: { texte: 'capitalPartage', vraie: (a) => a.capital >= 1, cite: ['capital'] },
  processMemesEtapes: { texte: 'processMemesEtapes', vraie: (a) => a.process <= 1, cite: ['process'] },
  processTransforme: { texte: 'processTransforme', vraie: (a) => a.process >= 2, cite: ['process'] },
  robustesseSystematique: { texte: 'robustesseSystematique', vraie: (a) => a.robustesse >= 2, cite: ['robustesse'] },
  changementPeuVerifie: {
    texte: 'changementPeuVerifie',
    vraie: (a) => (a.robustesse === 0 && a.process >= 1) || (a.robustesse <= 1 && a.process >= 2),
    cite: ['process', 'robustesse'],
  },
};

export const SUPPOSE = {
  'au-depart': [C.diffusionRestreinte, C.sansDispersion],
  'champions-isoles': [C.diffusionRestreinte, C.avanceDeQuelquesUns],
  'chacun-sa-methode': [C.diffusionLarge, C.capitalIndividuel],
  acceleres: [C.diffusionLarge, C.capitalPartage, C.processMemesEtapes],
  'en-transformation': [C.diffusionLarge, C.capitalPartage, C.processTransforme, C.robustesseSystematique],
  'vitesse-sans-filet': [C.diffusionLarge, C.changementPeuVerifie],
};

const enListe = (elements) => (elements.length <= 1 ? elements.join('') : `${elements.slice(0, -1).join(', ')} et ${elements.at(-1)}`);

/** Constat lisible pour un axe ou pour la dispersion. */
function constat(cle, axes, dispersion, contenu) {
  if (cle === 'dispersion') return dispersion ? contenu.ecart.constats.dispersion : contenu.ecart.constats.sansDispersion;
  const axe = contenu.axes.find((x) => x.cle === cle);
  return `${axe.nom.toLowerCase()} « ${axe.niveaux[axes[cle]]} »`;
}

/**
 * Explique pourquoi les réponses décrivent un autre profil que celui perçu.
 * @returns {string} une ou deux phrases, ou '' si les deux profils sont identiques.
 */
export function expliquerEcart(percu, { axes, dispersion, profil }, contenu) {
  if (percu === profil) return '';
  const nomPercu = contenu.profils[percu].nom;
  const nomCalcule = contenu.profils[profil].nom;
  const echecs = SUPPOSE[percu].filter((c) => !c.vraie(axes, dispersion));

  if (echecs.length === 0) {
    // Tout ce que suppose le profil perçu est vrai : seule la priorité de Vitesse sans filet l'écarte.
    return remplir(contenu.ecart.priorite, { percu: nomPercu, calcule: nomCalcule, constats: constat('robustesse', axes, dispersion, contenu) });
  }
  const attendus = enListe(echecs.map((c) => contenu.ecart.attendus[c.texte]));
  const cles = [...new Set(echecs.flatMap((c) => c.cite))];
  const constats = enListe(cles.map((cle) => constat(cle, axes, dispersion, contenu)));
  return remplir(contenu.ecart.explication, { percu: nomPercu, attendus, constats });
}
