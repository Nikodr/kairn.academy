// Stockage de session du navigateur, protégé s'il est indisponible (navigation privée, blocage).
// Aucun cookie. Le contenu disparaît à la fermeture de l'onglet.

const memoire = new Map();

export const session = {
  lire(cle) {
    try { return sessionStorage.getItem(cle); } catch { return memoire.get(cle) ?? null; }
  },
  ecrire(cle, valeur) {
    try { sessionStorage.setItem(cle, valeur); } catch { memoire.set(cle, valeur); }
  },
  effacer(prefixe) {
    try {
      for (const cle of Object.keys(sessionStorage)) if (cle.startsWith(prefixe)) sessionStorage.removeItem(cle);
    } catch { /* stockage indisponible */ }
    for (const cle of memoire.keys()) if (cle.startsWith(prefixe)) memoire.delete(cle);
  },
};
