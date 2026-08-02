/**
 * Wizard del formulario de contacto (progressive enhancement).
 * Sin JS el <form> funciona igual: submit nativo → 303 /gracias.
 */
import { track } from './track';

type WindowConCaptcha = Window & {
  turnstile?: { reset?: () => void };
  grecaptcha?: { reset?: () => void };
};

const card = document.querySelector<HTMLElement>('[data-form-card]');

if (card) {
  const form = card.querySelector<HTMLFormElement>('form[data-form]');
  const fieldsets = Array.from(card.querySelectorAll<HTMLFieldSetElement>('[data-step]'));
  const label = card.querySelector<HTMLElement>('[data-form-label]');
  const pct = card.querySelector<HTMLElement>('[data-form-pct]');
  const bar = card.querySelector<HTMLElement>('[data-form-bar]');
  const nav = card.querySelector<HTMLElement>('[data-form-nav]');
  const atras = card.querySelector<HTMLButtonElement>('[data-back]');
  const siguiente = card.querySelector<HTMLButtonElement>('[data-next]');
  const sent = card.querySelector<HTMLElement>('[data-sent]');
  const ts = card.querySelector<HTMLInputElement>('[data-ts]');

  if (form && fieldsets.length === 3 && label && pct && bar && nav && atras && siguiente && sent && ts) {
    const TOTAL = 3;
    let paso = 1;

    // time-trap: marca el momento del render
    ts.value = String(Date.now());

    const mostrarError = (code: string): void => {
      card.querySelectorAll<HTMLElement>('.error.show').forEach((e) => e.classList.remove('show'));
      const el =
        card.querySelector<HTMLElement>(`[data-error-code="${code}"]`) ??
        card.querySelector<HTMLElement>('[data-error-code="invalido"]');
      el?.classList.add('show');
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const limpiarErrores = (): void => {
      card.querySelectorAll<HTMLElement>('.error.show').forEach((e) => e.classList.remove('show'));
    };

    const irA = (n: number): void => {
      paso = Math.min(TOTAL, Math.max(1, n));
      fieldsets.forEach((f) => f.classList.toggle('active', Number(f.dataset.step) === paso));
      const p = Math.round((paso / TOTAL) * 100);
      label.textContent = `Paso ${paso} de ${TOTAL}`;
      pct.textContent = `${p}%`;
      bar.style.width = `${p}%`;
      siguiente.innerHTML =
        paso === TOTAL
          ? 'Enviar consulta <span aria-hidden="true">→</span>'
          : 'Continuar <span aria-hidden="true">→</span>';
    };

    const enviar = async (): Promise<void> => {
      if (!form.reportValidity()) return;
      limpiarErrores();
      siguiente.disabled = true;
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        const data = (await res.json().catch(() => ({ ok: false, error: 'servidor' }))) as {
          ok: boolean;
          error?: string;
        };
        if (data.ok) {
          form.hidden = true;
          nav.hidden = true;
          sent.hidden = false;
          track('contacto_enviado');
        } else {
          mostrarError(data.error ?? 'servidor');
          const w = window as WindowConCaptcha;
          w.turnstile?.reset?.();
          w.grecaptcha?.reset?.();
        }
      } catch {
        mostrarError('servidor');
      } finally {
        siguiente.disabled = false;
      }
    };

    atras.addEventListener('click', () => irA(paso - 1));
    siguiente.addEventListener('click', () => {
      if (paso < TOTAL) irA(paso + 1);
      else void enviar();
    });
    form.addEventListener('submit', (e) => {
      // Enter dentro de un input: respeta el flujo del wizard.
      e.preventDefault();
      if (paso < TOTAL) irA(paso + 1);
      else void enviar();
    });

    // Volvimos de un 303 con error (flujo sin fetch) y ahora hay JS:
    // mostrar el error y saltar al paso de los datos.
    const e = new URLSearchParams(window.location.search).get('e');
    if (e) {
      irA(TOTAL);
      mostrarError(e);
    } else {
      irA(1);
    }
  }
}
