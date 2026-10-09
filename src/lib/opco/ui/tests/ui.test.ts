import { describe, expect, it } from 'vitest';
import { estimate } from '../../engine';
import {
  formatDateFr,
  formatEuroHt,
  formatSiren,
  inseeLabel,
  normalizeIdcc,
  parseAmount,
} from '../format';
import { OPCO_OPTIONS, isOpcoId, sizeLabel } from '../options';
import { buildResultView, summarizeResult } from '../viewmodel';

/** Intl utilise des espaces insécables : on les ramène à de simples espaces. */
const plain = (s: string) => s.replace(/[\s  ]+/g, ' ');

describe('format', () => {
  it('formate les montants HT en euros', () => {
    expect(plain(formatEuroHt(1100))).toBe('1 100 € HT');
    expect(plain(formatEuroHt(1490.5))).toBe('1 490,50 € HT');
  });

  it('formate une date ISO en français', () => {
    expect(formatDateFr('2026-10-08')).toBe('8 octobre 2026');
  });

  it('complète les IDCC à 4 chiffres', () => {
    expect(normalizeIdcc('787')).toBe('0787');
    expect(normalizeIdcc(' 1486 ')).toBe('1486');
    expect(normalizeIdcc('')).toBe('');
    expect(normalizeIdcc('12345')).toBe('12345'); // trop long : laissé tel quel, rejeté par la validation
  });

  it('groupe le SIREN par trois chiffres', () => {
    expect(formatSiren('884731514')).toBe('884 731 514');
    expect(formatSiren('abc')).toBe('abc');
  });

  it('lit un montant saisi à la française', () => {
    expect(parseAmount('1490')).toBe(1490);
    expect(parseAmount('1 490')).toBe(1490);
    expect(parseAmount('1490,50')).toBe(1490.5);
    expect(parseAmount('1 490 € HT')).toBe(1490);
    expect(parseAmount('')).toBeUndefined();
    expect(parseAmount('  ')).toBeUndefined();
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('-5')).toBeNaN();
  });

  it("décrit les tranches d'effectif INSEE", () => {
    expect(inseeLabel('12')).toBe('20 à 49 salariés');
    expect(inseeLabel('NN')).toBeUndefined();
    expect(inseeLabel(null)).toBeUndefined();
  });
});

describe('options', () => {
  it('liste les 11 OPCO, triés, avec leurs libellés', () => {
    expect(OPCO_OPTIONS).toHaveLength(11);
    expect(OPCO_OPTIONS.map((o) => o.label)).toContain("L'Opcommerce");
    expect(isOpcoId('atlas')).toBe(true);
    expect(isOpcoId('inconnu')).toBe(false);
    expect(sizeLabel('11-49')).toBe('11 à 49 salariés');
  });
});

describe('viewmodel', () => {
  const base = { participants: 1, durationsHours: [7, 14] };

  it('Afdas : plafond horaire, par participant, et reste à charge', () => {
    const result = estimate({ ...base, opco: 'afdas', sizeBand: 'lt11', participants: 1, quoteHt: 1490 });
    const view = buildResultView(result);
    if (view.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(view.scenarios.map((s) => plain(s.amount))).toEqual(['280 € HT', '560 € HT']);
    expect(plain(view.scenarios[0].limit)).toBe('Limité par le plafond horaire de 40 € HT par heure et par stagiaire.');
    expect(plain(view.scenarios[1].quote?.remaining ?? '')).toBe('930 € HT');
    expect(view.scenarios[1].quote?.fullyCovered).toBe(false);
  });

  it('Afdas : plusieurs participants, ventilation par participant puis plafond annuel', () => {
    const two = buildResultView(estimate({ ...base, opco: 'afdas', sizeBand: '11-49', participants: 2 }));
    if (two.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(plain(two.scenarios[0].perParticipant ?? '')).toBe('Soit 280 € HT par participant.');

    const many = buildResultView(estimate({ ...base, opco: 'afdas', sizeBand: 'lt11', participants: 3 }));
    if (many.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(plain(many.scenarios[1].limit)).toContain("Limité par le budget annuel de l'entreprise (1 100 € HT par an)");
    expect(many.scenarios[1].perParticipant).toBeUndefined();
  });

  it('Atlas BET : plafond annuel par entreprise, devis entièrement couvert', () => {
    const view = buildResultView(
      estimate({ ...base, opco: 'atlas', sizeBand: 'lt11', idcc: '1486', quoteHt: 1490 }),
    );
    if (view.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(plain(view.scenarios[0].limit)).toContain('Plafond annuel de 2 500 € HT par entreprise');
    expect(view.scenarios[0].quote?.fullyCovered).toBe(true);
    // la note « avant le début » vient déjà du barème : pas de doublon
    expect(view.notes.filter((n) => /avant le début/i.test(n))).toHaveLength(1);
  });

  it("ajoute la mention de dépôt avant formation quand le barème l'omet", () => {
    const view = buildResultView(estimate({ ...base, opco: 'afdas', sizeBand: 'lt11' }));
    if (view.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(view.notes.some((n) => /avant le début/i.test(n))).toBe(true);
  });

  it('cas à confirmer : message sans aucun montant', () => {
    const view = buildResultView(estimate({ ...base, opco: 'opco2i', sizeBand: 'lt11' }));
    expect(view.kind).toBe('to_confirm');
    if (view.kind === 'to_confirm') {
      expect(view.message).toContain('OPCO 2i');
      expect(view.message).not.toMatch(/\d\s?€/);
    }
  });

  it("résume le résultat affiché pour l'enregistrement", () => {
    const text = plain(summarizeResult(estimate({ ...base, opco: 'afdas', sizeBand: 'lt11' })));
    expect(text).toBe("7 h : jusqu'à 280 € HT (plafond horaire) | 14 h : jusqu'à 560 € HT (plafond horaire)");
    expect(summarizeResult(estimate({ ...base, opco: 'opco2i', sizeBand: 'lt11' }))).toBe(
      'Barème à confirmer (opco_not_covered)',
    );
  });
});
