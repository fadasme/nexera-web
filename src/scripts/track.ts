/**
 * Wrapper único de eventos de conversión.
 * Agregar un proveedor nuevo = un caso en este switch
 * (+ su snippet en src/components/Analytics.astro).
 */
type WindowConAnalytics = Window & {
  gtag?: (...args: unknown[]) => void;
  umami?: { track?: (event: string) => void };
  plausible?: (event: string) => void;
};

const provider = import.meta.env.PUBLIC_ANALYTICS_PROVIDER ?? 'none';

export function track(event: string): void {
  try {
    const w = window as WindowConAnalytics;
    switch (provider) {
      case 'ga4':
        w.gtag?.('event', event);
        break;
      case 'umami':
        w.umami?.track?.(event);
        break;
      case 'plausible':
        w.plausible?.(event);
        break;
      // 'cloudflare': Web Analytics no soporta eventos custom; 'none': no-op
      default:
        break;
    }
  } catch {
    // la analítica jamás rompe la página
  }
}
