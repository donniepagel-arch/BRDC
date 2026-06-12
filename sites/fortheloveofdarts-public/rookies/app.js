const root = document.documentElement;
const hero = document.querySelector('.hero');

if (hero) {
  window.addEventListener('scroll', () => {
    const progress = Math.min(1, window.scrollY / 420);
    root.style.setProperty('--hero-lift', `${progress * 18}px`);
  }, { passive: true });
}

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', event => {
    const id = link.getAttribute('href');
    const target = id && document.querySelector(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
