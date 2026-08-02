/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_SITE_NAME?: string;
  readonly PUBLIC_BUSINESS_EMAIL?: string;
  readonly PUBLIC_BUSINESS_PHONE?: string;
  readonly PUBLIC_BUSINESS_WHATSAPP?: string;
  readonly PUBLIC_BUSINESS_STREET?: string;
  readonly PUBLIC_BUSINESS_CITY?: string;
  readonly PUBLIC_BUSINESS_REGION?: string;
  readonly PUBLIC_BUSINESS_COUNTRY?: string;
  readonly PUBLIC_BUSINESS_SOCIAL?: string;
  readonly PUBLIC_ANALYTICS_PROVIDER?: string;
  readonly PUBLIC_ANALYTICS_ID?: string;
  readonly PUBLIC_ANALYTICS_SRC?: string;
  readonly PUBLIC_CAPTCHA_PROVIDER?: string;
  readonly PUBLIC_CAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Tipado a mano: el chequeo se hace con los paths del target node, donde el
// módulo virtual `cloudflare:workers` no existe.
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
