import { describe, expect, it } from "vitest";
import { estimate, opcoFromIdcc } from "../engine";
import { normalizeCompany, sizeBandFromInsee } from "../registry";

const base = { participants: 1, durationsHours: [7, 14] };

describe("Afdas 2026", () => {
  it("applique le plafond horaire de 40 €/h par stagiaire (moins de 11 salariés)", () => {
    const r = estimate({ ...base, opco: "afdas", sizeBand: "lt11" });
    if (r.status !== "estimated") throw new Error("attendu : estimated");
    expect(r.scenarios.map((s) => s.maxCoverageHt)).toEqual([280, 560]);
    expect(r.scenarios.every((s) => s.limitedBy === "hourly")).toBe(true);
  });

  it("multiplie par le nombre de participants mais borne par le plafond annuel", () => {
    // 14 h × 40 € × 3 = 1 680 € > 1 100 € de plafond annuel (moins de 11)
    const r = estimate({ opco: "afdas", sizeBand: "lt11", participants: 3, durationsHours: [14] });
    if (r.status !== "estimated") throw new Error("attendu : estimated");
    expect(r.scenarios[0].hourlyCeilingHt).toBe(1680);
    expect(r.scenarios[0].maxCoverageHt).toBe(1100);
    expect(r.scenarios[0].limitedBy).toBe("annual");
  });

  it("utilise 1 800 € de plafond annuel pour 11 à 49 salariés", () => {
    const r = estimate({ opco: "afdas", sizeBand: "11-49", participants: 5, durationsHours: [14] });
    if (r.status !== "estimated") throw new Error("attendu : estimated");
    expect(r.scenarios[0].maxCoverageHt).toBe(1800);
  });

  it("calcule le reste à charge quand un devis est saisi", () => {
    const r = estimate({ ...base, opco: "afdas", sizeBand: "lt11", durationsHours: [14], quoteHt: 1490 });
    if (r.status !== "estimated") throw new Error("attendu : estimated");
    expect(r.scenarios[0].coveredHt).toBe(560);
    expect(r.scenarios[0].remainingHt).toBe(930);
  });

  it("ne prend pas en charge plus que le devis", () => {
    const r = estimate({ ...base, opco: "afdas", sizeBand: "lt11", durationsHours: [14], quoteHt: 300 });
    if (r.status !== "estimated") throw new Error("attendu : estimated");
    expect(r.scenarios[0].coveredHt).toBe(300);
    expect(r.scenarios[0].remainingHt).toBe(0);
  });
});

describe("Atlas 2026, branche BET (IDCC 1486)", () => {
  it("applique le plafond annuel seul (sans plafond horaire)", () => {
    const r = estimate({ ...base, opco: "atlas", sizeBand: "lt11", idcc: "1486" });
    if (r.status !== "estimated") throw new Error("attendu : estimated");
    expect(r.scenarios.map((s) => s.maxCoverageHt)).toEqual([2500, 2500]);
    expect(r.scenarios[0].hourlyCeilingHt).toBeUndefined();
    expect(r.scenarios[0].limitedBy).toBe("annual");
  });

  it("utilise 3 000 € pour 11 à 49 salariés", () => {
    const r = estimate({ ...base, opco: "atlas", sizeBand: "11-49", idcc: "1486" });
    if (r.status !== "estimated") throw new Error("attendu : estimated");
    expect(r.scenarios[0].maxCoverageHt).toBe(3000);
  });

  it("couvre entièrement un devis de 1 490 € HT", () => {
    const r = estimate({ ...base, opco: "atlas", sizeBand: "lt11", idcc: "1486", durationsHours: [14], quoteHt: 1490 });
    if (r.status !== "estimated") throw new Error("attendu : estimated");
    expect(r.scenarios[0].coveredHt).toBe(1490);
    expect(r.scenarios[0].remainingHt).toBe(0);
  });

  it("utilise 4 000 € pour 50 à 299 salariés", () => {
    const r = estimate({ ...base, opco: "atlas", sizeBand: "50-299", idcc: "1486", quoteHt: 1490, durationsHours: [14] });
    if (r.status !== "estimated") throw new Error("attendu : estimated");
    expect(r.scenarios[0].maxCoverageHt).toBe(4000);
    expect(r.scenarios[0].remainingHt).toBe(0);
  });

  it("renvoie « à confirmer » si la branche n'est pas chiffrée", () => {
    const r = estimate({ ...base, opco: "atlas", sizeBand: "lt11", idcc: "787" });
    expect(r).toMatchObject({ status: "to_confirm", reason: "branch_not_covered" });
  });

  it("renvoie « à confirmer » sans IDCC", () => {
    const r = estimate({ ...base, opco: "atlas", sizeBand: "lt11" });
    expect(r).toMatchObject({ status: "to_confirm", reason: "branch_not_covered" });
  });
});

describe("cas non couverts", () => {
  it("OPCO sans barème intégré → à confirmer", () => {
    const r = estimate({ ...base, opco: "opco2i", sizeBand: "lt11" });
    expect(r).toMatchObject({ status: "to_confirm", reason: "opco_not_covered", opcoLabel: "OPCO 2i" });
  });

  it("50 salariés et plus → à confirmer", () => {
    const afdas = estimate({ ...base, opco: "afdas", sizeBand: "50-299" });
    expect(afdas).toMatchObject({ status: "to_confirm", reason: "size_not_covered" });
    if (afdas.status === "to_confirm") expect(afdas.message).toContain("plan conventionnel");
    expect(estimate({ ...base, opco: "atlas", sizeBand: "300+", idcc: "1486" })).toMatchObject({
      status: "to_confirm",
      reason: "size_not_covered",
    });
  });

  it("entrées invalides → à confirmer", () => {
    expect(estimate({ ...base, opco: "afdas", sizeBand: "lt11", participants: 0 })).toMatchObject({
      status: "to_confirm",
      reason: "invalid_input",
    });
    expect(estimate({ ...base, opco: "afdas", sizeBand: "lt11", durationsHours: [0] })).toMatchObject({
      reason: "invalid_input",
    });
  });
});

describe("registre", () => {
  it("normalise sans conserver de données de dirigeant", () => {
    const company = normalizeCompany({
      siren: "884731514",
      nom_complet: "THE GREEN COMPAGNON",
      siege: { siret: "88473151400011", liste_idcc: ["1486"], region: "11", tranche_effectif_salarie: "NN" },
      // @ts-expect-error champ volontairement ignoré
      dirigeants: [{ nom: "X" }],
    });
    expect(company).toEqual({
      siren: "884731514",
      siret: "88473151400011",
      name: "THE GREEN COMPAGNON",
      idcc: ["1486"],
      region: "11",
      insee: "NN",
      sizeBand: undefined,
    });
  });

  it("déduit la bande d'effectif seulement sans ambiguïté", () => {
    expect(sizeBandFromInsee("02")).toBe("lt11");
    expect(sizeBandFromInsee("12")).toBe("11-49");
    expect(sizeBandFromInsee("11")).toBeUndefined(); // 10-19 : à cheval sur 11
    expect(sizeBandFromInsee("NN")).toBeUndefined();
    expect(sizeBandFromInsee("32")).toBeUndefined(); // 250-499 : à cheval sur 300
    expect(sizeBandFromInsee("22")).toBe("50-299");
  });

  it("suggère l'OPCO depuis l'IDCC connu", () => {
    expect(opcoFromIdcc("1486")).toBe("atlas");
    expect(opcoFromIdcc("9999")).toBeUndefined(); // sans convention : dépend de l'activité
    expect(opcoFromIdcc("2642")).toBe("afdas");
    expect(opcoFromIdcc("1480")).toBe("afdas");
    expect(opcoFromIdcc("0478")).toBe("atlas");
    expect(opcoFromIdcc("0787")).toBe("atlas");
  });
});
