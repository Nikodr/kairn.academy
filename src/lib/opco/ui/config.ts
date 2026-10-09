const env = import.meta.env;

/** Organisme qui dispense et facture les formations (seul certifié Qualiopi). */
export const PROVIDER = {
  name: 'The Green Compagnon',
  qualiopiNumber: '770211-1',
  qualiopiCategory: 'actions de formation',
};

/** Mention de certification, à afficher partout où l'on dit que The Green Compagnon dispense et facture. */
export const QUALIOPI_TEXT = `certifié Qualiopi (n° ${PROVIDER.qualiopiNumber}) au titre de la catégorie « ${PROVIDER.qualiopiCategory} »`;

/** Intermédiaire qui garde le jeton Airtable (Worker Cloudflare ou webhook) : jamais d'accès direct à Airtable. */
export const LEADS_ENDPOINT: string = env.PUBLIC_OPCO_LEADS_ENDPOINT ?? '';

/** Clé de test publique de Cloudflare (réussit toujours), utilisée uniquement en développement. */
const TURNSTILE_DEV_TEST_KEY = '1x00000000000000000000AA';
export const TURNSTILE_SITE_KEY: string =
  env.PUBLIC_TURNSTILE_SITE_KEY ?? (env.DEV ? TURNSTILE_DEV_TEST_KEY : '');

/** Durées simulées côte à côte : fixées par décision produit, non modifiables par l'utilisateur. */
export const DURATIONS_HOURS = [7, 14];

/** Montant de la formation affiché dans chaque scénario, en € HT, par durée (en heures). */
export const TRAINING_PRICE_HT: Record<number, number> = { 7: 3000, 14: 6000 };

/** Une session accueille au plus 12 personnes : le montant de la formation est par session. */
export const MAX_PARTICIPANTS_PER_SESSION = 12;

/** À faire valider par TGC (responsable du traitement) : doit être identique dans la politique de confidentialité. */
export const RETENTION_YEARS = 3;

/** À incrémenter à chaque changement du texte de consentement, pour savoir à quelle version chaque personne a consenti. */
export const CONSENT_VERSION = '2026-10-09';

export const CONTACT_EMAIL = 'nicolas@kairn.academy';
export const CONTACT_PATH = '/contact';
export const PRIVACY_PATH = '/confidentialite';
