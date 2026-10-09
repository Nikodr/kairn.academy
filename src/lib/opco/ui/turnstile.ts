interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      language?: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<TurnstileApi> | null = null;

/** Charge le script Cloudflare à la demande (étape 2 seulement) : rien n'est chargé tant que l'étape n'est pas atteinte. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile indisponible'));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Turnstile indisponible'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileHandle {
  /** Jeton courant, vide tant que le contrôle n'est pas passé ou s'il a expiré. */
  token(): string;
  reset(): void;
  destroy(): void;
}

export async function mountTurnstile(
  container: HTMLElement,
  siteKey: string,
  onChange: () => void,
): Promise<TurnstileHandle> {
  const api = await loadTurnstile();
  let current = '';
  const widgetId = api.render(container, {
    sitekey: siteKey,
    theme: 'light',
    language: 'fr',
    callback: (token) => {
      current = token;
      onChange();
    },
    'expired-callback': () => {
      current = '';
      onChange();
    },
    'error-callback': () => {
      current = '';
      onChange();
    },
  });
  return {
    token: () => current,
    reset: () => {
      current = '';
      api.reset(widgetId);
    },
    destroy: () => api.remove(widgetId),
  };
}
