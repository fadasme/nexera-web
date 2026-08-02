/**
 * Datos del sitio para SEO, JSON-LD y contacto visible.
 * Se llenan desde PUBLIC_* (capturadas por `npm run setup`);
 * los defaults son los valores del mockup de Nexera.
 */
const env = import.meta.env;
const name = env.PUBLIC_SITE_NAME ?? 'Nexera';

export const site = {
  url: env.PUBLIC_SITE_URL ?? 'https://nexera.cl',
  name,
  email: env.PUBLIC_BUSINESS_EMAIL ?? 'contacto@nexera.cl',
  phone: env.PUBLIC_BUSINESS_PHONE ?? '+56 9 5400 9251',
  whatsapp: (env.PUBLIC_BUSINESS_WHATSAPP ?? '56954009251').replace(/\D/g, ''),
  street: env.PUBLIC_BUSINESS_STREET ?? '',
  city: env.PUBLIC_BUSINESS_CITY ?? 'Santiago',
  region: env.PUBLIC_BUSINESS_REGION ?? 'Región Metropolitana',
  country: env.PUBLIC_BUSINESS_COUNTRY ?? 'CL',
  social: (env.PUBLIC_BUSINESS_SOCIAL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  tagline: 'Tecnología e Inteligencia Artificial para tu empresa',
  seoTitle: `${name} | Inteligencia Artificial para empresas en Chile`,
  description:
    'Boutique tecnológica con atención directa, experiencia senior y soluciones adaptadas a la realidad de cada organización.',
} as const;
