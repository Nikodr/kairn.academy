import { describe, expect, it } from 'vitest';
import { formatRangeHt } from '../format';
import { genericEstimate } from '../generic';
import { isSearchable } from '../idcc-search';
import { buildGenericView, summarizeDisplayed } from '../viewmodel';
import { estimate } from '../../engine';

const plain = (s: string) => s.replace(/[\s  ]+/g, ' ');
const base = { participants: 1, durationsHours: [7, 14] };

describe('fourchette générique', () => {
  it('va du plus bas au plus haut des barèmes relevés (moins de 11 salariés)', () => {
    const g = genericEstimate({ ...base, sizeBand: 'lt11' });
    expect(g?.sources).toEqual(['Afdas', 'Atlas, branche BET']);
    expect(g?.scenarios.map((s) => [s.lowHt, s.highHt])).toEqual([
      [280, 2500],
      [560, 2500],
    ]);
  });

  it('tient compte du nombre de participants et du plafond annuel', () => {
    const g = genericEstimate({ participants: 3, durationsHours: [14], sizeBand: '11-49' });
    expect(g?.scenarios[0]).toMatchObject({ lowHt: 1680, highHt: 3000 });
  });

  it('calcule la couverture et le reste à charge en fourchette quand il y a un devis', () => {
    const g = genericEstimate({ ...base, durationsHours: [14], sizeBand: 'lt11', quoteHt: 1490 });
    expect(g?.scenarios[0]).toMatchObject({
      coveredLowHt: 560,
      coveredHighHt: 1490,
      remainingLowHt: 0,
      remainingHighHt: 930,
    });
  });

  it("n'invente rien sans au moins deux barèmes applicables", () => {
    expect(genericEstimate({ ...base, sizeBand: '50-299' })).toBeNull(); // seul Atlas BET est chiffré
    expect(genericEstimate({ ...base, sizeBand: '300+' })).toBeNull();
  });

  it('formate les bornes et résume ce qui est affiché', () => {
    expect(plain(formatRangeHt(280, 2500))).toBe('280 € à 2 500 € HT');
    expect(plain(formatRangeHt(2500, 2500))).toBe('2 500 € HT');

    const g = genericEstimate({ ...base, sizeBand: 'lt11', quoteHt: 1490 });
    const view = buildGenericView(g!);
    expect(plain(view.scenarios[1].amount)).toBe('560 € à 2 500 € HT');
    expect(plain(view.scenarios[1].quote?.remaining ?? '')).toBe('0 € à 930 € HT');

    const result = estimate({ ...base, opco: 'atlas', sizeBand: 'lt11' });
    expect(plain(summarizeDisplayed(result, g))).toBe(
      'Estimation générique (branch_not_covered) : 7 h : 280 € à 2 500 € HT | 14 h : 560 € à 2 500 € HT',
    );
  });
});

describe('recherche de convention', () => {
  it('exige un numéro de 2 chiffres ou un nom de 3 lettres', () => {
    expect(isSearchable('1')).toBe(false);
    expect(isSearchable('43')).toBe(true);
    expect(isSearchable('sy')).toBe(false);
    expect(isSearchable('syntec')).toBe(true);
  });
});

describe('recherche locale de convention', () => {
  const titles = {
    '1486': ["Bureaux d'études techniques, cabinets d'ingénieurs-conseils et sociétés de conseils", 'BET, SYNTEC'],
    '0787': ["Personnel des cabinets d'experts-comptables et de commissaires aux comptes"],
    '2121': ['Édition'],
  };

  it('trouve par nom, par alias et sans tenir compte des accents', async () => {
    const { matchConventions } = await import('../idcc-search');
    expect(matchConventions(titles, 'syntec')[0]).toMatchObject({ idcc: '1486', opco: 'Atlas' });
    expect(matchConventions(titles, 'experts comptables')[0].idcc).toBe('0787');
    expect(matchConventions(titles, 'edition')[0].idcc).toBe('2121');
  });

  it('trouve par numéro, même sans intitulé connu', async () => {
    const { matchConventions } = await import('../idcc-search');
    expect(matchConventions(titles, '1486')[0]).toMatchObject({ idcc: '1486', opco: 'Atlas' });
    const sansTitre = matchConventions({}, '0054');
    expect(sansTitre[0]?.idcc).toBe('0054');
    expect(sansTitre[0]?.title).toBeUndefined();
  });
});

describe('page résultat', () => {
  it("ne répète pas la mention « montants HT, sous réserve » déjà présente sous le résultat", async () => {
    const { buildResultView } = await import('../viewmodel');
    const view = buildResultView(estimate({ ...base, opco: 'afdas', sizeBand: 'lt11' }));
    if (view.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(view.notes.some((n) => /^montants ht, sous réserve/i.test(n))).toBe(false);
  });

  it("signale que la borne haute ne dépend pas de la durée quand c'est un plafond annuel", () => {
    const g = genericEstimate({ ...base, sizeBand: 'lt11' });
    expect(buildGenericView(g!).sameHigh).toBe(true);
  });
});

describe('envoi du lead vers Airtable', () => {
  it('construit un payload complet : toutes les clés présentes, vides ou null si absentes', async () => {
    const { buildLeadPayload, toFormBody } = await import('../leads');
    const result = estimate({ ...base, opco: 'afdas', sizeBand: 'lt11' });
    const payload = buildLeadPayload({
      firstName: 'Léa',
      email: 'lea@exemple.fr',
      companyName: 'EXEMPLE SAS',
      opco: 'afdas',
      sizeBand: 'lt11',
      participants: 1,
      result,
      generic: null,
      turnstileToken: 'tok',
    });
    expect(payload).toMatchObject({
      opco: 'Afdas',
      sizeBand: 'Moins de 11 salariés',
      siren: '',
      idcc: '',
      quoteHt: null,
      coverage7hHt: 280,
      coverage14hHt: 560,
      resultType: 'Chiffré',
    });
    const form = toFormBody(payload);
    expect(form.get('quoteHt')).toBe('');
    expect(form.get('coverage7hHt')).toBe('280');
    expect(form.get('companyName')).toBe('EXEMPLE SAS');
    expect([...form.keys()]).toHaveLength(Object.keys(payload).length);
  });

  it('distingue chiffré, fourchette générique et à confirmer, sans plafond chiffré hors barème', async () => {
    const { buildLeadPayload } = await import('../leads');
    const common = { firstName: 'A', email: 'a@b.fr', companyName: 'X', opco: 'atlas' as const, sizeBand: 'lt11' as const, participants: 1, turnstileToken: 't' };
    const result = estimate({ ...base, opco: 'atlas', sizeBand: 'lt11' });
    const generic = genericEstimate({ ...base, sizeBand: 'lt11' });
    const withGeneric = buildLeadPayload({ ...common, result, generic });
    expect(withGeneric).toMatchObject({ resultType: 'Fourchette générique', coverage7hHt: null, coverage14hHt: null });
    expect(withGeneric.resultSummary).toContain('Estimation générique');
    expect(buildLeadPayload({ ...common, result, generic: null }).resultType).toBe('À confirmer');
  });
});

describe('reste à charge estimé', () => {
  const price = (hours: number) => ({ 7: 3000, 14: 6000 })[hours as 7 | 14];

  it('barème chiffré : montant de la session moins la prise en charge maximale', async () => {
    const { buildResultView } = await import('../viewmodel');
    const atlas = buildResultView(estimate({ ...base, opco: 'atlas', sizeBand: 'lt11', idcc: '1486' }), price);
    if (atlas.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(atlas.scenarios.map((s) => plain(s.estimatedRemaining ?? ''))).toEqual(['500 € HT', '3 500 € HT']);

    const afdas = buildResultView(estimate({ ...base, opco: 'afdas', sizeBand: 'lt11' }), price);
    if (afdas.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(afdas.scenarios.map((s) => plain(s.estimatedRemaining ?? ''))).toEqual(['2 720 € HT', '5 440 € HT']);
    expect(afdas.scenarios[0].context).toContain('par session');
  });

  it('jamais négatif quand la prise en charge dépasse le prix', async () => {
    const { buildResultView } = await import('../viewmodel');
    const view = buildResultView(estimate({ ...base, opco: 'atlas', sizeBand: '50-299', idcc: '1486' }), () => 1000);
    if (view.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(plain(view.scenarios[0].estimatedRemaining ?? '')).toBe('0 € HT');
  });

  it('fourchette générique : reste à charge en fourchette', () => {
    const view = buildGenericView(genericEstimate({ ...base, sizeBand: 'lt11' })!, price);
    expect(view.scenarios.map((s) => plain(s.estimatedRemaining ?? ''))).toEqual(['500 € à 2 720 € HT', '3 500 € à 5 440 € HT']);
  });

  it('sans prix connu, pas de ligne', async () => {
    const { buildResultView } = await import('../viewmodel');
    const view = buildResultView(estimate({ ...base, opco: 'afdas', sizeBand: 'lt11' }));
    if (view.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(view.scenarios[0].estimatedRemaining).toBeUndefined();
  });
});

describe('reste à charge dans le lead', () => {
  it('renseigne le reste à charge 7 h / 14 h seulement quand un barème officiel est appliqué', async () => {
    const { buildLeadPayload } = await import('../leads');
    const common = { firstName: 'A', email: 'a@b.fr', companyName: 'X', sizeBand: 'lt11' as const, participants: 2, turnstileToken: 't' };

    const atlas = buildLeadPayload({ ...common, opco: 'atlas', idcc: '1486', result: estimate({ ...base, opco: 'atlas', sizeBand: 'lt11', idcc: '1486' }), generic: null });
    expect(atlas).toMatchObject({ coverage7hHt: 2500, remaining7hHt: 500, coverage14hHt: 2500, remaining14hHt: 3500 });
    expect(plain(atlas.resultSummary)).toContain('reste à charge estimé 500 € HT');

    const noScale = estimate({ ...base, opco: 'atlas', sizeBand: 'lt11' });
    const generic = buildLeadPayload({ ...common, opco: 'atlas', result: noScale, generic: genericEstimate({ ...base, sizeBand: 'lt11' }) });
    expect(generic).toMatchObject({ remaining7hHt: null, remaining14hHt: null, resultType: 'Fourchette générique' });
    expect(plain(generic.resultSummary)).toContain('reste à charge estimé 500 € à 2 720 € HT');
  });
});

describe('devis saisi avec son nombre d\'heures', () => {
  it('ne simule que la durée du devis et prend son montant exact comme prix de la session', async () => {
    const { hoursFor, priceResolver } = await import('../pricing');
    expect(hoursFor()).toEqual([7, 14]);
    expect(hoursFor(4800, 21)).toEqual([21]);
    expect(priceResolver()(7)).toBe(3000);
    expect(priceResolver(4800)(21)).toBe(4800);
  });

  it('Atlas BET sur un devis de 4 800 € / 21 h : un seul scénario, reste à charge sur le devis', async () => {
    const { hoursFor, priceResolver } = await import('../pricing');
    const { buildResultView } = await import('../viewmodel');
    const result = estimate({ opco: 'atlas', sizeBand: 'lt11', idcc: '1486', participants: 1, durationsHours: hoursFor(4800, 21), quoteHt: 4800 });
    const view = buildResultView(result, priceResolver(4800));
    if (view.kind !== 'estimated') throw new Error('attendu : estimated');
    expect(view.scenarios).toHaveLength(1);
    expect(view.scenarios[0].title).toBe('Formation de 21 h');
    expect(plain(view.scenarios[0].amount)).toBe('2 500 € HT');
    expect(plain(view.scenarios[0].estimatedRemaining ?? '')).toBe('2 300 € HT');
  });

  it('heures décimales lisibles et fourchette sur une seule durée', async () => {
    const { formatHours } = await import('../format');
    expect(formatHours(10.5)).toBe('10,5');
    const g = genericEstimate({ participants: 1, durationsHours: [21], sizeBand: 'lt11', quoteHt: 4800 });
    expect(g?.scenarios).toHaveLength(1);
    expect(g?.scenarios[0]).toMatchObject({ hours: 21, lowHt: 840, highHt: 2500, remainingLowHt: 2300, remainingHighHt: 3960 });
  });

  it('le lead enregistre le reste à charge du devis, et seulement pour 7 h ou 14 h', async () => {
    const { buildLeadPayload } = await import('../leads');
    const { hoursFor } = await import('../pricing');
    const common = { firstName: 'A', email: 'a@b.fr', companyName: 'X', opco: 'atlas' as const, sizeBand: 'lt11' as const, idcc: '1486', participants: 1, quoteHt: 4800, generic: null, turnstileToken: 't' };
    const r14 = estimate({ opco: 'atlas', sizeBand: 'lt11', idcc: '1486', participants: 1, durationsHours: hoursFor(4800, 14), quoteHt: 4800 });
    expect(buildLeadPayload({ ...common, result: r14 })).toMatchObject({ coverage14hHt: 2500, remaining14hHt: 2300, coverage7hHt: null, remaining7hHt: null, quoteHt: 4800 });
    const r21 = estimate({ opco: 'atlas', sizeBand: 'lt11', idcc: '1486', participants: 1, durationsHours: hoursFor(4800, 21), quoteHt: 4800 });
    const payload = buildLeadPayload({ ...common, result: r21 });
    expect(payload).toMatchObject({ coverage7hHt: null, coverage14hHt: null, remaining7hHt: null, remaining14hHt: null });
    expect(plain(payload.resultSummary)).toContain('21 h : jusqu\'à 2 500 € HT');
    expect(plain(payload.resultSummary)).toContain('reste à charge 2 300 € HT');
    expect(plain(payload.resultSummary).match(/reste à charge/g)).toHaveLength(1);
  });
});

describe('lead avec devis : prise en charge et reste à charge sur le devis', () => {
  const common = { firstName: 'A', email: 'a@b.fr', companyName: 'X', opco: 'atlas' as const, sizeBand: 'lt11' as const, participants: 1, generic: null, turnstileToken: 't' };

  it('renseigne le montant couvert et le reste à charge du devis (plafond appliqué)', async () => {
    const { buildLeadPayload } = await import('../leads');
    const big = estimate({ opco: 'atlas', sizeBand: 'lt11', idcc: '1486', participants: 1, durationsHours: [21], quoteHt: 4800 });
    expect(buildLeadPayload({ ...common, idcc: '1486', quoteHt: 4800, result: big })).toMatchObject({ quoteHt: 4800, quoteCoverageHt: 2500, quoteRemainingHt: 2300 });

    const small = estimate({ opco: 'atlas', sizeBand: 'lt11', idcc: '1486', participants: 1, durationsHours: [14], quoteHt: 1490 });
    expect(buildLeadPayload({ ...common, idcc: '1486', quoteHt: 1490, result: small })).toMatchObject({ quoteCoverageHt: 1490, quoteRemainingHt: 0 });
  });

  it('reste vide sans devis ou sans barème officiel', async () => {
    const { buildLeadPayload } = await import('../leads');
    const catalog = estimate({ ...base, opco: 'atlas', sizeBand: 'lt11', idcc: '1486' });
    expect(buildLeadPayload({ ...common, idcc: '1486', result: catalog })).toMatchObject({ quoteHt: null, quoteCoverageHt: null, quoteRemainingHt: null });

    const noScale = estimate({ opco: 'atlas', sizeBand: 'lt11', participants: 1, durationsHours: [14], quoteHt: 4800 });
    const generic = genericEstimate({ participants: 1, durationsHours: [14], sizeBand: 'lt11', quoteHt: 4800 });
    expect(buildLeadPayload({ ...common, quoteHt: 4800, result: noScale, generic })).toMatchObject({ quoteHt: 4800, quoteCoverageHt: null, quoteRemainingHt: null });
  });
});
