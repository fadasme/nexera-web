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
const siteOrigin = new URL(siteUrl);

const src = (/** @type {string} */ p) => fileURLToPath(new URL(p, import.meta.url));

// Trampa de portabilidad nº1: solo se resuelven las implementaciones del target
// activo, por lo tanto la descartada JAMÁS entra al bundle del otro.
const runtimeImpl = {
  node: {
    '@driver/db': './src/lib/db/db.mysql.ts',
    '@driver/smtp': './src/lib/mail/smtp.real.ts',
    '@runtime/env': './src/lib/runtime/env.node.ts',
    '@runtime/ip': './src/lib/runtime/ip.node.ts',
  },
  cloudflare: {
    '@driver/db': './src/lib/db/db.d1.ts',
    '@driver/smtp': './src/lib/mail/smtp.stub.ts',
    '@runtime/env': './src/lib/runtime/env.cloudflare.ts',
    '@runtime/ip': './src/lib/runtime/ip.cloudflare.ts',
  },
};

export default defineConfig({
  site: siteUrl,
  output: 'static',
  build: {
    // Landing pequeña: evita una cadena CSS bloqueante en la primera visita.
    inlineStylesheets: 'always',
  },
  // Astro valida Origin contra el host público declarado. Sin esta allowlist,
  // checkOrigin rechaza el POST legítimo detrás de nginx.
  security: {
    allowedDomains: [
      {
        hostname: siteOrigin.hostname,
        protocol: siteOrigin.protocol.slice(0, -1),
        ...(siteOrigin.port ? { port: siteOrigin.port } : {}),
      },
    ],
  },
  adapter:
    target === 'cloudflare'
      ? cloudflare({ imageService: 'compile' })
      : node({ mode: 'standalone' }),
  integrations: [
    sitemap({
      filter: (page) => !/\/gracias\/?$/.test(page),
    }),
  ],
  vite: {
    resolve: {
      alias: {
        ...Object.fromEntries(
          Object.entries(runtimeImpl[target]).map(([name, path]) => [name, src(path)]),
        ),
        '@': src('./src'),
      },
    },
  },
});
