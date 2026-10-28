// Téléchargement des programmes (PDF) : les liens [data-download-gate] ouvrent la popup #dl-dialog qui demande prénom, nom
// et email. À la validation, le PDF se télécharge aussitôt et le contact part, avec le programme choisi (data-programme du lien),
// vers le formulaire Brevo
// « Téléchargement de programme (site) », liste « Téléchargement de programme ». Sans JavaScript, le lien télécharge directement.
(() => {
  // Adresse du formulaire Brevo « Téléchargement de programme (site) » (liste « Téléchargement de programme », n° 8).
  const BREVO_URL = 'https://cacd9da4.sibforms.com/serve/MUIFAIdT19qMsg6p_VFVnRE4awckledPcGTFYz_SaWVSlOnDia3LGk_1kDtwPnCXGr0SsxrxZeaLCDyE__st5RsvNu67dqjn1wa-t-yBW2L-7T9WHe2qHL9GaUpw8Y-ccEKyahl79cz9oLPYaZpITNVa562BbKmmykJAekY_osKLY5k0bVBCq2YeucaTa1RS41Ika1sdYXCOWmmEPA==';

  const dialog = document.getElementById('dl-dialog');
  const links = document.querySelectorAll('[data-download-gate]');
  if (!dialog || !links.length || typeof dialog.showModal !== 'function') return;
  const form = dialog.querySelector('form');
  const retry = dialog.querySelector('.dl-retry');
  let fichier = '';
  let programme = '';

  /** Envoie le contact à Brevo, comme le script officiel : ?isAjax=1 et réponse JSON { success, errors }. */
  async function envoyer() {
    if (!BREVO_URL) {
      console.warn('[telechargement] URL du formulaire Brevo non configurée (assets/telechargement.js) : contact non envoyé.');
      return;
    }
    const valeur = (nom) => form.elements[nom].value.trim();
    const corps = new FormData();
    corps.append('PRENOM', valeur('prenom'));
    corps.append('NOM', valeur('nom'));
    corps.append('EMAIL', valeur('email'));
    corps.append('PROGRAMME', programme);
    // Champs techniques du formulaire Brevo : piège à robots (doit rester vide) et langue.
    corps.append('email_address_check', '');
    corps.append('locale', 'fr');
    try {
      const reponse = await fetch(`${BREVO_URL}?isAjax=1`, { method: 'POST', body: corps });
      const json = await reponse.json();
      if (!json.success) console.warn('[telechargement] Brevo a refusé le contact :', json.errors);
    } catch (erreur) {
      console.warn('[telechargement] Envoi Brevo en échec (réseau ou CORS) :', erreur);
    }
  }

  const telecharger = () => {
    const a = document.createElement('a');
    a.href = fichier;
    a.download = '';
    document.body.append(a);
    a.click();
    a.remove();
  };

  links.forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    fichier = link.getAttribute('href');
    programme = link.dataset.programme ?? '';
    retry.href = fichier;
    dialog.classList.remove('is-done');
    dialog.showModal();
    ([...form.querySelectorAll('input[required]')].find(el => !el.value.trim()) || form.querySelector('button[type="submit"]')).focus();
  }));

  dialog.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dialog.close()));
  // Clic sur le fond (hors de la carte) : ferme la popup
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  // Messages d'erreur rédigés, comme le formulaire de contact
  const messages = {
    prenom: 'Indiquez votre prénom.',
    nom: 'Indiquez votre nom.',
    email: 'Indiquez un email valide, par exemple prenom@entreprise.fr.',
  };
  const check = name => {
    const field = form.elements[name];
    const ok = field.checkValidity() && field.value.trim() !== '';
    form.querySelector(`#err-dl-${name}`).textContent = ok ? '' : messages[name];
    field.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  };
  Object.keys(messages).forEach(name => form.elements[name].addEventListener('blur', e => {
    if (e.target.getAttribute('aria-invalid') === 'true') check(name);
  }));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const invalid = Object.keys(messages).filter(name => !check(name));
    if (invalid.length) {
      form.elements[invalid[0]].focus();
      return;
    }
    // Le téléchargement part tout de suite, dans le clic ; l'envoi Brevo suit sans le retenir.
    telecharger();
    envoyer();
    dialog.classList.add('is-done');
    dialog.querySelector('.dl-done [data-close]').focus();
  });
})();
