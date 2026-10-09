const euroInt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const euroDec = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1 100 €" (ou "1 100,50 €" si le montant a des centimes). */
export function formatEuro(amount: number): string {
  return (Number.isInteger(amount) ? euroInt : euroDec).format(amount);
}

/** "1 100 € HT" */
export function formatEuroHt(amount: number): string {
  return `${formatEuro(amount)} HT`;
}

/** "280 € à 2 500 € HT" (un seul montant si les bornes sont égales). */
export function formatRangeHt(low: number, high: number): string {
  return low === high ? formatEuroHt(low) : `${formatEuro(low)} à ${formatEuroHt(high)}`;
}

const dateFr = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-10-08" → "8 octobre 2026". */
export function formatDateFr(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoDate : dateFr.format(date);
}

/** Ne garde que les chiffres et complète à 4 chiffres ("787" → "0787"), format des tables IDCC. */
export function normalizeIdcc(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '' || digits.length > 4) return digits;
  return digits.padStart(4, '0');
}

export const isValidIdcc = (idcc: string): boolean => /^\d{4}$/.test(idcc);

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** "884731514" → "884 731 514". */
export function formatSiren(siren: string): string {
  return /^\d{9}$/.test(siren) ? siren.replace(/(\d{3})(?=\d)/g, '$1 ') : siren;
}

/**
 * Montant saisi par un humain : "1490", "1 490", "1490,50", "1 490 € HT".
 * undefined si vide, NaN si illisible.
 */
export function parseAmount(raw: string): number | undefined {
  const cleaned = raw
    .replace(/[\s  ]/g, '')
    .replace(/€|ht/gi, '')
    .replace(',', '.');
  if (cleaned === '') return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

const INSEE_LABELS: Record<string, string> = {
  '00': '0 salarié',
  '01': '1 ou 2 salariés',
  '02': '3 à 5 salariés',
  '03': '6 à 9 salariés',
  '11': '10 à 19 salariés',
  '12': '20 à 49 salariés',
  '21': '50 à 99 salariés',
  '22': '100 à 199 salariés',
  '31': '200 à 249 salariés',
  '32': '250 à 499 salariés',
  '41': '500 à 999 salariés',
  '42': '1 000 à 1 999 salariés',
  '51': '2 000 à 4 999 salariés',
  '52': '5 000 à 9 999 salariés',
  '53': '10 000 salariés et plus',
};

/** Libellé lisible d'une tranche d'effectif INSEE (undefined si non renseignée). */
export function inseeLabel(code: string | null | undefined): string | undefined {
  return code ? INSEE_LABELS[code] : undefined;
}

export const pluralize = (n: number, one: string, many: string): string =>
  `${n} ${n > 1 ? many : one}`;
