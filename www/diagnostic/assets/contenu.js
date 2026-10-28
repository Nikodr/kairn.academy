// Textes du diagnostic express, tirés de contenu-diagnostic.md.
// Les clés (codes de profil, noms de champs) sont stables : le code s'appuie dessus.
// Les textes peuvent changer librement, sans toucher à la logique.

export default {
  profils: {
    'au-depart': {
      nom: 'Au départ',
      lecture: "L'IA est là, l'équipe ne s'en est pas encore emparée.",
      description: "L'IA reste rare dans le travail quotidien : personne ne s'en sert, ou seulement quelques personnes de temps en temps. C'est un point de départ, pas un retard : les licences arrivent souvent avant les usages.",
      questions: [
        "Qu'est-ce qui retient l'équipe : le temps, la méfiance, ou le fait de ne pas savoir par où commencer ?",
        "Quel livrable récurrent serait le plus simple à tester avec l'IA ?",
        "Qui, dans l'équipe, pourrait montrer aux autres un premier usage qui marche ?",
      ],
      suivant: 'chacun-sa-methode',
    },
    'champions-isoles': {
      nom: 'Champions isolés',
      lecture: "Vos champions ont pris de l'avance : l'enjeu est d'essaimer sans les freiner.",
      description: "Quelques personnes sont déjà loin et font bouger leur façon de travailler. Le reste de l'équipe ne suit pas, et ce que font les champions circule peu.",
      questions: [
        'Ce que font vos champions est-il visible et reproductible par les autres ?',
        'Vos champions ont-ils le temps et le mandat de partager ce qu\'ils font ?',
        "Qu'est-ce qui retient le reste de l'équipe : les compétences, l'envie, ou le cadre ?",
      ],
      suivant: 'acceleres',
    },
    'chacun-sa-methode': {
      nom: 'Chacun sa méthode',
      lecture: "Tout le monde s'y est mis, chacun à sa façon : le gain reste individuel.",
      description: "Au moins la moitié de l'équipe utilise l'IA, mais chacun avec ses prompts et ses habitudes. Le gain existe, il ne se voit pas encore sur ce que livre l'équipe.",
      questions: [
        "Si une personne part demain, que perd l'équipe de ses usages IA ?",
        'Quel livrable gagnerait à être produit de la même façon par tous ?',
        'Qui pourrait porter un socle commun (prompts, skills, contexte) ?',
      ],
      suivant: 'acceleres',
    },
    acceleres: {
      nom: 'Accélérés',
      lecture: 'Vous allez plus vite, sans avoir changé votre façon de travailler : le gain plafonne.',
      description: "L'équipe utilise l'IA largement et partage ses pratiques. Vos livrables sortent plus vite, mais les étapes sont restées celles d'avant.",
      questions: [
        "Quelle étape de votre process n'existerait pas si vous le conceviez aujourd'hui, avec l'IA ?",
        'Où part le temps gagné : plus de livrables, ou de meilleurs livrables ?',
        'Vos spécifications sont-elles écrites pour des humains seulement, ou aussi pour des agents ?',
      ],
      suivant: 'en-transformation',
    },
    'en-transformation': {
      nom: 'En transformation',
      lecture: "Votre façon de travailler a changé : l'enjeu est de tenir et d'aller plus loin.",
      description: "Des étapes ont disparu ou changé de nature, avec des pratiques qui circulent et une relecture systématique. Les prochains gains se jouent sur l'organisation de l'équipe.",
      questions: [
        "Où se situe aujourd'hui le goulot : la décision, la revue, ou la spec ?",
        "Votre contrôle tient-il quand le volume produit par l'IA augmente ?",
        "Faut-il revoir qui fait quoi dans l'équipe pour aller plus loin ?",
      ],
      suivant: null,
      suivantTexte: "La marche suivante : une équipe recomposée autour de l'IA, avec des frontières entre métiers, des rôles ou une taille repensés.",
    },
    'vitesse-sans-filet': {
      nom: 'Vitesse sans filet',
      lecture: "Vous allez vite, mais personne ne vérifie vraiment ce que produit l'IA.",
      description: "L'IA est très utilisée, parfois jusqu'à changer le process, mais ce qu'elle produit est peu relu ou testé. La vitesse est réelle, le risque aussi.",
      questions: [
        "Qui vérifie ce que produit l'IA avant que ça parte en production ou chez un client ?",
        "Quelle erreur de l'IA vous coûterait le plus cher, et qu'est-ce qui l'arrêterait aujourd'hui ?",
        'Vos règles d\'usage (données, outils) sont-elles écrites et connues de tous ?',
      ],
      suivant: 'en-transformation',
    },
  },

  // Pour chaque axe et chaque niveau (0 à 3) : libellé, situation, et ce qu'il faudrait pour le niveau supérieur.
  // Ajouté le 16/10, à relire par Nicolas.
  axes: [
    {
      cle: 'diffusion',
      nom: 'Diffusion',
      // v2.1 : niveaux 0 à 2 adaptés à la nouvelle question sur la diffusion.
      niveaux: ['Personne, ou de temps en temps', 'Quelques personnes très avancées', "La moitié de l'équipe ou plus", "Toute l'équipe, ou presque"],
      situations: [
        "L'IA reste rare dans le travail quotidien de l'équipe : personne ne s'en sert, ou seulement quelques personnes de temps en temps.",
        "Quelques personnes vont très loin avec l'IA, le reste de l'équipe s'en sert peu ou pas. Le gain dépend de ces personnes.",
        "Au moins la moitié de l'équipe utilise l'IA chaque jour, mais une partie reste à l'écart. Les livrables ne sont pas tous produits de la même façon.",
        "Toute l'équipe, ou presque, utilise l'IA dans son travail. La question n'est plus de savoir qui s'en sert, mais comment.",
      ],
      superieur: [
        "il faudrait que quelques personnes s'en servent chaque jour sur leurs livrables, de façon visible pour l'équipe.",
        "il faudrait qu'au moins la moitié de l'équipe s'en serve dans son travail courant, au-delà des plus avancés.",
        "il faudrait que toute l'équipe, ou presque, s'en serve, y compris les personnes restées à l'écart jusqu'ici.",
        null,
      ],
    },
    {
      cle: 'capital',
      nom: 'Capital commun',
      niveaux: ['Chacun sa configuration', 'Des astuces échangées', 'Une bibliothèque commune', 'Un socle maintenu, repris par défaut'],
      situations: [
        "Chacun a ses propres prompts, outils et réglages. Ce qui marche pour l'un ne profite pas aux autres.",
        'Les bonnes pratiques circulent à l\'oral ou dans une messagerie, sans être rangées nulle part. Elles se perdent avec le temps ou les départs.',
        "Une bibliothèque commune existe et l'équipe y puise. Elle n'est pas forcément tenue à jour, ni reprise par défaut.",
        "L'équipe part d'un socle commun, maintenu dans le temps. Une nouvelle personne en profite dès son arrivée.",
      ],
      superieur: [
        "il faudrait que les pratiques commencent à circuler : que l'on se montre ce qui marche, même de façon informelle.",
        "il faudrait que ces pratiques soient rangées au même endroit : prompts, skills ou contexte accessibles à tous.",
        "il faudrait que ce socle soit maintenu dans le temps, et que chacun parte de lui par défaut plutôt que de sa propre configuration.",
        null,
      ],
    },
    {
      cle: 'process',
      nom: 'Process',
      niveaux: ['Inchangé', 'Accéléré : mêmes étapes, plus vite', 'Transformé : des étapes ont changé', 'Recomposé : rôles ou équipe revus'],
      situations: [
        "L'IA, quand elle est utilisée, n'a pas changé la façon de produire les livrables de l'équipe.",
        "Les livrables sortent plus vite, mais les étapes sont restées celles d'avant. Le gain est réel, et il plafonne.",
        "Certaines étapes ont été repensées avec l'IA : la façon de produire a réellement changé.",
        "Les rôles ou l'organisation de l'équipe ont été revus autour de l'IA.",
      ],
      superieur: [
        "il faudrait que l'IA accélère au moins un livrable récurrent, même sans changer les étapes.",
        "il faudrait que des étapes changent de nature ou disparaissent, parce que l'IA permet de faire autrement.",
        "il faudrait que les rôles ou l'organisation de l'équipe soient revus autour de ces nouvelles étapes.",
        null,
      ],
    },
    {
      cle: 'robustesse',
      nom: 'Robustesse',
      niveaux: ["Rien n'est vérifié", 'Au cas par cas', 'Relecture systématique', 'Revue, tests et règles partagés'],
      situations: [
        "Ce que produit l'IA part tel quel, sans relecture ni test prévus.",
        "La vérification dépend de chacun et de l'enjeu perçu. Une erreur peut passer si personne n'y pense.",
        "Ce que produit l'IA est relu systématiquement. Le contrôle repose sur la relecture humaine.",
        "Revue, tests et règles écrites encadrent ce que produit l'IA, pour toute l'équipe.",
      ],
      superieur: [
        "il faudrait qu'au moins les productions à fort enjeu soient vérifiées avant de partir.",
        "il faudrait que toute production de l'IA soit relue avant de partir, quelle que soit la personne.",
        "il faudrait que la relecture s'appuie sur des tests et des règles écrites, partagées par toute l'équipe.",
        null,
      ],
    },
  ],

  dispersion: "Écart fort entre la personne la plus avancée et la majorité de l'équipe.",

  // Questionnaire (refonte v2.0 du 23/10, v2.1) : 6 questions à choix unique, passage automatique à la suivante.
  // Chaque choix est [code, libellé] ; les codes sont ceux du contrat (calcul.js). De q3 à q5, chaque réponse
  // correspond à un niveau de l'axe (0 à 3), dans l'ordre ; « Je ne sais pas » vaut 0.
  questionnaire: {
    mention: "Vos réponses sont enregistrées de façon anonyme, pour établir le résultat de votre équipe et la comparaison avec d'autres entreprises. Aucune adresse email n'est demandée ici.", // validé RGPD par Nicolas le 16/10
    etape: 'Question {n} sur {total}',
    precedent: 'Précédent',
    suivant: 'Suivant',
    terminer: 'Voir mon résultat',
    aide: 'Une seule réponse : la question suivante s’affiche dès que vous choisissez.',
    erreur: 'Choisissez une réponse pour continuer.',
    questions: [
      {
        cle: 'q0', texte: 'Qui compose l’équipe sur laquelle vous répondez ?',
        choix: [['produit', 'PM et designers seulement'], ['tech', 'Développeurs seulement'], ['mixte', 'Produit et tech ensemble']],
      },
      {
        cle: 'q1', aleatoire: true, texte: 'Laquelle de ces phrases ressemble le plus à votre équipe aujourd’hui ?',
        choix: [
          ['au-depart', 'L’IA est là, mais peu de gens s’en servent vraiment dans l’équipe.'],
          ['champions-isoles', 'Quelques personnes sont très avancées, le reste ne suit pas.'],
          ['chacun-sa-methode', 'Tout le monde s’en sert, chacun à sa façon.'],
          ['acceleres', 'On produit plus vite avec l’IA, mais on travaille comme avant.'],
          ['en-transformation', 'Notre façon de travailler a changé grâce à l’IA, avec des règles et de la relecture.'],
          ['vitesse-sans-filet', 'On va très vite avec l’IA, sans toujours vérifier ce qu’elle produit.'],
        ],
      },
      {
        cle: 'q2', texte: 'Qui utilise l’IA chaque jour dans son travail ?',
        // v2.1 : sans « Je ne sais pas » ; la réponse décide d'abord du profil (Au départ, Champions isolés, ou les autres).
        choix: [
          ['rare', 'Personne, ou quelques personnes de temps en temps'],
          ['champions', 'Quelques personnes, et certaines vont très loin'],
          ['moitie', 'Environ la moitié de l’équipe'],
          ['majorite', 'Plus de la moitié de l’équipe'],
          ['toute', 'Toute l’équipe, ou presque'],
        ],
      },
      {
        cle: 'q3', texte: 'Quand quelqu’un trouve un usage de l’IA qui marche, que se passe-t-il ?',
        choix: [
          ['individuel', 'Il le garde pour lui : chacun a ses propres prompts et outils'],
          ['oral', 'Il en parle, à l’oral ou sur la messagerie'],
          ['bibliotheque', 'Il le range dans une bibliothèque commune : prompts, skills, contexte'],
          ['socle', 'Il enrichit un socle commun, maintenu, que toute l’équipe utilise par défaut'],
          ['nsp', 'Je ne sais pas'],
        ],
      },
      {
        cle: 'q4', texte: 'Qu’est-ce que l’IA a changé dans la façon de produire de l’équipe ?',
        choix: [
          ['rien', 'Rien de visible'],
          ['plus-vite', 'Certains livrables sortent plus vite, avec les mêmes étapes'],
          ['etapes', 'Des étapes ont disparu ou changé de nature'],
          ['roles', 'Les rôles ou l’organisation de l’équipe ont changé'],
          ['nsp', 'Je ne sais pas'],
        ],
      },
      {
        cle: 'q5', texte: 'Avant d’utiliser ce que produit l’IA, que se passe-t-il ?',
        choix: [
          ['rien', 'Rien n’est prévu : ça part tel quel'],
          ['cas-par-cas', 'Chacun vérifie, selon l’enjeu'],
          ['relu', 'Tout est relu, systématiquement'],
          ['cadre', 'Revue, tests et règles écrites, partagés par toute l’équipe'],
          ['nsp', 'Je ne sais pas'],
        ],
      },
    ],
  },

  // Explication de l'écart entre la perception (Q1) et le profil calculé. Ajouté le 16/10, à relire par Nicolas.
  ecart: {
    explication: 'Votre lecture «\u00A0{percu}\u00A0» suppose {attendus}. Or, d\'après vos réponses : {constats}.',
    priorite: "Vos réponses rejoignent «\u00A0{percu}\u00A0» sur plusieurs points. Mais quand l'IA a changé la production alors que ce qu'elle produit est peu vérifié, c'est «\u00A0{calcule}\u00A0» qui l'emporte. D'après vos réponses : {constats}.",
    // v2.1 : conditions des nouvelles règles d'attribution (ecart.js).
    attendus: {
      diffusionLarge: "qu'au moins la moitié de l'équipe utilise l'IA chaque jour",
      diffusionRestreinte: "que l'IA reste l'affaire de quelques personnes",
      capitalIndividuel: 'que chacun garde ses propres prompts et habitudes',
      capitalPartage: "que les usages qui marchent circulent dans l'équipe",
      processMemesEtapes: 'que les étapes de travail sont restées les mêmes',
      processTransforme: 'que des étapes de travail ont changé',
      robustesseSystematique: "que ce que produit l'IA est relu de façon systématique",
      sansDispersion: "que personne n'a pris beaucoup d'avance sur les autres",
      avanceDeQuelquesUns: "que quelques personnes vont très loin avec l'IA",
      changementPeuVerifie: "que l'IA a changé la production alors que ce qu'elle produit est peu vérifié",
    },
    constats: {
      dispersion: 'quelques personnes qui vont très loin',
      sansDispersion: 'personne qui aille nettement plus loin que les autres',
    },
  },

  textes: {
    ecart: 'Vous voyiez votre équipe «\u00A0{percu}\u00A0». Vos réponses décrivent plutôt «\u00A0{calcule}\u00A0».',
    confirmation: 'Vos réponses confirment votre lecture : votre équipe est bien «\u00A0{calcule}\u00A0».',
    // Le détail est en accès libre depuis le 16/10 : l'email donne le PDF complet et le questionnaire d'équipe.
    // Refonte du 17/10 : le PDF est téléchargé, jamais promis par email. Même titre avec ou sans questionnaire d'équipe.
    titre_formulaire: 'Le diagnostic complet de votre équipe, prêt à présenter en interne',
    titre_formulaire_sans_questionnaire: 'Le diagnostic complet de votre équipe, prêt à présenter en interne',
    // Texte du 17/10 (consentement obligatoire, inchangé dans son comportement).
    consentement: "J'accepte de recevoir par email les résultats agrégés et les prochains contenus de kairn.academy. Mes réponses sont utilisées de façon anonyme. Désinscription en un clic.",
    // Page gratuite (refonte du 17/10).
    appui: 'Votre point d\'appui : {axe} ({note}/3).',
    vigilance: 'Votre axe à surveiller : {axe} ({note}/3).',
    axes_egaux: 'Vos 4 axes sont au même niveau ({note}/3).',
    autres_questions: '+ 2 autres questions dans le diagnostic complet',
    erreur_envoi: "L'envoi n'a pas abouti. Vos réponses sont conservées : réessayez dans un instant.",
    invitation_equipe: "Et si vous posiez la question à votre équipe ? Comparez votre lecture à la sienne.",
    sans_resultat: 'Pas encore de résultat ici. Faites le diagnostic en 3 minutes.',
  },

  // Textes d'interface absents de contenu-diagnostic.md, ajoutés pour la page. À relire par Nicolas.
  interface: {
    lien_sans_resultat: 'Faire le diagnostic',
    libelle_email: 'Votre email professionnel',
    // Poste et taille d'équipe (v2.0) : optionnels, demandés avec l'email plutôt qu'avant le résultat. Plus d'entreprise.
    libelle_poste: 'Votre poste (optionnel)',
    exemple_poste: 'CTO, CPO, Head of AI, CEO, Head of Product, Lead dev',
    libelle_taille: "Taille de l'équipe (optionnel)",
    invite_taille: 'Choisir une taille',
    tailles: [['1-5', '1 à 5 personnes'], ['6-10', '6 à 10 personnes'], ['11-20', '11 à 20 personnes'], ['21-50', '21 à 50 personnes'], ['50+', 'Plus de 50 personnes']],
    bouton_envoi: 'Télécharger mon diagnostic (PDF)',
    apercu_alt: 'Aperçu du diagnostic complet',
    // Ce que donne l'email, affiché avant le formulaire (ajout du 16/10, à relire). Sans date pour les résultats agrégés.
    avantages: [
      "Le diagnostic complet en PDF, 10 slides à projeter en interne : vos 4 axes, l'échelle de chaque niveau et la carte des 6 profils d'équipe.",
    ],
    // Puce ajoutée seulement si config.DATE_COMPARATIF est renseignée.
    avantage_comparaison: "Une comparaison anonymisée avec les équipes d'autres entreprises, envoyée le {date}.",
    // Inséré en 2e position seulement quand le questionnaire d'équipe (FS-3) est en ligne (config.invitationEquipeUrl).
    avantage_questionnaire: 'Un questionnaire anonyme de 5 minutes à partager avec votre équipe, pour affiner ce diagnostic avec ses réponses.',
    titre_acces: 'Votre diagnostic complet',
    // Après l'email : le diagnostic s'ouvre dans un nouvel onglet (17/10). {n} diapositives, prêtes à projeter en interne.
    pdf_description: "Votre diagnostic complet s'est ouvert dans un nouvel onglet : une présentation de {n} diapositives, prête à projeter en interne.",
    pdf_description_retour: "Votre diagnostic complet est prêt : une présentation de {n} diapositives, prête à projeter en interne.",
    invitation_detail: 'Un questionnaire anonyme de 5 minutes par personne, à partager avec votre équipe. Ses réponses affinent ce diagnostic.',
    envoi_en_cours: 'Préparation…',
    pdf_secours: "Il ne s'est pas ouvert ?",
    erreur_email: 'Saisissez une adresse email valide.',
    erreur_consentement: 'Cochez la case pour télécharger votre diagnostic.',
    titre_axes: 'Vos 4 axes',
    titre_questions: '3 questions à vous poser',
    titre_question_gratuite: 'Une question à vous poser',
    resultats_partages: "Nous vous montrerons aussi où se situe votre équipe par rapport à celles d'autres entreprises, à partir de résultats anonymisés.",
    niveau_superieur: 'Pour atteindre le niveau supérieur, {texte}',
    niveau_max: "C'est le niveau le plus haut sur cet axe : l'enjeu est de le tenir dans la durée.",
    // Ajout v1.4, à relire.
    note_nsp_une: "Vous avez répondu « Je ne sais pas » à 1 question : elle compte comme le niveau le plus bas, ce qui peut sous-estimer votre équipe.",
    note_nsp: "Vous avez répondu « Je ne sais pas » à {n} questions : elles comptent comme le niveau le plus bas, ce qui peut sous-estimer votre équipe.",
    bouton_invitation: 'Accéder au questionnaire',

    // PDF du diagnostic complet (ajout du 16/10, à relire par Nicolas).
    bouton_pdf: 'Ouvrir le diagnostic complet',
    pdf_en_cours: 'Préparation du diagnostic…',
    pdf_bloque: "Votre navigateur a bloqué l'ouverture du nouvel onglet : cliquez sur le bouton.",
    pdf_erreur: "Le PDF n'a pas pu être créé. Réessayez dans un instant.",
    pdf_nom_fichier: 'diagnostic-kairn-academy-{profil}.pdf',
    pdf_titre: 'Diagnostic express',
    pdf_date: 'Réalisé le {jour}',
    pdf_titre_lecture: 'Votre lecture et vos réponses',
    pdf_intro_echelle: "Chaque axe est noté de 0 à 3. Voici ce que décrit chaque niveau, et ce qu'il faudrait pour atteindre le suivant. Votre niveau est signalé.",
    pdf_votre_niveau: 'Votre niveau',
    pdf_niveau: 'Niveau {n}',
    pdf_pied: 'kairn.academy · Diagnostic express',
    // PDF en diapositives (ajout du 17/10, à relire).
    pdf_titre_superieur: 'Pour atteindre le niveau supérieur',
    pdf_titre_echelle_axe: "L'échelle : {axe}",
    pdf_titre_suite: 'La suite',
    // Dernière diapositive (ajout du 17/10, textes de Nicolas) : comparatif annoncé, offre kairn, lien vers la page contact.
    pdf_suite_comparatif: "Vous recevrez le {date} un comparatif anonymisé pour vous situer par rapport à d'autres entreprises.",
    pdf_titre_offre: 'Aller plus loin avec kairn.academy',
    pdf_offres: [
      {
        nom: 'Formations IA', texte: 'Pour les équipes product et tech, sur vos projets réels.', url: 'https://kairn.academy/formations',
        tracks: [['Track développement', 'pour les développeurs'], ['Track produit', 'pour les PM et les designers']],
        financement: 'Finançables par votre OPCO, selon éligibilité.',
        lien: { texte: 'Simuler mon financement OPCO', url: 'https://kairn.academy/simulateur-opco' },
      },
      { nom: 'Kickstart Spec Driven', texte: "2 ou 3 jours aux côtés de votre PM ou de votre tech lead, sur une feature réelle de votre backlog, avec des skills et des agents faits pour votre équipe.", url: 'https://kairn.academy/formations-kickstart' },
      { nom: 'Dojo IA', texte: "Un Kata par mois (1\u00A0h à 1\u00A0h\u00A030), réservé à votre équipe, sur un sujet précis et opérationnel : une démo, des exercices, et une veille sur les nouveautés utiles.", url: 'https://kairn.academy/dojo-ia' },
      { nom: 'Accompagnement transformation IA', texte: "Pour repenser ensemble l'organisation IA de votre équipe.", url: 'https://kairn.academy/cadrer' },
    ],
    // CTA de la dernière diapositive, selon le profil (17/10). Lien inchangé : kairn.academy/cadrer.
    pdf_cta: {
      'au-depart': 'Lancer l\'IA dans votre équipe : 30 min pour en parler',
      'champions-isoles': 'Faire essaimer vos champions : 30 min pour en parler',
      'chacun-sa-methode': 'Construire votre socle commun : 30 min pour en parler',
      'acceleres': 'Passer de l\'accélération à la transformation : 30 min pour en parler',
      'en-transformation': 'Aller plus loin : 30 min pour en parler',
      'vitesse-sans-filet': 'Parler de votre robustesse en 30 min',
    },
    pdf_contact_lien: 'kairn.academy/cadrer',
    pdf_contact_url: 'https://kairn.academy/cadrer',
    pdf_titre_carte: "Les 6 profils d'équipe",
    pdf_intro_carte: "Chaque profil correspond à une combinaison de niveaux sur les 4 axes, notés de 0 à 3. Chaque ligne montre le niveau type d'un profil, du moins abouti au plus abouti ; la jauge se remplit de gauche à droite. Sur la ligne de votre équipe, la jauge orange montre vos propres niveaux.",
    pdf_legende: ['Niveau type du profil', 'Niveau non atteint', 'Niveau de votre équipe'],
    pdf_colonne_profil: 'Profil',
    pdf_colonne_suivant: 'Marche suivante',
    pdf_vous: 'Votre équipe',
    pdf_suivant_dernier: 'Une équipe recomposée',
    pdf_notes_carte: [
      "Au départ et Champions isolés : moins de la moitié de l'équipe utilise l'IA ; Champions isolés quand certaines personnes vont très loin.",
      "Dès que la moitié de l'équipe utilise l'IA, Vitesse sans filet l'emporte si l'IA a changé la production alors que ce qu'elle produit est peu vérifié.",
    ],
  },
};
