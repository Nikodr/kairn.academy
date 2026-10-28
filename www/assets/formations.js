// Pages formations : menu mobile, barre CTA mobile, demande de contact (envoi par assets/contact.js).
(() => {
  // Menu mobile
  const btn = document.querySelector('.nav-toggle');
  const menu = document.getElementById('menu');
  if (btn && menu) {
    const set = open => { btn.setAttribute('aria-expanded', open); menu.classList.toggle('is-open', open); };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { set(false); btn.focus(); } });
    document.addEventListener('click', e => { if (!e.target.closest('.top-nav')) set(false); });
  }

  // Sous-menu Formations : clic, Échap et sortie du focus le referment
  document.querySelectorAll('.has-sub').forEach(item => {
    const toggle = item.querySelector('.sub-toggle');
    const setSub = open => { item.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', open); };
    toggle.addEventListener('click', () => setSub(!item.classList.contains('is-open')));
    item.addEventListener('keydown', e => { if (e.key === 'Escape' && item.classList.contains('is-open')) { e.stopPropagation(); setSub(false); toggle.focus(); } });
    item.addEventListener('focusout', e => { if (!item.contains(e.relatedTarget)) setSub(false); });
    document.addEventListener('click', e => { if (!item.contains(e.target)) setSub(false); });
  });

  // Barre CTA mobile : visible après le CTA du hero, masquée quand le bloc RDV est à l'écran
  const bar = document.querySelector('.sticky-cta');
  const heroCta = document.querySelector('.hero .cta');
  const rdv = document.getElementById('rdv');
  if (bar && heroCta && rdv && 'IntersectionObserver' in window) {
    let pastHero = false, onRdv = false;
    const update = () => {
      const on = pastHero && !onRdv;
      bar.classList.toggle('is-on', on);
      bar.setAttribute('aria-hidden', !on);
      bar.querySelector('a').tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; update(); }).observe(heroCta);
    new IntersectionObserver(([e]) => { onRdv = e.isIntersecting; update(); }, { rootMargin: '0px 0px -30% 0px' }).observe(rdv);
    update();
  }

  // Réservation : pré-remplissage, messages d'erreur rédigés, envoi vers Brevo
  const form = document.getElementById('booking');
  if (!form) return;
  // Pré-remplissage de l'équipe : ?equipe= dans l'URL, sinon la page métier
  const labels = { product: 'Product', developpeurs: 'Dev', 'les-deux': 'Product et Dev' };
  const param = new URLSearchParams(location.search).get('equipe');
  const team = labels[param] || labels[form.dataset.team];
  const teamField = form.querySelector('#equipe');
  if (team && teamField && !teamField.value) teamField.value = team;

  // Les liens [data-prefill] remplissent « Qu'est-ce qui vous amène ? », l'annoncent et amènent au premier champ à remplir
  const flag = form.querySelector('.booking-flag');
  document.querySelectorAll('[data-prefill]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const area = form.querySelector('#contexte');
    if (area && !area.value.trim()) area.value = a.dataset.prefill;
    if (flag) { flag.hidden = false; flag.textContent = a.dataset.flag || 'Demande de mise en relation notée. Réservez votre créneau : nous organisons l\'échange avec une équipe formée.'; }
    form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    const first = (a.dataset.focus && form.querySelector('#' + a.dataset.focus))
      || [...form.querySelectorAll('input[required]')].find(el => !el.value.trim()) || area;
    setTimeout(() => first.focus({ preventScroll: true }), 450);
  }));

  const messages = {
    nom: 'Indiquez votre prénom et votre nom.',
    email: 'Indiquez un email valide, par exemple prenom@entreprise.fr.',
  };
  const showError = (name, text) => {
    const box = form.querySelector(`#err-${name}`);
    if (box) box.textContent = text || '';
    form.querySelectorAll(`[name="${name}"]`).forEach(el => el.setAttribute('aria-invalid', text ? 'true' : 'false'));
  };
  const check = name => {
    const ok = form.elements[name].checkValidity();
    showError(name, ok ? '' : messages[name]);
    return ok;
  };
  Object.keys(messages).forEach(name => form.elements[name].addEventListener('blur', e => {
    if (e.target.getAttribute('aria-invalid') === 'true') check(name);
  }));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const note = form.querySelector('.booking-note');
    const invalid = Object.keys(messages).filter(name => !check(name));
    if (invalid.length) {
      note.textContent = '';
      form.querySelector(`[name="${invalid[0]}"]`).focus();
      return;
    }
    // Envoi vers Brevo (assets/contact.js)
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    note.textContent = 'Envoi en cours…';
    const result = await window.kairnContact.envoyer(form);
    button.disabled = false;
    if (result.ok) {
      form.reset();
      if (flag) flag.hidden = true;
      note.textContent = 'Merci, votre demande est bien envoyée. Nous vous proposons un créneau par email sous 24 h ouvrées.';
      return;
    }
    if (result.champ === 'email') {
      note.textContent = '';
      showError('email', messages.email);
      form.elements.email.focus();
      return;
    }
    note.textContent = "Votre demande n'a pas pu être envoyée. Réessayez dans un instant, ou écrivez-nous à nicolas@kairn.academy.";
  });
})();

// Carrousel des modules : départ sur le module data-start, flèches, état « Modules x à y sur 8 »
document.querySelectorAll('.mods-carousel').forEach(root => {
  const track = root.querySelector('.mc-track');
  const cards = [...track.children];
  const prev = root.querySelector('.mc-prev');
  const next = root.querySelector('.mc-next');
  const status = root.querySelector('.mc-status');
  const step = () => cards[1].offsetLeft - cards[0].offsetLeft;
  const update = () => {
    const first = Math.round(track.scrollLeft / step());
    const visible = Math.max(1, Math.round(track.clientWidth / step()));
    const last = Math.min(cards.length, first + visible);
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    status.textContent = visible > 1 ? `Modules ${first + 1} et ${last} sur ${cards.length}` : `Module ${first + 1} sur ${cards.length}`;
  };
  const start = cards[(parseInt(track.dataset.start, 10) || 1) - 1];
  const behavior = track.style.scrollBehavior;
  track.style.scrollBehavior = 'auto';
  track.scrollLeft = start.offsetLeft - cards[0].offsetLeft;
  track.style.scrollBehavior = behavior;
  // Défilement par carte, avec repli instantané si l'animation ne se lance pas
  const go = dir => {
    const index = Math.min(cards.length - 1, Math.max(0, Math.round(track.scrollLeft / step()) + dir));
    const left = Math.min(track.scrollWidth - track.clientWidth, cards[index].offsetLeft - cards[0].offsetLeft);
    track.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(() => { if (Math.abs(track.scrollLeft - left) > 2) { track.style.scrollBehavior = 'auto'; track.scrollLeft = left; track.style.scrollBehavior = ''; } update(); }, 600);
  };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  track.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
});
