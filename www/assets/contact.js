// Envoi des demandes de contact (bloc « Demander un échange de 30 min ») vers le formulaire Brevo
// « Demandes de contact (site) », liste « Demandes de contact ». Sans API ni clé : Brevo lit les champs par leur nom,
// chaque attribut doit donc exister dans ce formulaire Brevo. L'automatisation Brevo « Alerte demande de contact »
// prévient nicolas@kairn.academy à chaque envoi, avec un lien vers la liste.
(() => {
  // Adresse du formulaire Brevo « Demandes de contact (site) » (liste « Demandes de contact », n° 5).
  const BREVO_URL = 'https://cacd9da4.sibforms.com/serve/MUIFAGwpWFoDFyoVT7GJL35MJZRlUESuoxfzFZfgDLyoHMejQ97wpWP4JZ3d8Z-i0wP5vqzHkgoTK9MT8VqtaPHeG4zaM85S1aEy2qmgjKCcsE0Kv9uMYSAhX4LsiOH3nOkaUd68qzNIRXAQW-899pc5JEE4EZ0ZnjeWZTwPICdcXJoOqtKz4STYRgYMsNtHGrN4lvf-u2hOW3WQPg==';
  // Un formulaire Brevo refuse un champ texte de plus de 500 caractères.
  const TEXTE_MAX = 500;

  /** Champs envoyés à Brevo. « Prénom et nom » est coupé au premier espace ; une valeur absente reste vide. */
  function champs(form) {
    const valeur = (nom) => (form.elements[nom]?.value ?? '').trim();
    const [prenom = '', ...reste] = valeur('nom').split(/\s+/);
    return {
      EMAIL: valeur('email'),
      PRENOM: prenom,
      NOM: reste.join(' '),
      ENTREPRISE: valeur('entreprise'),
      EQUIPE_CONCERNEE: valeur('equipe'),
      MESSAGE: valeur('contexte').slice(0, TEXTE_MAX),
      PAGE_SOURCE: form.dataset.source ?? '',
      // Champs techniques du formulaire Brevo : piège à robots (doit rester vide) et langue.
      email_address_check: '',
      locale: 'fr',
    };
  }

  /**
   * Envoie la demande, comme le script officiel de Brevo : ?isAjax=1 et réponse JSON { success, errors }.
   * @returns {Promise<{ ok: true } | { ok: false, champ?: string }>}
   */
  async function envoyer(form) {
    if (!BREVO_URL) {
      console.warn('[contact] URL du formulaire Brevo non configurée (assets/contact.js) : demande non envoyée.');
      return { ok: false };
    }
    const corps = new FormData();
    for (const [cle, valeur] of Object.entries(champs(form))) corps.append(cle, valeur);
    try {
      const reponse = await fetch(`${BREVO_URL}?isAjax=1`, { method: 'POST', body: corps });
      const json = await reponse.json();
      if (json.success) return { ok: true };
      console.warn('[contact] Brevo a refusé la demande :', json.errors);
      return { ok: false, champ: json.errors && 'EMAIL' in json.errors ? 'email' : undefined };
    } catch (erreur) {
      console.warn('[contact] Envoi Brevo en échec (réseau ou CORS) :', erreur);
      return { ok: false };
    }
  }

  window.kairnContact = { envoyer, TEXTE_MAX };
})();
