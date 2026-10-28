// Configuration du diagnostic express (FS-1, chapitre 6 « Architecture »).
// Les valeurs vides attendent la décision de Nicolas : la page fonctionne sans elles,
// et signale dans la console chaque valeur manquante.

export default {
  // URL du script Apps Script de la Google Sheet, publié en application web (https://script.google.com/macros/s/.../exec).
  // Voir integrations/google-sheet/README.md.
  sheetUrl: 'https://script.google.com/macros/s/AKfycbyiG_hIUcNQAtLDabL9teBxRm7tiG_pqNxIeUxqd44qCLAPbZcU-MWOFEzDGIMaEOl02A/exec',

  // URL d'envoi du formulaire Brevo intégré : l'attribut « action » du formulaire (https://xxxx.sibforms.com/serve/...).
  brevoUrl: 'https://cacd9da4.sibforms.com/serve/MUIFAOlHK0QNY1Td9DZa1l7cH5YjzizQMOdGBdlMxY6e3TDwMZLqDj1fW-b6IpvAtGmHgOVF3l8iSo7cFrtNlwkahi7WAkL2N-1GDVo3-hr3P52rYwLm4VOBQCa5MMcTyeSg1P25--7_6FavBOVvvXQ7vl5a5Jbmy0pGrn9uBiiYfmsqB4lR_x0ZKEfu9akwSbgkAtOqKtjCZ8Nh3A==',

  // true : la page lit la réponse JSON de Brevo pour confirmer l'envoi (voie principale).
  // false : envoi « à l'aveugle » si un test montre que le navigateur ne peut pas lire la réponse (CORS).
  //         Le détail s'ouvre si la requête part sans erreur réseau ; un refus de Brevo n'est alors pas détecté.
  brevoLectureReponse: true,

  // URL du questionnaire d'équipe (FS-3). Vide : le bouton « Accéder au questionnaire » et la promesse
  // du questionnaire dans le bloc email sont masqués (décision du 16/10, en attendant la FS-3).
  invitationEquipeUrl: '',

  // Date d'envoi du comparatif anonymisé avec d'autres entreprises (texte libre, ex. « 15 novembre »).
  // Vide : la puce de la page, la diapositive « La suite » du PDF (11 diapositives au lieu de 12) et la phrase
  // sous le bloc de téléchargement sont retirées.
  DATE_COMPARATIF: '',

  // Outil de mesure d'audience sans cookie : 'plausible', 'umami' ou 'goatcounter' (Umami choisi le 16/10).
  // id : domaine déclaré (Plausible), identifiant du site (Umami) ou code du compte (GoatCounter).
  // domaines (Umami) : seuls ces domaines envoient des mesures ; vide = tous, y compris les tests en local.
  mesure: { outil: 'umami', id: '2077cec7-edcc-43f6-ab09-64a8801a5e51', domaines: 'kairn.academy' },
};
