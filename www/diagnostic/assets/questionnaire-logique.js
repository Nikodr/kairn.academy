// Logique pure du questionnaire (FS-1 v2.0, US-2) : étapes, contrôle, sortie au format du contrat.
// Aucune dépendance au navigateur : testé par tests/diagnostic/questionnaire.test.mjs.

import { CONTRAT } from './calcul.js';

/** Étapes du questionnaire : une question à choix unique par écran. */
export function etapes(contenu) {
  return contenu.questionnaire.questions;
}

/** Mélange une liste (Fisher-Yates), avec un tirage injectable pour les tests. */
export function melanger(liste, tirage = Math.random) {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(tirage() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/** Une étape est-elle répondue ? La réponse doit être l'un de ses choix. */
export function estRepondue(etape, valeur) {
  return etape.choix.some(([code]) => code === valeur);
}

/** Réponses du questionnaire -> chaîne au format du contrat (lue par la page résultat). */
export function versParams(reponses, { id, utm = {} }) {
  const params = new URLSearchParams();
  for (const cle of Object.keys(CONTRAT)) if (reponses[cle]) params.set(cle, reponses[cle]);
  params.set('rid', id);
  for (const cle of ['utm_source', 'utm_medium', 'utm_campaign']) if (utm[cle]) params.set(cle, utm[cle]);
  return params.toString();
}
