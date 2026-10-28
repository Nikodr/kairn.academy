// Mesure du parcours (US-9) : 4 événements, plus le téléchargement du PDF, sans cookie.
// Seules la source UTM et le code du profil sortent vers l'outil : jamais l'email ni le titre.

import config from './config.js';

// Les 4 étapes de la FS, puis le téléchargement du PDF (ajout du 16/10).
export const EVENEMENTS = ['diagnostic_demarre', 'resultat_affiche', 'email_envoye', 'invitation_equipe_cliquee', 'pdf_telecharge'];
const PROPRIETES_AUTORISEES = ['source', 'profil'];

/** Garde uniquement les propriétés autorisées. */
export function proprietesSures(props = {}) {
  const sures = {};
  for (const cle of PROPRIETES_AUTORISEES) if (props[cle]) sures[cle] = String(props[cle]);
  return sures;
}

export const sourceDe = (utmSource) => (utmSource && utmSource.trim()) || 'direct';

// Chaque adaptateur : charge le script de l'outil, puis envoie un événement (rappel quand c'est parti).
const ADAPTATEURS = {
  plausible: {
    script: (id) => ({ src: 'https://plausible.io/js/script.js', attrs: { 'data-domain': id } }),
    envoyer(nom, props, fini) {
      window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
      window.plausible(nom, { props, callback: fini });
    },
  },
  umami: {
    script: (id) => ({
      src: 'https://cloud.umami.is/script.js',
      attrs: { 'data-website-id': id, ...(config.mesure.domaines ? { 'data-domains': config.mesure.domaines } : {}) },
    }),
    envoyer(nom, props, fini) {
      quandPret(() => window.umami, () => Promise.resolve(window.umami.track(nom, props)).finally(fini));
    },
  },
  goatcounter: {
    script: (id) => ({ src: 'https://gc.zgo.at/count.js', attrs: { 'data-goatcounter': `https://${id}.goatcounter.com/count` } }),
    envoyer(nom, props, fini) {
      // GoatCounter ne porte pas de propriétés : elles sont encodées dans le chemin de l'événement.
      const chemin = [nom, props.profil, props.source].filter(Boolean).join('/');
      quandPret(() => window.goatcounter?.count, () => { window.goatcounter.count({ path: chemin, title: nom, event: true }); fini(); });
    },
  },
};

function quandPret(test, action, essais = 40) {
  if (test()) return action();
  if (essais > 0) setTimeout(() => quandPret(test, action, essais - 1), 100);
}

let modeTest = false;
let scriptCharge = false;
export const journal = [];

/** À appeler une fois par page, après le nettoyage de l'URL, pour que l'outil n'enregistre pas les réponses. */
export function initialiserMesure({ test = false } = {}) {
  modeTest = test;
  const adaptateur = ADAPTATEURS[config.mesure.outil];
  if (modeTest || scriptCharge) return;
  if (!adaptateur || !config.mesure.id) {
    console.warn('[diagnostic] Outil de mesure non configuré (config.mesure) : aucun événement envoyé.');
    return;
  }
  const { src, attrs } = adaptateur.script(config.mesure.id);
  const s = document.createElement('script');
  s.src = src;
  s.defer = true;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
  scriptCharge = true;
}

/**
 * Enregistre un événement. Renvoie une promesse résolue quand l'événement est parti,
 * ou au plus tard après `delaiMax` ms (pour ne pas bloquer une navigation).
 */
export function suivre(nom, props, delaiMax = 400) {
  if (!EVENEMENTS.includes(nom)) throw new Error(`Événement inconnu : ${nom}`);
  const sures = proprietesSures(props);
  journal.push({ nom, props: sures });
  document.dispatchEvent(new CustomEvent('diagnostic:mesure', { detail: { nom, props: sures } }));

  const adaptateur = ADAPTATEURS[config.mesure.outil];
  if (modeTest || !adaptateur || !config.mesure.id) {
    console.info(`[diagnostic] ${modeTest ? 'mode test, non envoyé' : 'non envoyé'} :`, nom, sures);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, delaiMax);
    try { adaptateur.envoyer(nom, sures, resolve); } catch { resolve(); }
  });
}
