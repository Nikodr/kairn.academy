import data from '../data/opco-atlas-no-pdc.json';
import type { EstimateResult, OpcoId, SizeBand } from '../types';

export interface NoFundingInfo {
  label: string;
  /** Le PDC Atlas de la branche ne finance que les entreprises de moins de N salariés. */
  publicBelow: number;
  updatedAt: string;
  sourceUrl: string;
}

/** Effectif minimal de chaque tranche. */
const BAND_MIN: Record<SizeBand, number> = { lt11: 1, '11-49': 11, '50-299': 50, '300+': 300 };

/**
 * Branche Atlas dont le PDC ne couvre pas cette taille d'entreprise (champ « Public » de la fiche) :
 * c'est alors « pas de financement PDC Atlas », et non « barème à confirmer ».
 */
export function noFundingFor(input: { opco: OpcoId; idcc?: string; sizeBand: SizeBand }): NoFundingInfo | null {
  if (input.opco !== 'atlas' || !input.idcc) return null;
  const branch = data.branches.find((b) => b.idcc.includes(input.idcc as string));
  if (!branch || BAND_MIN[input.sizeBand] < branch.publicBelow) return null;
  return { label: branch.label, publicBelow: branch.publicBelow, updatedAt: branch.updatedAt, sourceUrl: branch.sourceUrl };
}

/** Seulement quand le moteur n'a pas de barème pour cette taille : un résultat chiffré reste chiffré. */
export function noFundingForResult(
  input: { opco: OpcoId; idcc?: string; sizeBand: SizeBand },
  result: EstimateResult,
): NoFundingInfo | null {
  return result.status === 'to_confirm' && result.reason === 'size_not_covered' ? noFundingFor(input) : null;
}
