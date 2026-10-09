import { h } from './dom';
import { isSearchable, searchConventions, type ConventionHit } from './idcc-search';

const DEBOUNCE_MS = 150;
let counter = 0;

/**
 * Aide à retrouver sa convention collective : où la lire, et une recherche par nom ou numéro.
 * Utilisée à l'étape 1 et sous le résultat.
 */
export function createIdccFinder(onPick: (hit: ConventionHit) => void): HTMLElement {
  const id = `opco-finder-${++counter}`;
  const input = h('input', {
    class: 'opco-input',
    attrs: {
      id: `${id}-q`,
      type: 'search',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: 'Ex. Syntec, experts-comptables, 1486',
      'aria-describedby': `${id}-status`,
    },
  });
  const status = h('p', { class: 'opco-status', attrs: { id: `${id}-status`, role: 'status', 'aria-live': 'polite' } });
  const results = h('ul', { class: 'opco-finder__results', attrs: { 'aria-label': 'Conventions trouvées' } });

  let timer: number | undefined;
  let latest = 0;

  const render = (hits: ConventionHit[]) => {
    results.replaceChildren(
      ...hits.map((hit) => {
        const button = h(
          'button',
          { class: 'opco-finder__pick', attrs: { type: 'button' } },
          h('strong', {}, hit.idcc),
          h('span', {}, hit.title ?? 'Intitulé non disponible'),
          hit.opco && h('em', {}, `OPCO habituel : ${hit.opco}`),
        );
        button.addEventListener('click', () => onPick(hit));
        return h('li', {}, button);
      }),
    );
  };

  const run = async (value: string) => {
    const ticket = ++latest;
    try {
      const hits = await searchConventions(value);
      if (ticket !== latest) return;
      render(hits);
      status.textContent = hits.length
        ? 'Choisissez votre convention dans la liste.'
        : 'Aucune convention trouvée. Essayez un autre mot, ou saisissez directement le numéro.';
    } catch {
      if (ticket !== latest) return;
      render([]);
      status.textContent = 'La recherche est momentanément indisponible. Vous pouvez saisir directement le numéro.';
    }
  };

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    if (!isSearchable(input.value)) {
      latest++;
      render([]);
      status.textContent = '';
      return;
    }
    timer = window.setTimeout(() => void run(input.value), DEBOUNCE_MS);
  });
  // Entrée dans ce champ ne doit pas envoyer le formulaire qui le contient.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') event.preventDefault();
  });

  return h(
    'div',
    { class: 'opco-finder' },
    h(
      'ul',
      { class: 'opco-finder__tips' },
      h('li', {}, "Sur votre bulletin de paie : l'intitulé de la convention collective y figure, souvent avec son numéro (IDCC) à 4 chiffres."),
      h('li', {}, 'Sinon, demandez-le à votre service paie ou à votre expert-comptable, ou regardez votre contrat de travail.'),
    ),
    h('label', { class: 'opco-label', attrs: { for: `${id}-q` } }, 'Ou recherchez-la par son nom ou son numéro'),
    input,
    status,
    results,
  );
}
