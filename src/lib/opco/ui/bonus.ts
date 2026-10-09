import data from '../data/opco-bonuses.json';
import { atlasBranchFromIdcc } from '../engine';
import type { OpcoId, SizeBand } from '../types';

export interface BonusInfo {
  id: string;
  label: string;
  /** Enveloppe supplémentaire par entreprise et par an, en € HT. */
  amountHt: number;
  condition: string;
  notes: string[];
  updatedAt: string;
  sourceUrl: string;
}

/** Bonus applicable : uniquement les cas relevés à la source (Atlas BET, toutes tailles pour l'instant). */
export function bonusFor(input: { opco: OpcoId; idcc?: string; sizeBand: SizeBand }): BonusInfo | null {
  const branch = input.opco === 'atlas' ? atlasBranchFromIdcc(input.idcc) : undefined;
  const found = data.bonuses.find(
    (b) => b.opco === input.opco && b.branch === branch && input.sizeBand in b.annualCapByBand,
  );
  if (!found) return null;
  return {
    id: found.id,
    label: found.label,
    amountHt: (found.annualCapByBand as Record<string, number>)[input.sizeBand],
    condition: found.condition,
    notes: found.notes,
    updatedAt: found.updatedAt,
    sourceUrl: found.sourceUrl,
  };
}

/** Prise en charge avec le bonus (cumulé au plafond) et reste à charge sur le prix de la session, si connu. */
export function withBonus(maxCoverageHt: number, bonus: BonusInfo, priceHt?: number): { totalHt: number; remainingHt?: number } {
  const totalHt = maxCoverageHt + bonus.amountHt;
  if (priceHt === undefined) return { totalHt };
  return { totalHt, remainingHt: Math.round((priceHt - Math.min(priceHt, totalHt)) * 100) / 100 };
}
