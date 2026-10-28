// Calcul du diagnostic express (FS-1, chapitre 6).
// Module pur : aucune dépendance au navigateur, testé par tests/diagnostic/calcul.test.mjs.

// Ordre de maturité, pour la carte des 6 profils du PDF : Vitesse sans filet avant En transformation,
// car c'est un niveau moins abouti (la vitesse sans le contrôle).
export const ORDRE_MATURITE = ['au-depart', 'champions-isoles', 'chacun-sa-methode', 'acceleres', 'vitesse-sans-filet', 'en-transformation'];

export const PROFILS = [
  'au-depart',
  'champions-isoles',
  'chacun-sa-methode',
  'acceleres',
  'en-transformation',
  'vitesse-sans-filet',
];

// Contrat des réponses : écrit par le questionnaire, lu par /diagnostic/resultat (FS-1 v2.1).
// 6 questions à choix unique ; chaque réponse de q2 à q5 correspond à un niveau d'axe.
// « nsp » (Je ne sais pas) est proposé de q3 à q5 ; il compte comme le niveau le plus bas.
export const CONTRAT = {
  q0: { valeurs: ['produit', 'tech', 'mixte'] },
  q1: { valeurs: PROFILS },
  q2: { valeurs: ['rare', 'champions', 'moitie', 'majorite', 'toute'] },
  q3: { valeurs: ['individuel', 'oral', 'bibliotheque', 'socle', 'nsp'] },
  q4: { valeurs: ['rien', 'plus-vite', 'etapes', 'roles', 'nsp'] },
  q5: { valeurs: ['rien', 'cas-par-cas', 'relu', 'cadre', 'nsp'] },
};

// Paramètres transmis tels quels, jamais utilisés dans le calcul.
const TEXTES_LIBRES = ['rid', 'utm_source', 'utm_medium', 'utm_campaign'];
/** Tailles d'équipe proposées dans le bloc email (liste fermée). */
export const TAILLES_EQUIPE = ['1-5', '6-10', '11-20', '21-50', '50+'];

/**
 * Lit les paramètres d'URL (ou du stockage de session) et les valide contre le contrat.
 * @param {URLSearchParams} params
 * @returns {{ valide: true, reponses: object, meta: object } | { valide: false, erreurs: string[] }}
 */
export function lireReponses(params) {
  const reponses = {};
  const erreurs = [];
  for (const [question, regle] of Object.entries(CONTRAT)) {
    const code = (params.get(question) ?? '').trim();
    if (code === '') erreurs.push(`${question} absente`);
    else if (!regle.valeurs.includes(code)) erreurs.push(`${question} hors liste : ${code}`);
    else reponses[question] = code;
  }
  if (erreurs.length) return { valide: false, erreurs };

  const meta = {};
  for (const cle of TEXTES_LIBRES) meta[cle] = (params.get(cle) ?? '').trim();
  return { valide: true, reponses, meta };
}

// Niveau de chaque réponse, de 0 à 3 (FS-1 v2.1, chapitre 6). « nsp » vaut 0.
const NIVEAUX = {
  q2: { rare: 0, champions: 1, moitie: 2, majorite: 2, toute: 3 },
  q3: { nsp: 0, individuel: 0, oral: 1, bibliotheque: 2, socle: 3 },
  q4: { nsp: 0, rien: 0, 'plus-vite': 1, etapes: 2, roles: 3 },
  q5: { nsp: 0, rien: 0, 'cas-par-cas': 1, relu: 2, cadre: 3 },
};

/** Calcule les 4 axes (0 à 3) et la dispersion à partir de réponses validées. */
export function calculerAxes(r) {
  return {
    axes: { diffusion: NIVEAUX.q2[r.q2], capital: NIVEAUX.q3[r.q3], process: NIVEAUX.q4[r.q4], robustesse: NIVEAUX.q5[r.q5] },
    // Écart fort entre les plus avancés et le reste : seulement quand « certains vont très loin ».
    dispersion: r.q2 === 'champions',
  };
}

// Attribution du profil : la première règle vraie l'emporte (FS-1 v2.1, variante « exigeante »).
// La diffusion décide d'abord ; les règles suivantes ne concernent que les équipes où au moins la moitié utilise l'IA.
export const REGLES = [
  ['champions-isoles', (a, d) => a.diffusion <= 1 && d],
  ['au-depart', (a) => a.diffusion <= 1],
  // L'IA a changé la production alors que rien n'est vérifié, ou des étapes ont changé avec une vérification au cas par cas.
  ['vitesse-sans-filet', (a) => (a.robustesse === 0 && a.process >= 1) || (a.robustesse <= 1 && a.process >= 2)],
  ['chacun-sa-methode', (a) => a.capital === 0],
  ['acceleres', (a) => a.process <= 1],
  ['en-transformation', () => true],
];

export function attribuerProfil(axes, dispersion) {
  return REGLES.find(([, regle]) => regle(axes, dispersion))[0];
}

/** Entrée : réponses validées. Sortie : 4 axes, dispersion, profil. */
export function calculerResultat(reponses) {
  const { axes, dispersion } = calculerAxes(reponses);
  return { axes, dispersion, profil: attribuerProfil(axes, dispersion) };
}

/** Nombre de réponses « Je ne sais pas » (q3 à q5), comptées au niveau le plus bas. */
export function compterNsp(r) {
  return ['q3', 'q4', 'q5'].filter((q) => r[q] === 'nsp').length;
}

/** Compare le profil perçu (Q1) au profil calculé. */
export function comparerPerception(percu, calcule) {
  return percu === calcule ? 'confirmation' : 'ecart';
}

/** Remplace les {variables} d'un texte du fichier de contenu. */
export function remplir(texte, variables) {
  return texte.replace(/\{(\w+)\}/g, (tout, cle) => (cle in variables ? variables[cle] : tout));
}

/**
 * Niveaux possibles de chaque axe pour chaque profil, déduits des règles d'attribution
 * (toutes les combinaisons d'axes et de dispersion). Sert à la carte des 6 profils du PDF.
 * @returns {Record<string, Record<'diffusion'|'capital'|'process'|'robustesse', number[]>>}
 */
export function niveauxParProfil() {
  const AXES = ['diffusion', 'capital', 'process', 'robustesse'];
  const carte = Object.fromEntries(PROFILS.map((p) => [p, Object.fromEntries(AXES.map((a) => [a, new Set()]))]));
  for (let diffusion = 0; diffusion <= 3; diffusion++)
    for (let capital = 0; capital <= 3; capital++)
      for (let process = 0; process <= 3; process++)
        for (let robustesse = 0; robustesse <= 3; robustesse++)
          for (const dispersion of [false, true]) {
            const axes = { diffusion, capital, process, robustesse };
            const profil = attribuerProfil(axes, dispersion);
            for (const a of AXES) carte[profil][a].add(axes[a]);
          }
  for (const p of PROFILS) for (const a of AXES) carte[p][a] = [...carte[p][a]].sort();
  return carte;
}

// Priorité en cas d'égalité : le premier axe de la liste l'emporte.
const PRIORITE_VIGILANCE = ['robustesse', 'process', 'capital', 'diffusion'];
const PRIORITE_APPUI = ['diffusion', 'capital', 'process', 'robustesse'];

/**
 * Point d'appui (note la plus haute) et axe à surveiller (note la plus basse) de la page gratuite.
 * - 4 notes identiques : { egal: true, note }.
 * - Sinon { appui, vigilance }, chacun { cle, note } ; appui vaut null si la note la plus haute est 0.
 */
export function pointAppuiEtVigilance(axes) {
  const notes = PRIORITE_APPUI.map((cle) => ({ cle, note: axes[cle] }));
  const max = Math.max(...notes.map((n) => n.note));
  const min = Math.min(...notes.map((n) => n.note));
  if (max === min) return { egal: true, note: max };
  const choisir = (note, priorite) => {
    const cle = priorite.find((c) => axes[c] === note);
    return { cle, note };
  };
  return { appui: max === 0 ? null : choisir(max, PRIORITE_APPUI), vigilance: choisir(min, PRIORITE_VIGILANCE) };
}
