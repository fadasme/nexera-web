/**
 * Progressive enhancement de la landing:
 *  - timeline del proceso: auto-avance 2.6 s + click (detiene el auto-avance)
 *  - tabs de servicios: hover / click
 *  - links del nav y footer con data-goto-tab: activan el tab y navegan
 * Sin JS nada de esto corre: html.no-js muestra todo el contenido apilado.
 */

// ── Timeline del proceso ──
const stepBtns = Array.from(document.querySelectorAll<HTMLElement>('[data-step-btn]'));
const stepPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-step-panel]'));

if (stepBtns.length > 0 && stepPanels.length === stepBtns.length) {
  let paso = 0;
  let intervalo: number | undefined;

  const activarPaso = (i: number): void => {
    paso = i;
    stepBtns.forEach((b, j) => b.classList.toggle('active', j === i));
    stepPanels.forEach((p, j) => p.classList.toggle('active', j === i));
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    intervalo = window.setInterval(() => activarPaso((paso + 1) % stepBtns.length), 2600);
  }

  stepBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      window.clearInterval(intervalo);
      activarPaso(i);
    });
  });
}

// ── Tabs de servicios ──
const tabBtns = Array.from(document.querySelectorAll<HTMLElement>('[data-tab-btn]'));
const tabPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-tab-panel]'));

function activarTab(i: number): void {
  tabBtns.forEach((b, j) => {
    b.classList.toggle('active', j === i);
    b.setAttribute('aria-selected', j === i ? 'true' : 'false');
  });
  tabPanels.forEach((p, j) => p.classList.toggle('active', j === i));
}

if (tabBtns.length > 0 && tabPanels.length === tabBtns.length) {
  tabBtns.forEach((btn, i) => {
    btn.addEventListener('mouseenter', () => activarTab(i));
    btn.addEventListener('click', () => activarTab(i));
  });

  // Links tipo "Capacitación en IA" (nav y footer) → activar tab + navegar.
  document.querySelectorAll<HTMLElement>('[data-goto-tab]').forEach((link) => {
    link.addEventListener('click', () => {
      const i = Number(link.dataset.gotoTab);
      if (Number.isInteger(i) && i >= 0 && i < tabBtns.length) activarTab(i);
    });
  });
}
