import idccTable from '../data/idcc-opco.json';
import { opcoFromIdcc } from '../engine';
import { normalizeIdcc } from './format';
import { opcoLabel } from './options';

export interface ConventionHit {
  idcc: string;
  /** Intitulé officiel, absent pour quelques conventions rares. */
  title?: string;
  /** OPCO habituellement rattaché à cette convention, quand notre table le connaît. */
  opco?: string;
}

/** { idcc: [intitulé court, alias éventuel] } */
type Titles = Record<string, string[]>;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Chargé à la demande : ces intitulés ne pèsent pas sur le premier affichage de la page.
let titlesPromise: Promise<Titles> | null = null;
const loadTitles = (): Promise<Titles> =>
  (titlesPromise ??= import('../data/idcc-titles.json').then((m) => (m.default as { titles: Titles }).titles));

/** Un numéro (≥ 2 chiffres) ou un nom (≥ 3 lettres) : en dessous, la liste serait du bruit. */
export function isSearchable(query: string): boolean {
  const q = query.trim();
  return /^\d+$/.test(q) ? q.length >= 2 : q.length >= 3;
}

const knownIdccs = Object.keys((idccTable as { map: Record<string, unknown> }).map);

export function matchConventions(titles: Titles, query: string, limit = 8): ConventionHit[] {
  const q = query.trim();
  if (!isSearchable(q)) return [];

  let idccs: string[];
  if (/^\d+$/.test(q)) {
    const wanted = String(Number(q));
    idccs = knownIdccs.filter((idcc) => String(Number(idcc)).startsWith(wanted));
    idccs.sort((a, b) => Number(a) - Number(b));
  } else {
    const tokens = fold(q).split(/\s+/).filter(Boolean);
    const scored: { idcc: string; score: number }[] = [];
    for (const [idcc, parts] of Object.entries(titles)) {
      const title = fold(parts[0]);
      const haystack = fold(parts.join(' '));
      if (!tokens.every((t) => haystack.includes(t))) continue;
      // Un mot trouvé dans l'intitulé lui-même passe avant un simple alias.
      const position = title.indexOf(tokens[0]);
      scored.push({ idcc, score: position === -1 ? 1000 : position });
    }
    scored.sort((a, b) => a.score - b.score || a.idcc.localeCompare(b.idcc));
    idccs = scored.map((s) => s.idcc);
  }

  return idccs.slice(0, limit).map((idcc) => {
    const opco = opcoFromIdcc(idcc);
    return { idcc, title: titles[idcc]?.[0], opco: opco ? opcoLabel(opco) : undefined };
  });
}

/** Recherche locale d'une convention collective par nom ou numéro (aucun appel réseau). */
export async function searchConventions(query: string): Promise<ConventionHit[]> {
  if (!isSearchable(query)) return [];
  return matchConventions(await loadTitles(), query);
}

export { normalizeIdcc };
