import { atlasBranchFromIdcc, estimate, opcoFromIdcc } from '../index';
import type { EstimateResult, OpcoId, SizeBand } from '../types';
import { cleanQuery, searchRegistry, type CompanyHit } from './company-search';
import { CONTACT_EMAIL, MAX_PARTICIPANTS_PER_SESSION, TRAINING_PRICE_HT, TURNSTILE_SITE_KEY } from './config';
import { h } from './dom';
import { genericEstimate, type GenericEstimate } from './generic';
import { createIdccFinder } from './idcc-finder';
import {
  digitsOnly,
  formatDateFr,
  formatSiren,
  formatEuroHt,
  formatHours,
  inseeLabel,
  isValidIdcc,
  normalizeIdcc,
  parseAmount,
  pluralize,
} from './format';
import { buildLeadPayload, sendLead } from './leads';
import { isOpcoId, isSizeBand, opcoLabel, sizeLabel } from './options';
import { hoursFor, priceResolver } from './pricing';
import { mountTurnstile, type TurnstileHandle } from './turnstile';
import { buildGenericView, buildResultView, type GenericScenarioView, type ScenarioView } from './viewmodel';

type StepId = 'company' | 'unlock' | 'result';

interface Profile {
  name: string;
  siren?: string;
  sizeBand: SizeBand;
  opco: OpcoId;
  idcc?: string;
  participants: number;
  quoteHt?: number;
  /** Durée du devis : toujours renseignée avec le montant. */
  quoteHours?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ATLAS_IDCC_HINT =
  'Chez Atlas, le barème dépend de la convention collective : saisissez votre IDCC pour obtenir un chiffre.';
const DEFAULT_OPCO_HINT = 'Si vous ne le connaissez pas, il dépend de votre convention collective ou de votre activité.';
const SEARCH_DEBOUNCE_MS = 350;

export function initSimulator(): void {
  const root = document.getElementById('opco-sim');
  if (!root) return;

  const $ = <T extends HTMLElement>(selector: string): T => {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`Simulateur OPCO : élément introuvable (${selector})`);
    return el;
  };
  const field = <T extends HTMLElement>(name: string) => $<T>(`[data-field="${name}"]`);

  const steps: Record<StepId, HTMLElement> = {
    company: $('[data-step="company"]'),
    unlock: $('[data-step="unlock"]'),
    result: $('[data-step="result"]'),
  };
  const progress = {
    head: $('[data-progress]'),
    label: $('[data-progress-label]'),
    name: $('[data-progress-name]'),
    bar: $('[data-progress-bar]'),
    track: $('[data-progress-track]'),
  };

  const query = field<HTMLInputElement>('query');
  const check = $('[data-check]');
  const list = $<HTMLUListElement>('[data-list]');
  const searchBlock = $('[data-block="search"]');
  const searchStatus = $('[data-search-status]');
  const manualToggle = $<HTMLButtonElement>('[data-action="toggle-manual"]');

  const fiche = $('[data-fiche]');
  const ficheName = $('[data-fiche-name]');
  const ficheMeta = $('[data-fiche-meta]');
  const ficheBadge = $('[data-fiche-badge]');
  const manualOnly = root.querySelectorAll<HTMLElement>('[data-manual-only]');
  const manualName = field<HTMLInputElement>('manualName');
  const sirenInput = field<HTMLInputElement>('siren');
  const sizeSelect = field<HTMLSelectElement>('sizeBand');
  const opcoSelect = field<HTMLSelectElement>('opco');
  const idccInput = field<HTMLInputElement>('idcc');
  const idccChips = $('[data-idcc-chips]');
  const participantsInput = field<HTMLInputElement>('participants');
  const quoteInput = field<HTMLInputElement>('quote');
  const quoteHoursInput = field<HTMLInputElement>('quoteHours');
  const offerInputs = root.querySelectorAll<HTMLInputElement>('[data-offer]');
  const quoteFields = root.querySelectorAll<HTMLElement>('[data-quote-field]');
  const sizeHint = $('[data-hint="sizeBand"]');
  const opcoHint = $('[data-hint="opco"]');
  const idccHint = $('[data-hint="idcc"]');
  const idccHelpToggle = $<HTMLButtonElement>('[data-action="toggle-idcc-help"]');
  const idccHelp = $('[data-idcc-help]');

  const body = $('[data-result-body]');
  const unlockForm = $<HTMLFormElement>('[data-step="unlock"]');
  const firstNameInput = field<HTMLInputElement>('firstName');
  const emailInput = field<HTMLInputElement>('email');
  const consentInput = field<HTMLInputElement>('consent');
  const submitButton = $<HTMLButtonElement>('[data-submit]');
  const turnstileStatus = $('[data-turnstile-status]');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = {
    selection: null as { manual: boolean; name: string; siren?: string } | null,
    opcoTouched: false,
    registryWithoutIdcc: false,
    profile: null as Profile | null,
    hits: [] as CompanyHit[],
    active: -1,
    submitting: false,
  };
  let searchTimer: number | undefined;
  let searchController: AbortController | undefined;
  let turnstile: TurnstileHandle | undefined;
  let turnstileFailed = false;
  let idccBaseHint = idccHint.textContent ?? '';

  /* ---------- Erreurs ---------- */

  function setError(key: string, message: string | null, input?: HTMLElement): void {
    const el = root!.querySelector<HTMLElement>(`[data-error="${key}"]`);
    if (!el) return;
    el.id ||= `opco-err-${key}`;
    el.hidden = !message;
    el.textContent = message ?? '';
    if (!input) return;
    const described = new Set((input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      described.add(el.id);
    } else {
      input.removeAttribute('aria-invalid');
      described.delete(el.id);
    }
    if (described.size) input.setAttribute('aria-describedby', [...described].join(' '));
    else input.removeAttribute('aria-describedby');
  }

  /* ---------- Navigation entre étapes ---------- */

  function showStep(step: StepId): void {
    (Object.keys(steps) as StepId[]).forEach((id) => {
      steps[id].hidden = id !== step;
    });
    progress.head.hidden = step === 'result';
    // L'écran de résultat porte déjà sa propre mention : pas de doublon sous le bloc.
    const disclaimer = document.querySelector<HTMLElement>('[data-page-disclaimer]');
    if (disclaimer) disclaimer.hidden = step === 'result';
    if (step !== 'result') {
      const n = step === 'company' ? 1 : 2;
      progress.label.textContent = `Étape ${n} sur 2`;
      progress.name.textContent = n === 1 ? 'Mon entreprise' : 'Mes coordonnées';
      progress.bar.style.width = `${(n / 2) * 100}%`;
      progress.track.setAttribute('aria-valuenow', String(n));
    }
    steps[step].querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
    root!.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- Étape 1 : recherche ---------- */

  function setStatus(message: string): void {
    searchStatus.textContent = message;
  }

  function closeList(): void {
    list.hidden = true;
    query.setAttribute('aria-expanded', 'false');
    query.removeAttribute('aria-activedescendant');
    state.active = -1;
  }

  const hitMeta = (hit: CompanyHit): string =>
    [`SIREN ${formatSiren(hit.siren)}`, hit.city, hit.naf && `NAF ${hit.naf}`].filter(Boolean).join(' · ');

  function renderList(): void {
    list.replaceChildren(
      ...state.hits.map((hit, i) =>
        h(
          'li',
          { class: 'opco-option', attrs: { role: 'option', id: `opco-opt-${i}`, 'aria-selected': 'false' } },
          h('span', { class: 'opco-option__name' }, hit.name),
          h('span', { class: 'opco-option__meta' }, hitMeta(hit)),
        ),
      ),
    );
    const open = state.hits.length > 0;
    list.hidden = !open;
    query.setAttribute('aria-expanded', String(open));
    state.active = -1;
  }

  function setActive(index: number): void {
    state.active = index;
    list.querySelectorAll<HTMLElement>('[role="option"]').forEach((option, i) => {
      option.setAttribute('aria-selected', String(i === index));
      if (i === index) {
        query.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  async function runSearch(value: string): Promise<void> {
    searchController?.abort();
    const controller = new AbortController();
    searchController = controller;
    setStatus('Recherche en cours…');
    try {
      const found = await searchRegistry(value, controller.signal);
      if (controller.signal.aborted) return;
      state.hits = found;
      renderList();
      if (found.length === 0) {
        setStatus("Aucune structure trouvée. Vérifiez l'orthographe ou saisissez-la manuellement.");
        return;
      }
      setStatus(`${pluralize(found.length, 'résultat', 'résultats')}. Utilisez les flèches pour naviguer.`);
      // Un SIREN ou SIRET complet désigne une seule structure : inutile de faire cliquer.
      if (/^(\d{9}|\d{14})$/.test(cleanQuery(value)) && found.length === 1) selectCompany(found[0]);
    } catch {
      if (controller.signal.aborted) return;
      state.hits = [];
      renderList();
      setStatus('Le registre est momentanément indisponible. Vous pouvez saisir votre structure manuellement.');
    }
  }

  query.addEventListener('input', () => {
    if (state.selection && !state.selection.manual) {
      state.selection = null;
      check.hidden = true;
      fiche.hidden = true;
    }
    window.clearTimeout(searchTimer);
    if (cleanQuery(query.value).length < 3) {
      searchController?.abort();
      state.hits = [];
      renderList();
      setStatus('');
      return;
    }
    setStatus('Recherche en cours…');
    searchTimer = window.setTimeout(() => void runSearch(query.value), SEARCH_DEBOUNCE_MS);
  });

  query.addEventListener('focus', () => {
    if (!state.selection && state.hits.length) renderList();
  });
  query.addEventListener('blur', closeList);

  query.addEventListener('keydown', (event) => {
    const count = state.hits.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!count) return;
      event.preventDefault();
      if (list.hidden) renderList();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((state.active + step + count) % count);
    } else if (event.key === 'Enter' && !list.hidden && state.active >= 0) {
      event.preventDefault();
      selectCompany(state.hits[state.active]);
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      closeList();
    }
  });

  // mousedown + preventDefault : le champ garde le focus, donc la liste ne se ferme pas avant la sélection.
  list.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const option = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
    if (!option) return;
    const hit = state.hits[Number(option.id.replace('opco-opt-', ''))];
    if (hit) selectCompany(hit);
  });

  /* ---------- Étape 1 : fiche entreprise ---------- */

  function showFiche(mode: 'registry' | 'manual'): void {
    fiche.hidden = false;
    manualOnly.forEach((el) => {
      el.hidden = mode !== 'manual';
    });
    ficheBadge.textContent = mode === 'registry' ? 'REGISTRE PUBLIC' : 'SAISIE MANUELLE';
  }

  function sizeHintFor(hit: CompanyHit): string {
    const label = inseeLabel(hit.insee);
    if (hit.sizeBand && label) {
      const year = hit.insee_year ? ` (donnée ${hit.insee_year})` : '';
      return `Registre public : ${label}${year}. Vérifiez qu'elle est à jour.`;
    }
    if (label) return `Le registre indique ${label}, ce qui chevauche un seuil de financement : confirmez votre tranche.`;
    return 'Le registre indique « effectif non renseigné » : une confirmation est nécessaire.';
  }

  /** IDCC à présélectionner quand le registre en déclare plusieurs : celui qui donne un barème chiffré d'abord. */
  function pickIdcc(idccs: string[]): string {
    const known = idccs.filter((idcc) => opcoFromIdcc(idcc));
    const priced = known.find((idcc) => opcoFromIdcc(idcc) === 'afdas' || atlasBranchFromIdcc(idcc));
    return priced ?? known[0] ?? idccs[0] ?? '';
  }

  function renderChips(idccs: string[], fromRegistry = false): void {
    idccChips.hidden = idccs.length < 2;
    idccChips.replaceChildren(
      ...idccs.map((idcc) =>
        h('button', { class: 'opco-chip', attrs: { type: 'button', 'data-idcc': idcc, 'aria-pressed': 'false' } }, idcc),
      ),
    );
    idccBaseHint =
      idccs.length > 1
        ? 'Plusieurs conventions sont déclarées au registre : choisissez celle qui s’applique à la formation.'
        : fromRegistry && idccs.length === 0
          ? "Le registre ne déclare aucune convention collective pour cette structure. Si vous la connaissez, saisissez-la : elle permet de retrouver votre OPCO."
          : 'Numéro à 4 chiffres, indiqué sur votre bulletin de paie. Il détermine le barème de certains OPCO.';
    syncChips();
    syncIdccHint();
  }

  function syncIdccHint(): void {
    const needsIdcc = opcoSelect.value === 'atlas' && !isValidIdcc(normalizeIdcc(idccInput.value));
    idccHint.textContent = needsIdcc ? ATLAS_IDCC_HINT : idccBaseHint;
  }

  function syncChips(): void {
    const current = normalizeIdcc(idccInput.value);
    idccChips.querySelectorAll<HTMLElement>('[data-idcc]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.idcc === current));
    });
  }

  function applyOpcoFromIdcc(): void {
    const idcc = normalizeIdcc(idccInput.value);
    const suggested = isValidIdcc(idcc) ? opcoFromIdcc(idcc) : undefined;
    if (!state.opcoTouched) opcoSelect.value = suggested ?? '';
    const missingIdcc = state.registryWithoutIdcc && !idcc;
    opcoHint.textContent =
      suggested && opcoSelect.value === suggested
        ? `OPCO suggéré d'après votre convention collective (IDCC ${idcc}). Modifiez-le si besoin.`
        : missingIdcc
          ? "Aucune convention collective n'est déclarée au registre : l'OPCO ne peut pas être déduit. Sélectionnez le vôtre."
          : DEFAULT_OPCO_HINT;
    syncChips();
    syncIdccHint();
  }

  function selectCompany(hit: CompanyHit): void {
    state.selection = { manual: false, name: hit.name, siren: hit.siren };
    query.value = hit.name;
    closeList();
    check.hidden = false;
    setStatus('');
    setError('company', null, query);

    ficheName.textContent = hit.name;
    ficheMeta.textContent = hitMeta(hit);
    showFiche('registry');

    sizeSelect.value = hit.sizeBand ?? '';
    sizeHint.textContent = sizeHintFor(hit);

    const idccs = [...new Set(hit.idcc.map(normalizeIdcc).filter(isValidIdcc))];
    idccInput.value = pickIdcc(idccs);
    renderChips(idccs, true);
    state.registryWithoutIdcc = idccs.length === 0;
    state.opcoTouched = false;
    applyOpcoFromIdcc();
  }

  function setManualMode(manual: boolean): void {
    searchController?.abort();
    window.clearTimeout(searchTimer);
    state.hits = [];
    renderList();
    setStatus('');
    check.hidden = true;
    searchBlock.hidden = manual;
    manualToggle.textContent = manual
      ? 'Rechercher dans le registre'
      : 'Je ne trouve pas ma structure, saisir manuellement';
    setError('company', null, query);
    if (manual) {
      state.selection = { manual: true, name: '' };
      ficheName.textContent = '';
      ficheMeta.textContent = '';
      sizeHint.textContent = "Effectif de l'entreprise, tous établissements confondus.";
      renderChips([]);
      state.registryWithoutIdcc = false;
      showFiche('manual');
      manualName.focus();
    } else {
      state.selection = null;
      query.value = '';
      fiche.hidden = true;
      query.focus();
    }
  }

  manualToggle.addEventListener('click', () => setManualMode(!state.selection?.manual));

  opcoSelect.addEventListener('change', () => {
    state.opcoTouched = true;
    applyOpcoFromIdcc();
  });
  idccInput.addEventListener('input', () => {
    idccInput.value = digitsOnly(idccInput.value).slice(0, 4);
    applyOpcoFromIdcc();
  });
  idccInput.addEventListener('blur', () => {
    idccInput.value = normalizeIdcc(idccInput.value);
    applyOpcoFromIdcc();
  });
  idccHelpToggle.addEventListener('click', () => {
    if (!idccHelp.hasChildNodes()) {
      idccHelp.append(
        createIdccFinder((hit) => {
          idccInput.value = hit.idcc;
          applyOpcoFromIdcc();
          idccHelp.hidden = true;
          idccHelpToggle.setAttribute('aria-expanded', 'false');
          idccInput.focus();
        }),
      );
    }
    idccHelp.hidden = !idccHelp.hidden;
    idccHelpToggle.setAttribute('aria-expanded', String(!idccHelp.hidden));
  });
  idccChips.addEventListener('click', (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-idcc]');
    if (!chip?.dataset.idcc) return;
    idccInput.value = chip.dataset.idcc;
    applyOpcoFromIdcc();
  });

  /* ---------- Étape 1 : catalogue ou devis ---------- */

  function currentOffer(): 'catalog' | 'quote' {
    return Array.from(offerInputs).find((input) => input.checked)?.value === 'quote' ? 'quote' : 'catalog';
  }

  function syncOffer(): void {
    const quote = currentOffer() === 'quote';
    quoteFields.forEach((el) => {
      el.hidden = !quote;
    });
    if (!quote) {
      setError('quote', null, quoteInput);
      setError('quoteHours', null, quoteHoursInput);
    }
  }
  offerInputs.forEach((input) => input.addEventListener('change', syncOffer));

  /* ---------- Étape 1 : validation ---------- */

  function readProfile(): Profile | null {
    const invalid: HTMLElement[] = [];
    const fail = (key: string, message: string, input: HTMLElement) => {
      setError(key, message, input);
      invalid.push(input);
    };
    for (const [key, input] of [
      ['company', query],
      ['manualName', manualName],
      ['siren', sirenInput],
      ['sizeBand', sizeSelect],
      ['opco', opcoSelect],
      ['idcc', idccInput],
      ['participants', participantsInput],
      ['quote', quoteInput],
      ['quoteHours', quoteHoursInput],
    ] as const) {
      setError(key, null, input);
    }

    const selection = state.selection;
    if (!selection) {
      fail('company', 'Sélectionnez votre structure dans la liste, ou saisissez-la manuellement.', query);
      query.focus();
      return null;
    }

    const name = selection.manual ? manualName.value.trim() : selection.name;
    if (selection.manual && !name) fail('manualName', 'Indiquez le nom de votre structure.', manualName);

    let siren = selection.siren;
    if (selection.manual) {
      const digits = digitsOnly(sirenInput.value);
      if (digits && digits.length !== 9) fail('siren', 'Un SIREN comporte 9 chiffres.', sirenInput);
      siren = digits || undefined;
    }

    if (!isSizeBand(sizeSelect.value)) {
      fail('sizeBand', "Sélectionnez la tranche d'effectif de votre entreprise.", sizeSelect);
    }
    if (!isOpcoId(opcoSelect.value)) fail('opco', 'Sélectionnez votre OPCO.', opcoSelect);

    const idcc = normalizeIdcc(idccInput.value);
    if (idcc && !isValidIdcc(idcc)) fail('idcc', 'Un IDCC comporte 4 chiffres (ex. 1486).', idccInput);

    const participants = Number(participantsInput.value);
    if (!Number.isInteger(participants) || participants < 1 || participants > MAX_PARTICIPANTS_PER_SESSION) {
      fail('participants', `Indiquez un nombre entier de participants par session, entre 1 et ${MAX_PARTICIPANTS_PER_SESSION}.`, participantsInput);
    }

    // Formation catalogue : on ignore le devis. Devis fourni : durée et prix par session sont obligatoires.
    let quote: number | undefined;
    let quoteHours: number | undefined;
    if (currentOffer() === 'quote') {
      quote = parseAmount(quoteInput.value);
      if (quote === undefined || Number.isNaN(quote) || quote <= 0) {
        fail('quote', 'Saisissez le montant HT de votre devis, par session (ex. 4800).', quoteInput);
      }
      quoteHours = parseAmount(quoteHoursInput.value);
      if (quoteHours === undefined || Number.isNaN(quoteHours) || quoteHours <= 0 || quoteHours > 500) {
        fail('quoteHours', "Saisissez le nombre d'heures par session de votre devis (ex. 14).", quoteHoursInput);
      }
    }

    if (invalid.length) {
      invalid[0].focus();
      return null;
    }
    return {
      name,
      siren,
      sizeBand: sizeSelect.value as SizeBand,
      opco: opcoSelect.value as OpcoId,
      idcc: idcc || undefined,
      participants,
      quoteHt: quote,
      quoteHours,
    };
  }

  steps.company.addEventListener('submit', (event) => {
    event.preventDefault();
    const profile = readProfile();
    if (!profile) return;
    state.profile = profile;
    fillSummary(profile);
    showStep('unlock');
    void ensureTurnstile();
  });

  /* ---------- Étape 2 : coordonnées ---------- */

  function fillSummary(profile: Profile): void {
    const set = (key: string, value: string) => {
      $(`[data-sum="${key}"]`).textContent = value;
    };
    set('name', profile.name);
    set('size', sizeLabel(profile.sizeBand));
    set('opco', opcoSelect.selectedOptions[0]?.textContent ?? profile.opco);
    set('participants', String(profile.participants));
    const quoteRow = $('[data-sum-quote-row]');
    quoteRow.hidden = profile.quoteHt === undefined;
    if (profile.quoteHt !== undefined && profile.quoteHours !== undefined) {
      set('quote', `${formatEuroHt(profile.quoteHt).replace(' HT', '')} · ${formatHours(profile.quoteHours)} h`);
    }
  }

  async function ensureTurnstile(): Promise<void> {
    if (!TURNSTILE_SITE_KEY) {
      turnstileStatus.textContent = import.meta.env.DEV ? '' : "La vérification anti-robot n'est pas configurée.";
      return;
    }
    if (turnstile) {
      turnstile.reset();
      return;
    }
    turnstileStatus.textContent = 'Chargement de la vérification anti-robot…';
    try {
      turnstile = await mountTurnstile($('[data-turnstile]'), TURNSTILE_SITE_KEY, () => {
        if (turnstile?.token()) setError('turnstile', null);
      });
      turnstileStatus.textContent = '';
    } catch {
      turnstileFailed = true;
      turnstileStatus.textContent = `La vérification anti-robot n'a pas pu se charger. Rechargez la page ou écrivez-nous à ${CONTACT_EMAIL}.`;
    }
  }

  /** Ce qui sera affiché : barème chiffré, ou « à confirmer » complété d'une fourchette générique quand elle est possible. */
  function compute(profile: Profile): { result: EstimateResult; generic: GenericEstimate | null } {
    const result = estimate({
      opco: profile.opco,
      sizeBand: profile.sizeBand,
      idcc: profile.idcc,
      participants: profile.participants,
      durationsHours: hoursFor(profile.quoteHt, profile.quoteHours),
      quoteHt: profile.quoteHt,
    });
    const genericAllowed =
      result.status === 'to_confirm' && (result.reason === 'opco_not_covered' || result.reason === 'branch_not_covered');
    const generic = genericAllowed
      ? genericEstimate({
          sizeBand: profile.sizeBand,
          participants: profile.participants,
          durationsHours: hoursFor(profile.quoteHt, profile.quoteHours),
          quoteHt: profile.quoteHt,
        })
      : null;
    return { result, generic };
  }

  function setSubmitting(value: boolean): void {
    state.submitting = value;
    submitButton.disabled = value;
    submitButton.textContent = value ? 'Enregistrement…' : 'Afficher mon estimation';
  }

  unlockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const profile = state.profile;
    if (state.submitting || !profile) return;

    const invalid: HTMLElement[] = [];
    const fail = (key: string, message: string, input?: HTMLElement) => {
      setError(key, message, input);
      invalid.push(input ?? submitButton);
    };
    for (const [key, input] of [
      ['firstName', firstNameInput],
      ['email', emailInput],
      ['consent', consentInput],
    ] as const) {
      setError(key, null, input);
    }
    setError('turnstile', null);
    setError('submit', null);

    const firstName = firstNameInput.value.trim();
    const email = emailInput.value.trim();
    if (!firstName) fail('firstName', 'Indiquez votre prénom.', firstNameInput);
    if (!email) fail('email', 'Indiquez votre email professionnel.', emailInput);
    else if (!EMAIL_RE.test(email)) fail('email', 'Cet email ne semble pas valide.', emailInput);
    if (!consentInput.checked) fail('consent', 'Votre accord est nécessaire pour afficher et enregistrer votre estimation.', consentInput);

    let token = turnstile?.token() ?? '';
    if (!token && turnstile && !invalid.length) {
      // La vérification est invisible : elle peut simplement ne pas être terminée au moment du clic.
      submitButton.disabled = true;
      submitButton.textContent = 'Vérification…';
      token = await turnstile.waitForToken(10_000);
      submitButton.disabled = false;
      submitButton.textContent = 'Afficher mon estimation';
    }
    if (!token) {
      // En développement sans widget (script bloqué, pas de clé), on ne bloque pas le test du parcours.
      if (import.meta.env.DEV && (!TURNSTILE_SITE_KEY || turnstileFailed)) token = 'dev-no-turnstile';
      else fail('turnstile', "La vérification anti-robot n'a pas abouti. Cochez la case si elle s'affiche, ou réessayez.");
    }
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const { result, generic } = compute(profile);

    setSubmitting(true);
    try {
      await sendLead(
        buildLeadPayload({
          firstName,
          email,
          companyName: profile.name,
          siren: profile.siren,
          opco: profile.opco,
          sizeBand: profile.sizeBand,
          idcc: profile.idcc,
          participants: profile.participants,
          quoteHt: profile.quoteHt,
          result,
          generic,
          turnstileToken: token,
        }),
      );
    } catch (error) {
      console.error('[simulateur-opco] enregistrement impossible', error);
      setError(
        'submit',
        `Votre demande n'a pas pu être enregistrée. Réessayez dans un instant, ou écrivez-nous à ${CONTACT_EMAIL}.`,
      );
      turnstile?.reset();
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    turnstile?.reset();
    renderResult(profile, result, generic);
    showStep('result');
  });

  /* ---------- Résultat ---------- */

  function scenarioCard(s: ScenarioView, profile: Profile): HTMLElement {
    return h(
      'article',
      { class: 'opco-scn' },
      h('p', { class: 'opco-scn__kicker' }, 'Prise en charge maximale estimée'),
      h('h3', { class: 'opco-scn__title' }, s.title),
      priceLine(s.hours, profile),
      h('p', { class: 'opco-scn__amount' }, s.amount),
      h('p', { class: 'opco-scn__context' }, s.context),
      remainingLine(s.estimatedRemaining),
      s.perParticipant && h('p', { class: 'opco-scn__split' }, s.perParticipant),
      h('p', { class: 'opco-scn__limit' }, s.limit),
      s.quote?.fullyCovered && h('p', { class: 'opco-scn__covered' }, 'Votre devis serait couvert en totalité, dans la limite du plafond.'),
    );
  }

  /** Les enfants vont dans un seul <span> : le <li> est en flex (puce + texte), sinon chaque nœud devient une colonne. */
  const item = (...children: (Node | string)[]) => h('li', {}, h('span', {}, ...children));
  const nodes = (...list: (HTMLElement | null)[]): HTMLElement[] => list.filter((n): n is HTMLElement => n !== null);

  function remainingLine(remaining?: string): HTMLElement | null {
    return remaining ? h('p', { class: 'opco-scn__remaining' }, 'Reste à charge estimé : ', h('strong', {}, remaining)) : null;
  }

  function priceLine(hours: number, profile: Profile): HTMLElement | null {
    if (profile.quoteHt !== undefined) {
      return h('p', { class: 'opco-scn__price' }, 'Montant du devis : ', h('strong', {}, formatEuroHt(profile.quoteHt)));
    }
    const price = TRAINING_PRICE_HT[hours];
    return price === undefined
      ? null
      : h(
          'p',
          { class: 'opco-scn__price' },
          'Montant de la formation par session : ',
          h('strong', {}, formatEuroHt(price)),
          h('span', { class: 'opco-scn__price-note' }, 'Tarif catalogue, avant remise éventuelle'),
        );
  }

  /** Un seul bloc (devis saisi) : on ne l'étire pas sur toute la largeur. */
  const scenariosClass = (count: number) => (count === 1 ? 'opco-scenarios opco-scenarios--single' : 'opco-scenarios');

  function genericCard(s: GenericScenarioView, profile: Profile): HTMLElement {
    return h(
      'article',
      { class: 'opco-scn opco-scn--generic' },
      h('p', { class: 'opco-scn__kicker' }, 'Ordre de grandeur générique'),
      h('h3', { class: 'opco-scn__title' }, s.title),
      priceLine(s.hours, profile),
      h('p', { class: 'opco-scn__amount opco-scn__amount--range' }, s.amount),
      h('p', { class: 'opco-scn__context' }, s.context),
      remainingLine(s.estimatedRemaining),
    );
  }

  /** Saisie de l'IDCC sous le résultat, pour recalculer sans repasser par l'étape 1. */
  function idccRecalc(profile: Profile, intro: string): HTMLElement {
    const input = h('input', {
      class: 'opco-input',
      attrs: { id: 'opco-recalc-idcc', type: 'text', inputmode: 'numeric', maxlength: '4', autocomplete: 'off', placeholder: 'Ex. 1486', 'aria-describedby': 'opco-recalc-error' },
    });
    input.value = profile.idcc ?? '';
    const error = h('p', { class: 'opco-error', attrs: { id: 'opco-recalc-error', hidden: '' } });
    const finder = createIdccFinder((hit) => {
      input.value = hit.idcc;
      recalcWith(profile, hit.idcc, error, input);
    });
    finder.hidden = true;
    const toggle = h('button', { class: 'opco-link opco-link--small', attrs: { type: 'button', 'aria-expanded': 'false' } }, 'Je ne connais pas mon IDCC');
    toggle.addEventListener('click', () => {
      finder.hidden = !finder.hidden;
      toggle.setAttribute('aria-expanded', String(!finder.hidden));
    });
    const form = h(
      'form',
      { class: 'opco-recalc', attrs: { novalidate: '' } },
      h('p', { class: 'opco-recalc__intro' }, intro),
      h('label', { class: 'opco-label', attrs: { for: 'opco-recalc-idcc' } }, 'Votre convention collective (IDCC)'),
      h('div', { class: 'opco-recalc__row' }, input, h('button', { class: 'opco-btn opco-btn--primary btn-orange', attrs: { type: 'submit' } }, 'Recalculer mon estimation')),
      error,
      toggle,
      finder,
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      recalcWith(profile, input.value, error, input);
    });
    return form;
  }

  /** Recalcule avec un IDCC saisi sous le résultat ; l'OPCO suit la convention quand notre table la connaît. */
  function recalcWith(profile: Profile, raw: string, error: HTMLElement, input: HTMLElement): void {
    const idcc = normalizeIdcc(raw);
    if (!isValidIdcc(idcc)) {
      error.textContent = 'Un IDCC comporte 4 chiffres (ex. 1486).';
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    const suggested = opcoFromIdcc(idcc);
    const opcoChanged = suggested !== undefined && suggested !== profile.opco;
    const next: Profile = { ...profile, idcc, opco: suggested ?? profile.opco };
    state.profile = next;
    idccInput.value = idcc;
    opcoSelect.value = next.opco;
    state.opcoTouched = true;
    const { result, generic } = compute(next);
    const notice = opcoChanged
      ? `Votre OPCO a été mis à jour d'après votre convention collective (IDCC ${idcc}) : ${opcoLabel(next.opco)}.`
      : `Estimation recalculée avec votre convention collective (IDCC ${idcc}).`;
    renderResult(next, result, generic, notice);
    steps.result.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
    root!.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function renderResult(profile: Profile, result: EstimateResult, generic: GenericEstimate | null, notice?: string): void {
    const priceFor = priceResolver(profile.quoteHt);
    const view = buildResultView(result, priceFor);
    $('[data-result-recap]').textContent = [
      profile.name,
      view.opcoLabel,
      sizeLabel(profile.sizeBand),
      `${pluralize(profile.participants, 'participant', 'participants')} par session`,
    ].join(' · ');
    const noticeEl = notice ? h('p', { class: 'opco-notice', attrs: { role: 'status' } }, notice) : null;

    if (view.kind === 'to_confirm') {
      const reason = result.status === 'to_confirm' ? result.reason : undefined;
      const canRefine = reason === 'opco_not_covered' || reason === 'branch_not_covered';
      const why =
        reason === 'branch_not_covered' && !profile.idcc
          ? `Le barème ${view.opcoLabel} dépend de votre convention collective (IDCC), que nous n'avons pas pu identifier.`
          : reason === 'branch_not_covered'
            ? `Votre convention collective (IDCC ${profile.idcc}) n'est pas encore chiffrée dans le simulateur.`
            : view.message;
      const intro =
        reason === 'opco_not_covered'
          ? 'Si votre OPCO est différent de celui indiqué, renseignez votre convention collective : elle permet de le retrouver.'
          : 'Pour une estimation plus précise, renseignez votre convention collective. Elle détermine le barème applicable.';

      if (generic) {
        const g = buildGenericView(generic, priceFor);
        body.replaceChildren(
          ...nodes(
            noticeEl,
            h(
              'div',
              { class: 'opco-confirm opco-confirm--generic' },
              h('span', { class: 'opco-pill' }, 'Estimation générique'),
              h('p', {}, `${why} Voici un ordre de grandeur générique, pas le barème de votre OPCO.`),
            ),
                h('div', { class: scenariosClass(g.scenarios.length) }, ...g.scenarios.map((sc) => genericCard(sc, profile))),
            h(
              'ul',
              { class: 'opco-meta' },
              item('Cette fourchette va du plus bas au plus haut des plafonds que nous avons relevés à la source pour une entreprise de cette taille. Elle ne constitue ni le barème de votre OPCO, ni un accord de prise en charge.'),
              g.sameHigh
                ? item('La borne haute est identique pour toutes les durées : elle correspond à un plafond annuel par entreprise, qui ne dépend pas de la durée de la formation.')
                : null,
            ),
            canRefine ? idccRecalc(profile, intro) : null,
          ),
        );
        return;
      }
      body.replaceChildren(
        ...nodes(
          noticeEl,
          h(
            'div',
            { class: 'opco-confirm' },
            h('h3', {}, 'Barème à confirmer'),
            h('p', {}, reason === 'branch_not_covered' ? `${why} Nous la confirmons avec ${view.opcoLabel} lors de l'étude de votre dossier.` : view.message),
          ),
          canRefine ? idccRecalc(profile, intro) : null,
        ),
      );
      return;
    }
    body.replaceChildren(
      ...nodes(
        noticeEl,
        h('div', { class: scenariosClass(view.scenarios.length) }, ...view.scenarios.map((sc) => scenarioCard(sc, profile))),
        h(
          'ul',
          { class: 'opco-meta' },
          item(`Barème appliqué : ${view.opcoLabel}, ${view.scheme}.`),
          ...view.notes.map((note) => item(note)),
          item(
            'Source officielle : ',
            h('a', { attrs: { href: view.sourceUrl, target: '_blank', rel: 'noopener noreferrer' } }, `critères de financement ${view.opcoLabel}`),
            `, vérifiée le ${formatDateFr(view.verifiedAt)}.`,
          ),
        ),
      ),
    );
  }

  root.querySelector('[data-action="edit"]')?.addEventListener('click', () => showStep('company'));
  root.querySelector('[data-action="back-to-company"]')?.addEventListener('click', () => showStep('company'));
}
