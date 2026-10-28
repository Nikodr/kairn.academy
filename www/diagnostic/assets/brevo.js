// Envoi du formulaire Brevo intégré (US-5, US-8), sans API ni clé.
// Brevo lit les champs par leur nom : chaque attribut doit exister dans le formulaire Brevo (champ caché).

import config from './config.js';

export const ATTRIBUTS = [
  'PROFIL', 'PERCEPTION', 'AXE_DIFFUSION', 'AXE_CAPITAL', 'AXE_PROCESS', 'AXE_ROBUSTESSE',
  'DISPERSION', 'TITRE', 'TAILLE_EQUIPE', 'REPONSE_ID', 'UTM_SOURCE', 'UTM_MEDIUM', 'UTM_CAMPAIGN',
];

/**
 * Champs envoyés à Brevo. Le poste et la taille viennent du bloc email (optionnels).
 * Une valeur absente reste vide : aucune valeur par défaut inventée.
 */
export function champsBrevo({ resultat, reponses, meta, email, poste = '', taille = '' }) {
  return {
    EMAIL: email,
    OPT_IN: '1',
    PROFIL: resultat.profil,
    PERCEPTION: reponses.q1,
    AXE_DIFFUSION: String(resultat.axes.diffusion),
    AXE_CAPITAL: String(resultat.axes.capital),
    AXE_PROCESS: String(resultat.axes.process),
    AXE_ROBUSTESSE: String(resultat.axes.robustesse),
    DISPERSION: resultat.dispersion ? 'true' : 'false',
    TITRE: poste,
    TAILLE_EQUIPE: taille,
    REPONSE_ID: meta.rid,
    UTM_SOURCE: meta.utm_source,
    UTM_MEDIUM: meta.utm_medium,
    UTM_CAMPAIGN: meta.utm_campaign,
    // Champs techniques du formulaire Brevo : anti-robot (doit rester vide) et langue.
    email_address_check: '',
    locale: 'fr',
  };
}

/**
 * Envoie les champs à Brevo.
 * @returns {Promise<{ ok: true } | { ok: false, champ?: string }>}
 */
export async function envoyerBrevo(champs, { simuler } = {}) {
  if (simuler) {
    await new Promise((r) => setTimeout(r, 700));
    return simuler === 'succes' ? { ok: true } : { ok: false };
  }
  if (!config.brevoUrl) {
    console.warn('[diagnostic] URL Brevo non configurée (config.brevoUrl) : envoi impossible.');
    return { ok: false };
  }

  const corps = new FormData();
  for (const [cle, valeur] of Object.entries(champs)) corps.append(cle, valeur);

  try {
    if (!config.brevoLectureReponse) {
      // Repli validé par Nicolas : envoi sans lecture de la réponse.
      await fetch(config.brevoUrl, { method: 'POST', body: corps, mode: 'no-cors' });
      return { ok: true };
    }
    // Voie principale, comme le script officiel de Brevo : ?isAjax=1 et réponse JSON { success, errors }.
    const separateur = config.brevoUrl.includes('?') ? '&' : '?';
    const reponse = await fetch(`${config.brevoUrl}${separateur}isAjax=1`, { method: 'POST', body: corps });
    const json = await reponse.json();
    if (json.success) return { ok: true };
    return { ok: false, champ: json.errors && 'EMAIL' in json.errors ? 'email' : undefined };
  } catch (erreur) {
    console.warn('[diagnostic] Envoi Brevo en échec (réseau ou CORS) :', erreur);
    return { ok: false };
  }
}
