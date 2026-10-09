import type { EstimateResult, ScenarioResult } from '../types';
import { formatEuroHt, formatHours, formatRangeHt, pluralize } from './format';
import type { GenericEstimate } from './generic';

export interface ScenarioView {
  hours: number;
  title: string;
  amount: string;
  context: string;
  perParticipant?: string;
  /** Montant de la formation (par session) moins la prise en charge maximale, si le prix est connu. */
  estimatedRemaining?: string;
  limit: string;
  quote?: { covered: string; remaining: string; fullyCovered: boolean };
}

export type ResultView =
  | {
      kind: 'estimated';
      opcoLabel: string;
      scheme: string;
      scenarios: ScenarioView[];
      notes: string[];
      sourceUrl: string;
      verifiedAt: string;
    }
  | { kind: 'to_confirm'; opcoLabel: string; message: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Reste à charge d'une session : son montant moins la prise en charge, jamais négatif. */
export const remainingAfterCoverage = (priceHt: number, coverageHt: number): number =>
  round2(priceHt - Math.min(priceHt, coverageHt));

function limitSentence(s: ScenarioResult): string {
  const annual = s.annualCeilingHt;
  if (s.hourlyCeilingHt === undefined) {
    return `Plafond annuel de ${formatEuroHt(annual ?? s.maxCoverageHt)} par entreprise, quel que soit le nombre de participants ni la durée de la formation.`;
  }
  if (s.limitedBy === 'annual') {
    return `Limité par le budget annuel de l'entreprise (${formatEuroHt(annual ?? s.maxCoverageHt)} par an). Le plafond horaire seul aurait donné ${formatEuroHt(s.hourlyCeilingHt)}.`;
  }
  const rate = round2(s.hourlyCeilingHt / (s.hours * s.participants));
  return `Limité par le plafond horaire de ${formatEuroHt(rate)} par heure et par stagiaire.`;
}

export type PriceFor = (hours: number) => number | undefined;

export function buildScenarioView(s: ScenarioResult, priceFor?: PriceFor): ScenarioView {
  const view: ScenarioView = {
    hours: s.hours,
    title: `Formation de ${formatHours(s.hours)} h`,
    amount: formatEuroHt(s.maxCoverageHt),
    context: `pour ${pluralize(s.participants, 'participant', 'participants')} par session`,
    limit: limitSentence(s),
  };
  const price = priceFor?.(s.hours);
  if (price !== undefined) view.estimatedRemaining = formatEuroHt(remainingAfterCoverage(price, s.maxCoverageHt));
  if (s.hourlyCeilingHt !== undefined && s.limitedBy === 'hourly' && s.participants > 1) {
    view.perParticipant = `Soit ${formatEuroHt(round2(s.hourlyCeilingHt / s.participants))} par participant.`;
  }
  if (s.coveredHt !== undefined && s.remainingHt !== undefined) {
    view.quote = {
      covered: formatEuroHt(s.coveredHt),
      remaining: formatEuroHt(s.remainingHt),
      fullyCovered: s.remainingHt === 0,
    };
  }
  return view;
}

export function buildResultView(result: EstimateResult, priceFor?: PriceFor): ResultView {
  if (result.status === 'to_confirm') {
    return { kind: 'to_confirm', opcoLabel: result.opcoLabel, message: result.message };
  }
  // Le dépôt avant le début de la formation est obligatoire : on l'ajoute si le barème ne le dit pas déjà.
  // La mention « montants HT, sous réserve… » figure déjà sous le résultat : pas de doublon dans la liste.
  const kept = result.notes.filter((n) => !/^montants ht, sous réserve/i.test(n));
  const notes = kept.some((n) => /avant le début/i.test(n))
    ? kept
    : [...kept, 'Le dossier de prise en charge doit être déposé avant le début de la formation.'];
  return {
    kind: 'estimated',
    opcoLabel: result.opcoLabel,
    scheme: result.scheme,
    scenarios: result.scenarios.map((s) => buildScenarioView(s, priceFor)),
    notes,
    sourceUrl: result.sourceUrl,
    verifiedAt: result.verifiedAt,
  };
}

/** Résumé en une ligne du résultat affiché, pour l'enregistrement du lead. */
export function summarizeResult(result: EstimateResult, priceFor?: PriceFor): string {
  if (result.status === 'to_confirm') return `Barème à confirmer (${result.reason})`;
  return result.scenarios
    .map((s) => {
      const price = s.coveredHt === undefined ? priceFor?.(s.hours) : undefined;
      const remaining = price !== undefined ? `, reste à charge estimé ${formatEuroHt(remainingAfterCoverage(price, s.maxCoverageHt))}` : '';
      const base = `${s.hours} h : jusqu'à ${formatEuroHt(s.maxCoverageHt)} (${s.limitedBy === 'hourly' ? 'plafond horaire' : 'plafond annuel'})${remaining}`;
      return s.coveredHt !== undefined && s.remainingHt !== undefined
        ? `${base}, pris en charge ${formatEuroHt(s.coveredHt)}, reste à charge ${formatEuroHt(s.remainingHt)}`
        : base;
    })
    .join(' | ');
}

export interface GenericScenarioView {
  hours: number;
  title: string;
  amount: string;
  context: string;
  estimatedRemaining?: string;
  quote?: { covered: string; remaining: string };
}

export function buildGenericView(generic: GenericEstimate, priceFor?: PriceFor): {
  scenarios: GenericScenarioView[];
  sources: string[];
  /** Vrai quand la borne haute ne change pas avec la durée (plafond annuel par entreprise). */
  sameHigh: boolean;
} {
  return {
    sources: generic.sources,
    sameHigh: generic.scenarios.length > 1 && generic.scenarios.every((s) => s.highHt === generic.scenarios[0].highHt),
    scenarios: generic.scenarios.map((s) => {
      const view: GenericScenarioView = {
        hours: s.hours,
        title: `Formation de ${formatHours(s.hours)} h`,
        amount: formatRangeHt(s.lowHt, s.highHt),
        context: `pour ${pluralize(s.participants, 'participant', 'participants')} par session`,
      };
      const price = priceFor?.(s.hours);
      if (price !== undefined) {
        // Meilleur cas : prise en charge haute ; pire cas : prise en charge basse.
        view.estimatedRemaining = formatRangeHt(
          remainingAfterCoverage(price, s.highHt),
          remainingAfterCoverage(price, s.lowHt),
        );
      }
      if (s.coveredLowHt !== undefined && s.coveredHighHt !== undefined && s.remainingLowHt !== undefined && s.remainingHighHt !== undefined) {
        view.quote = {
          covered: formatRangeHt(s.coveredLowHt, s.coveredHighHt),
          remaining: formatRangeHt(s.remainingLowHt, s.remainingHighHt),
        };
      }
      return view;
    }),
  };
}

/** Résumé de ce qui est réellement affiché (barème chiffré, fourchette générique ou « à confirmer »). */
export function summarizeDisplayed(result: EstimateResult, generic: GenericEstimate | null, priceFor?: PriceFor): string {
  if (result.status === 'to_confirm' && generic) {
    const ranges = generic.scenarios
      .map((s) => {
        const price = priceFor?.(s.hours);
        const remaining =
          price !== undefined
            ? `, reste à charge estimé ${formatRangeHt(remainingAfterCoverage(price, s.highHt), remainingAfterCoverage(price, s.lowHt))}`
            : '';
        return `${s.hours} h : ${formatRangeHt(s.lowHt, s.highHt)}${remaining}`;
      })
      .join(' | ');
    return `Estimation générique (${result.reason}) : ${ranges}`;
  }
  return summarizeResult(result, priceFor);
}
