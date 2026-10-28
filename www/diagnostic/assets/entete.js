// Menu de l'en-tête du site (repris de formations.js) : menu mobile et sous-menu Formations.
(() => {
  const btn = document.querySelector('.nav-toggle');
  const menu = document.getElementById('menu');
  if (btn && menu) {
    const set = (open) => { btn.setAttribute('aria-expanded', open); menu.classList.toggle('is-open', open); };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { set(false); btn.focus(); } });
    document.addEventListener('click', (e) => { if (!e.target.closest('.top-nav')) set(false); });
  }

  // Sous-menu Formations : clic, Échap et sortie du focus le referment
  document.querySelectorAll('.has-sub').forEach((item) => {
    const toggle = item.querySelector('.sub-toggle');
    const setSub = (open) => { item.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', open); };
    toggle.addEventListener('click', () => setSub(!item.classList.contains('is-open')));
    item.addEventListener('keydown', (e) => { if (e.key === 'Escape' && item.classList.contains('is-open')) { e.stopPropagation(); setSub(false); toggle.focus(); } });
    item.addEventListener('focusout', (e) => { if (!item.contains(e.relatedTarget)) setSub(false); });
    document.addEventListener('click', (e) => { if (!item.contains(e.target)) setSub(false); });
  });
})();
