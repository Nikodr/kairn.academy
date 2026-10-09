import rules from '../data/opco-rules.json';
import { estimate } from '../engine';
import type { OpcoId, SizeBand } from '../types';

export interface GenericScenario {
  hours: number;
  participants: number;
  lowHt: number;
  highHt: number;
  /** Renseignés uniquement si un devis a été saisi. */
  coveredLowHt?: number;
  coveredHighHt?: number;
  remainingLowHt?: number;
  remainingHighHt?: number;
}

export interface GenericEstimate {
  scenarios: GenericScenario[];
  /** Barèmes relevés à la source qui bornent la fourchette. */
  sources: string[];
}

interface Reference {
  label: string;
  opco: OpcoId;
  idcc?: string;
}

/** Les barèmes réellement chiffrés par le moteur : la fourchette générique ne s'appuie sur rien d'autre. */
const REFERENCES: Reference[] = [
  { label: rules.opcos.afdas.label, opco: 'afdas' },
  ...Object.entries(rules.opcos.atlas.branches).map(([key, branch]) => ({
    label: `${rules.opcos.atlas.label}, branche ${key.toUpperCase()}`,
    opco: 'atlas' as const,
    idcc: branch.idcc[0],
  })),
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Ordre de grandeur quand le barème exact est inconnu : du plus bas au plus haut des plafonds
 * relevés pour cette taille d'entreprise. Sans au moins deux barèmes applicables, il n'y a pas
 * de fourchette honnête à afficher (null).
 */
export function genericEstimate(input: {
  sizeBand: SizeBand;
  participants: number;
  durationsHours: number[];
  quoteHt?: number;
}): GenericEstimate | null {
  const usable = REFERENCES.map((ref) => ({
    ref,
    results: input.durationsHours.map((hours) =>
      estimate({
        opco: ref.opco,
        idcc: ref.idcc,
        sizeBand: input.sizeBand,
        participants: input.participants,
        durationsHours: [hours],
      }),
    ),
  })).filter(({ results }) => results.every((r) => r.status === 'estimated'));

  if (usable.length < 2) return null;

  const scenarios = input.durationsHours.map((hours, i): GenericScenario => {
    const values = usable.map(({ results }) => {
      const r = results[i];
      return r.status === 'estimated' ? r.scenarios[0].maxCoverageHt : 0;
    });
    const lowHt = Math.min(...values);
    const highHt = Math.max(...values);
    const scenario: GenericScenario = { hours, participants: input.participants, lowHt, highHt };
    if (input.quoteHt !== undefined) {
      scenario.coveredLowHt = round2(Math.min(input.quoteHt, lowHt));
      scenario.coveredHighHt = round2(Math.min(input.quoteHt, highHt));
      scenario.remainingLowHt = round2(input.quoteHt - scenario.coveredHighHt);
      scenario.remainingHighHt = round2(input.quoteHt - scenario.coveredLowHt);
    }
    return scenario;
  });

  return { scenarios, sources: usable.map(({ ref }) => ref.label) };
}
