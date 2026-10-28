// Envoi des lignes anonymes à la Google Sheet (FS-1 v2.0, US-8).
// L'email, le poste et la taille n'arrivent qu'avec le message « email » (après le consentement).

import config from './config.js';

const QUESTIONS = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5'];
export const COLONNES = [
  'id', ...QUESTIONS,
  'profil', 'axe_diffusion', 'axe_capital', 'axe_process', 'axe_robustesse', 'dispersion',
  'utm_source', 'utm_medium', 'utm_campaign',
];

/** Ligne anonyme de la Google Sheet pour un questionnaire terminé. Une donnée absente reste vide. */
export function ligneReponse({ reponses, meta, resultat }) {
  return {
    id: meta.rid,
    ...Object.fromEntries(QUESTIONS.map((q) => [q, reponses[q] ?? ''])),
    profil: resultat.profil,
    axe_diffusion: String(resultat.axes.diffusion),
    axe_capital: String(resultat.axes.capital),
    axe_process: String(resultat.axes.process),
    axe_robustesse: String(resultat.axes.robustesse),
    dispersion: resultat.dispersion ? 'oui' : 'non',
    utm_source: meta.utm_source,
    utm_medium: meta.utm_medium,
    utm_campaign: meta.utm_campaign,
  };
}

/**
 * Envoie un message au script de la Google Sheet : { type: 'reponse', ligne } ou { type: 'email', id, email, titre, taille }.
 * Le script ne permet pas de lire sa réponse depuis un autre domaine : l'envoi part sans attendre de retour,
 * et continue même si la page change (keepalive).
 */
export function envoyerSheet(message, { test = false } = {}) {
  if (test || !config.sheetUrl) {
    if (!test) console.warn('[diagnostic] URL de la Google Sheet non configurée (config.sheetUrl) : rien n\'est enregistré.');
    console.info('[diagnostic] Google Sheet, non envoyé :', message);
    return;
  }
  try {
    fetch(config.sheetUrl, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(message),
    }).catch((erreur) => console.warn('[diagnostic] Envoi à la Google Sheet en échec :', erreur));
  } catch (erreur) {
    console.warn('[diagnostic] Envoi à la Google Sheet en échec :', erreur);
  }
}
