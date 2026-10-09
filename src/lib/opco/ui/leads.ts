import type { EstimateResult, OpcoId, SizeBand } from '../types';
import { CONSENT_VERSION, DURATIONS_HOURS, LEADS_ENDPOINT } from './config';
import type { GenericEstimate } from './generic';
import { opcoLabel, sizeLabel } from './options';
import { summarizeDisplayed } from './viewmodel';

export type ResultType = 'Chiffré' | 'Fourchette générique' | 'À confirmer';

/**
 * Données envoyées à l'automatisation Airtable (webhook) qui crée la ligne dans « Simulation OPCO ».
 * Toutes les clés sont toujours présentes (chaîne vide ou null si non renseigné) : Airtable fige la
 * structure à partir d'un exemple, une clé absente d'un envoi la ferait disparaître.
 */
export interface LeadPayload {
  source: 'kairn.academy/simulateur-opco';
  consentVersion: string;
  firstName: string;
  email: string;
  companyName: string;
  siren: string;
  opco: string;
  sizeBand: string;
  idcc: string;
  participants: number;
  quoteHt: number | null;
  coverage7hHt: number | null;
  coverage14hHt: number | null;
  resultType: ResultType;
  resultSummary: string;
  turnstileToken: string;
}

export interface LeadInput {
  firstName: string;
  email: string;
  companyName: string;
  siren?: string;
  opco: OpcoId;
  sizeBand: SizeBand;
  idcc?: string;
  participants: number;
  quoteHt?: number;
  result: EstimateResult;
  generic: GenericEstimate | null;
  turnstileToken: string;
}

function resultTypeOf(input: LeadInput): ResultType {
  if (input.result.status === 'estimated') return 'Chiffré';
  return input.generic ? 'Fourchette générique' : 'À confirmer';
}

/** Plafond chiffré pour une durée, seulement si un barème officiel a été appliqué. */
function coverageFor(result: EstimateResult, hours: number): number | null {
  if (result.status !== 'estimated') return null;
  return result.scenarios.find((s) => s.hours === hours)?.maxCoverageHt ?? null;
}

export function buildLeadPayload(input: LeadInput): LeadPayload {
  const [short, long] = DURATIONS_HOURS;
  return {
    source: 'kairn.academy/simulateur-opco',
    consentVersion: CONSENT_VERSION,
    firstName: input.firstName,
    email: input.email,
    companyName: input.companyName,
    siren: input.siren ?? '',
    opco: opcoLabel(input.opco),
    sizeBand: sizeLabel(input.sizeBand),
    idcc: input.idcc ?? '',
    participants: input.participants,
    quoteHt: input.quoteHt ?? null,
    coverage7hHt: coverageFor(input.result, short),
    coverage14hHt: coverageFor(input.result, long),
    resultType: resultTypeOf(input),
    resultSummary: summarizeDisplayed(input.result, input.generic),
    turnstileToken: input.turnstileToken,
  };
}

const TIMEOUT_MS = 15_000;

/**
 * Le webhook Airtable n'envoie pas d'en-têtes CORS : un envoi JSON serait bloqué par le navigateur.
 * Un formulaire (application/x-www-form-urlencoded) est une requête « simple », donc envoyée sans préalable.
 */
export function toFormBody(payload: LeadPayload): URLSearchParams {
  return new URLSearchParams(Object.entries(payload).map(([key, value]) => [key, value === null ? '' : String(value)]));
}

/**
 * Envoie le lead. Faute d'en-têtes CORS, la réponse est opaque : on ne détecte que les échecs réseau
 * (hors ligne, délai dépassé), pas un refus du serveur.
 */
export async function sendLead(payload: LeadPayload): Promise<void> {
  if (!LEADS_ENDPOINT) {
    if (import.meta.env.DEV) {
      console.info('[simulateur-opco] PUBLIC_OPCO_LEADS_ENDPOINT absent : lead non envoyé (mode développement).', payload);
      return;
    }
    throw new Error("Le service d'enregistrement n'est pas configuré.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(LEADS_ENDPOINT, { method: 'POST', mode: 'no-cors', body: toFormBody(payload), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
