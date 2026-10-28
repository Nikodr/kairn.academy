// Réponses d'exemple, une par profil : utilisées par le mode test de la page résultat
// (/diagnostic/resultat/?test=acceleres), par la carte des 6 profils du PDF et par les tests unitaires.
// Les commentaires donnent les axes attendus : diffusion, capital, process, robustesse (FS-1 v2.1).

const commun = { q0: 'produit', utm_source: 'test' };

export default {
  // D0 C0 P0 R0 (« Je ne sais pas » sur la robustesse)
  'au-depart': { ...commun, rid: 'exemple-au-depart', q1: 'chacun-sa-methode', q2: 'rare', q3: 'individuel', q4: 'rien', q5: 'nsp' },
  // D1 C0 P1 R1, dispersion (certaines personnes vont très loin)
  'champions-isoles': { ...commun, rid: 'exemple-champions-isoles', q1: 'en-transformation', q2: 'champions', q3: 'individuel', q4: 'plus-vite', q5: 'cas-par-cas' },
  // D2 C0 P1 R2
  'chacun-sa-methode': { ...commun, rid: 'exemple-chacun-sa-methode', q1: 'acceleres', q2: 'majorite', q3: 'individuel', q4: 'plus-vite', q5: 'relu' },
  // D3 C2 P1 R2
  acceleres: { ...commun, rid: 'exemple-acceleres', q1: 'acceleres', q2: 'toute', q3: 'bibliotheque', q4: 'plus-vite', q5: 'relu' },
  // D3 C3 P2 R3
  'en-transformation': { ...commun, q0: 'tech', rid: 'exemple-en-transformation', q1: 'vitesse-sans-filet', q2: 'toute', q3: 'socle', q4: 'etapes', q5: 'cadre' },
  // D3 C3 P2 R1
  'vitesse-sans-filet': { ...commun, q0: 'tech', rid: 'exemple-vitesse-sans-filet', q1: 'en-transformation', q2: 'toute', q3: 'socle', q4: 'etapes', q5: 'cas-par-cas' },
};
