import rules from "./data/opco-rules.json";
import idccTable from "./data/idcc-opco.json";
import type {
  EstimateInput,
  EstimateResult,
  OpcoId,
  ScenarioResult,
  SizeBand,
} from "./types";

interface BandRule {
  annualCapPerCompany: number;
  hourlyCapPerTrainee?: number;
}
type Bands = Partial<Record<SizeBand, BandRule>>;

const verifiedLabels: Record<string, string> = {
  afdas: rules.opcos.afdas.label,
  atlas: rules.opcos.atlas.label,
};

function opcoLabel(opco: OpcoId): string {
  return (
    verifiedLabels[opco] ??
    (rules.labels as Record<string, string>)[opco] ??
    opco
  );
}

function toConfirm(
  opco: OpcoId,
  reason: Extract<EstimateResult, { status: "to_confirm" }>["reason"],
  message: string,
): EstimateResult {
  return { status: "to_confirm", reason, opco, opcoLabel: opcoLabel(opco), message };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function computeScenario(
  hours: number,
  participants: number,
  rule: BandRule,
  quoteHt?: number,
): ScenarioResult {
  const hourlyCeiling =
    rule.hourlyCapPerTrainee !== undefined
      ? round2(rule.hourlyCapPerTrainee * hours * participants)
      : undefined;
  const annualCeiling = rule.annualCapPerCompany;
  const limitedBy =
    hourlyCeiling !== undefined && hourlyCeiling < annualCeiling ? "hourly" : "annual";
  const maxCoverage = hourlyCeiling !== undefined ? Math.min(hourlyCeiling, annualCeiling) : annualCeiling;

  const result: ScenarioResult = {
    hours,
    participants,
    maxCoverageHt: maxCoverage,
    hourlyCeilingHt: hourlyCeiling,
    annualCeilingHt: annualCeiling,
    limitedBy,
  };
  if (quoteHt !== undefined) {
    const covered = Math.min(quoteHt, maxCoverage);
    result.coveredHt = round2(covered);
    result.remainingHt = round2(quoteHt - covered);
  }
  return result;
}

function validate(input: EstimateInput): string | null {
  if (!Number.isInteger(input.participants) || input.participants < 1) {
    return "Le nombre de participants doit être un entier supérieur ou égal à 1.";
  }
  if (!input.durationsHours.length || input.durationsHours.some((h) => !(h > 0))) {
    return "Les durées de formation doivent être des nombres d'heures positifs.";
  }
  if (input.quoteHt !== undefined && !(input.quoteHt >= 0)) {
    return "Le montant du devis doit être positif.";
  }
  return null;
}

/** Branche Atlas déduite de l'IDCC (undefined si inconnue ou non chiffrée). */
export function atlasBranchFromIdcc(idcc?: string): string | undefined {
  if (!idcc) return undefined;
  const entry = (idccTable.map as Record<string, { opco?: string; atlasBranch?: string }>)[idcc];
  return entry?.opco === "atlas" ? entry.atlasBranch : undefined;
}

/** OPCO suggéré d'après un IDCC (undefined si la table ne le connaît pas : l'utilisateur choisit). */
export function opcoFromIdcc(idcc: string): OpcoId | undefined {
  const entry = (idccTable.map as Record<string, { opco?: string }>)[idcc];
  return entry?.opco as OpcoId | undefined;
}

export function estimate(input: EstimateInput): EstimateResult {
  const invalid = validate(input);
  if (invalid) return toConfirm(input.opco, "invalid_input", invalid);

  const confirmMsg = (what: string) =>
    `${what} Nous confirmons votre prise en charge avec ${opcoLabel(input.opco)} lors de l'étude de votre dossier.`;

  let bands: Bands | undefined;
  let sourceUrl: string;
  let verifiedAt: string;
  let scheme: string;
  let notes: string[];
  let outOfScope: Partial<Record<SizeBand, string>> = {};

  if (input.opco === "afdas") {
    const r = rules.opcos.afdas;
    bands = r.bands as Bands;
    sourceUrl = r.sourceUrl;
    verifiedAt = r.verifiedAt;
    scheme = r.scheme;
    notes = [...r.notes];
    outOfScope = r.outOfScopeMessage as Partial<Record<SizeBand, string>>;
  } else if (input.opco === "atlas") {
    const branchKey = atlasBranchFromIdcc(input.idcc);
    const branch = branchKey
      ? (rules.opcos.atlas.branches as unknown as Record<string, (typeof rules.opcos.atlas.branches)["bet"]>)[branchKey]
      : undefined;
    if (!branch) {
      return toConfirm(
        input.opco,
        "branch_not_covered",
        confirmMsg("Le barème d'Atlas dépend de votre branche professionnelle, que nous n'avons pas encore intégrée."),
      );
    }
    bands = branch.bands as Bands;
    sourceUrl = branch.sourceUrl;
    verifiedAt = rules.opcos.atlas.verifiedAt;
    scheme = `${rules.opcos.atlas.scheme} · ${branch.label}`;
    notes = [...branch.notes];
  } else {
    return toConfirm(
      input.opco,
      "opco_not_covered",
      confirmMsg(`Le barème de ${opcoLabel(input.opco)} n'est pas encore intégré au simulateur.`),
    );
  }

  const bandRule = bands[input.sizeBand];
  if (!bandRule) {
    return toConfirm(
      input.opco,
      "size_not_covered",
      confirmMsg(
        outOfScope[input.sizeBand] ??
          "Pour cette taille d'entreprise, les règles de prise en charge sont différentes et ne sont pas encore intégrées.",
      ),
    );
  }

  const scenarios = input.durationsHours.map((h) =>
    computeScenario(h, input.participants, bandRule, input.quoteHt),
  );

  return {
    status: "estimated",
    opco: input.opco,
    opcoLabel: opcoLabel(input.opco),
    scheme,
    scenarios,
    notes: [
      ...notes,
      "Montants HT, sous réserve de fonds disponibles. Seul l'accord écrit de votre OPCO fixe le montant pris en charge.",
    ],
    sourceUrl,
    verifiedAt,
  };
}
