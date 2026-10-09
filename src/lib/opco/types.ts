export type SizeBand = "lt11" | "11-49" | "50-299" | "300+";

export type OpcoId =
  | "afdas"
  | "atlas"
  | "akto"
  | "constructys"
  | "ocapiat"
  | "opco2i"
  | "opcoep"
  | "opcomobilites"
  | "opcosante"
  | "opcommerce"
  | "uniformation";

export interface EstimateInput {
  opco: OpcoId;
  sizeBand: SizeBand;
  /** Convention collective de l'entreprise (nécessaire pour les OPCO au barème par branche, ex. Atlas). */
  idcc?: string;
  participants: number;
  /** Durées simulées, en heures (ex. [7, 14]). */
  durationsHours: number[];
  /** Montant HT d'un devis, si le prospect le connaît. Total pour tous les participants. */
  quoteHt?: number;
}

export type LimitingFactor = "hourly" | "annual" | "quote";

export interface ScenarioResult {
  hours: number;
  participants: number;
  /** Plafond théorique de prise en charge pour ce scénario (HT). */
  maxCoverageHt: number;
  /** Plafond horaire cumulé (par stagiaire × heures × participants), s'il existe. */
  hourlyCeilingHt?: number;
  /** Plafond annuel par entreprise, s'il existe. */
  annualCeilingHt?: number;
  /** Ce qui borne le plafond : le barème horaire ou le budget annuel. */
  limitedBy: Exclude<LimitingFactor, "quote">;
  /** Renseignés uniquement si un devis a été saisi. */
  coveredHt?: number;
  remainingHt?: number;
}

export type EstimateStatus = "estimated" | "to_confirm";

export type ToConfirmReason =
  | "opco_not_covered"
  | "branch_not_covered"
  | "size_not_covered"
  | "invalid_input";

export type EstimateResult =
  | {
      status: "estimated";
      opco: OpcoId;
      opcoLabel: string;
      scheme: string;
      scenarios: ScenarioResult[];
      notes: string[];
      sourceUrl: string;
      verifiedAt: string;
    }
  | {
      status: "to_confirm";
      reason: ToConfirmReason;
      opco: OpcoId;
      opcoLabel: string;
      message: string;
    };

export interface CompanyInfo {
  siren: string;
  siret: string;
  name: string;
  /** Codes IDCC déclarés au registre (peut être vide). */
  idcc: string[];
  /** Code région INSEE, ex. "11". */
  region?: string;
  /** Tranche d'effectif INSEE brute (ex. "NN", "12"). */
  insee: string | null;
  /** Bande déduite sans ambiguïté, sinon undefined (l'utilisateur doit confirmer). */
  sizeBand?: SizeBand;
}
