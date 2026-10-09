import { DURATIONS_HOURS, TRAINING_PRICE_HT } from './config';
import type { PriceFor } from './viewmodel';

/** Durées simulées : celle du devis quand elle est connue, sinon nos deux formats (7 h et 14 h). */
export const hoursFor = (quoteHt?: number, quoteHours?: number): number[] =>
  quoteHt !== undefined && quoteHours !== undefined ? [quoteHours] : DURATIONS_HOURS;

/** Montant de la session : le devis saisi tel quel, sinon le tarif catalogue de la durée. */
export const priceResolver = (quoteHt?: number): PriceFor =>
  quoteHt !== undefined ? () => quoteHt : (hours) => TRAINING_PRICE_HT[hours];
