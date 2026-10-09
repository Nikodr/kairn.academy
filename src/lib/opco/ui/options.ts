import rules from '../data/opco-rules.json';
import type { OpcoId, SizeBand } from '../types';

const OPCO_LABELS = {
  afdas: rules.opcos.afdas.label,
  atlas: rules.opcos.atlas.label,
  ...rules.labels,
} as Record<OpcoId, string>;

export const opcoLabel = (id: OpcoId): string => OPCO_LABELS[id] ?? id;

export const OPCO_OPTIONS: { id: OpcoId; label: string }[] = (Object.keys(OPCO_LABELS) as OpcoId[])
  .map((id) => ({ id, label: OPCO_LABELS[id] }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

export const SIZE_OPTIONS: { id: SizeBand; label: string }[] = [
  { id: 'lt11', label: 'Moins de 11 salariés' },
  { id: '11-49', label: '11 à 49 salariés' },
  { id: '50-299', label: '50 à 299 salariés' },
  { id: '300+', label: '300 salariés et plus' },
];

export const sizeLabel = (band: SizeBand): string =>
  SIZE_OPTIONS.find((o) => o.id === band)?.label ?? band;

export const isOpcoId = (value: string): value is OpcoId => value in OPCO_LABELS;
export const isSizeBand = (value: string): value is SizeBand =>
  SIZE_OPTIONS.some((o) => o.id === value);
