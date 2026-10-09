import type { CompanyInfo, SizeBand } from "./types";

const ENDPOINT = "https://recherche-entreprises.api.gouv.fr/search";

/**
 * Bande d'effectif déduite de la tranche INSEE, uniquement quand elle est sans ambiguïté.
 * "NN" (non renseigné) et "11" (10 à 19, à cheval sur le seuil de 11) renvoient undefined :
 * l'utilisateur doit confirmer.
 */
export function sizeBandFromInsee(code: string | null | undefined): SizeBand | undefined {
  switch (code) {
    case "00": // 0 salarié
    case "01": // 1-2
    case "02": // 3-5
    case "03": // 6-9
      return "lt11";
    case "12": // 20-49
      return "11-49";
    case "21": // 50-99
    case "22": // 100-199
    case "31": // 200-249
      return "50-299";
    // "32" (250-499) est à cheval sur le seuil de 300 : à confirmer par l'utilisateur.
    case "41":
    case "42":
    case "51":
    case "52":
    case "53":
      return "300+";
    default:
      return undefined;
  }
}

interface RawResult {
  siren?: string;
  nom_complet?: string;
  siege?: {
    siret?: string;
    liste_idcc?: string[] | null;
    region?: string;
    tranche_effectif_salarie?: string | null;
  };
  complements?: { liste_idcc?: string[] | null };
}

/** Ne conserve que les champs utiles : aucune donnée de dirigeant n'est retenue. */
export function normalizeCompany(raw: RawResult): CompanyInfo | null {
  if (!raw.siren || !raw.nom_complet) return null;
  const idcc = raw.siege?.liste_idcc ?? raw.complements?.liste_idcc ?? [];
  const insee = raw.siege?.tranche_effectif_salarie ?? null;
  return {
    siren: raw.siren,
    siret: raw.siege?.siret ?? "",
    name: raw.nom_complet,
    idcc,
    region: raw.siege?.region,
    insee,
    sizeBand: sizeBandFromInsee(insee),
  };
}

export async function searchCompanies(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CompanyInfo[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&per_page=5&minimal=false`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Registre d'entreprises indisponible (HTTP ${res.status})`);
  const data = (await res.json()) as { results?: RawResult[] };
  return (data.results ?? []).map(normalizeCompany).filter((c): c is CompanyInfo => c !== null);
}
