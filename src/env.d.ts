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

declare namespace App {
  interface Locals {
    /**
     * Presente solo en el target cloudflare (adapter @astrojs/cloudflare).
     * Tipado a mano para no depender de tipos globales de Workers en el
     * chequeo del target node.
     */
    runtime?: {
      env: Record<string, unknown>;
      ctx?: { waitUntil(promise: Promise<unknown>): void };
    };
  }
}
