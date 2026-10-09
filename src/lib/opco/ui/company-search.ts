import { normalizeCompany, sizeBandFromInsee } from '../registry';
import type { CompanyInfo } from '../types';

const ENDPOINT = 'https://recherche-entreprises.api.gouv.fr/search';

export interface CompanyHit extends CompanyInfo {
  /** Commune du siège : sert à départager les homonymes dans la liste. */
  city?: string;
  /** Code d'activité (NAF) de l'unité légale : aide à départager les homonymes. */
  naf?: string;
  /** Année de la tranche d'effectif INSEE, pour signaler une donnée ancienne. */
  insee_year?: string;
}

interface RawHit {
  siren?: string;
  nom_complet?: string;
  tranche_effectif_salarie?: string | null;
  annee_tranche_effectif_salarie?: string | null;
  activite_principale?: string | null;
  siege?: {
    siret?: string;
    liste_idcc?: string[] | null;
    region?: string;
    tranche_effectif_salarie?: string | null;
    libelle_commune?: string;
  };
  complements?: { liste_idcc?: string[] | null };
}

/** Un SIREN/SIRET collé avec des espaces ("884 731 514") doit rester une recherche numérique. */
export function cleanQuery(query: string): string {
  const q = query.trim();
  return /^[\d\s]+$/.test(q) ? q.replace(/\s/g, '') : q;
}

const hasHeadcount = (code: string | null | undefined): code is string => !!code && code !== 'NN';

/**
 * Recherche dans le registre public. S'appuie sur la normalisation du moteur (aucune donnée de
 * dirigeant conservée), et préfère l'effectif de l'unité légale à celui du seul siège.
 */
export async function searchRegistry(query: string, signal?: AbortSignal): Promise<CompanyHit[]> {
  const q = cleanQuery(query);
  if (q.length < 3) return [];
  const res = await fetch(`${ENDPOINT}?q=${encodeURIComponent(q)}&per_page=6`, { signal });
  if (!res.ok) throw new Error(`Registre d'entreprises indisponible (HTTP ${res.status})`);
  const data = (await res.json()) as { results?: RawHit[] };

  const hits: CompanyHit[] = [];
  for (const raw of data.results ?? []) {
    const company = normalizeCompany(raw);
    if (!company) continue;
    const insee = hasHeadcount(raw.tranche_effectif_salarie) ? raw.tranche_effectif_salarie : company.insee;
    hits.push({
      ...company,
      insee,
      sizeBand: sizeBandFromInsee(insee),
      city: raw.siege?.libelle_commune,
      naf: raw.activite_principale ?? undefined,
      insee_year: hasHeadcount(insee) ? (raw.annee_tranche_effectif_salarie ?? undefined) : undefined,
    });
  }
  return hits;
}
