// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import node from '@astrojs/node';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// Astro no carga .env dentro de este archivo: lo hacemos a mano con Vite.
// process.env (CI, `DEPLOY_TARGET=cf npm run build`) gana sobre .env.
const fileEnv = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const env = (/** @type {string} */ key) => process.env[key] ?? fileEnv[key];

const target = env('DEPLOY_TARGET') ?? 'node';
if (target !== 'node' && target !== 'cloudflare') {
  throw new Error(
    `DEPLOY_TARGET debe ser "node" o "cloudflare" (recibido: "${target}"). Corre \`npm run setup\`.`,
  );
}

const siteUrl = env('PUBLIC_SITE_URL') ?? 'https://nexera.cl';

const src = (/** @type {string} */ p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  site: siteUrl,
  output: 'static',
  adapter:
    target === 'cloudflare'
      ? cloudflare({ platformProxy: { enabled: true } })
      : node({ mode: 'standalone' }),
  integrations: [sitemap()],
  vite: {
    resolve: {
      alias: {
        // Trampa de portabilidad nº1: el driver descartado JAMÁS se resuelve,
        // por lo tanto jamás entra al bundle del otro target.
        '@driver/db': src(
          target === 'cloudflare' ? './src/lib/db/db.d1.ts' : './src/lib/db/db.mysql.ts',
        ),
        '@driver/smtp': src(
          target === 'cloudflare' ? './src/lib/mail/smtp.stub.ts' : './src/lib/mail/smtp.real.ts',
        ),
        '@': src('./src'),
      },
    },
  },
});
