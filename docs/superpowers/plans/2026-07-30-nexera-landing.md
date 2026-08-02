# Nexera Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Landing Astro 7 fiel al mockup `_design/Nexera Landing.dc.html`, con formulario→DB→correo, analítica y SEO, desplegable en VPS (Node+MySQL) o Cloudflare (Workers+D1) desde el mismo código.

**Architecture:** `output:'static'` con un único endpoint SSR (`/api/contacto`). El target se decide en build (`DEPLOY_TARGET`) e intercambia adapter y alias de Vite (`@driver/db`, `@driver/smtp`) para que el driver descartado jamás entre al bundle. Env unificado vía `getEnv(locals)`. Schemas SQL gemelos tras la fachada `saveContacto`/`countRecentByIpHash`.

**Tech Stack:** Astro 7 + TS strict · @astrojs/node|cloudflare · @astrojs/sitemap · zod · mysql2 (solo node) · nodemailer (solo node) · Resend HTTP · @fontsource (Archivo, IBM Plex Sans/Mono) · wrangler 4.

**Fuente de verdad visual:** `_design/Nexera Landing.dc.html` (raw) + mapa de tokens en `docs/superpowers/specs/2026-07-30-nexera-landing-design.md` §1. El implementador copia valores exactos desde ahí; este plan no duplica los 378 líneas de markup.

## Global Constraints

- TypeScript `strict`; `astro check` limpio en ambos targets.
- `output: 'static'`; solo `src/pages/api/contacto.ts` con `export const prerender = false`.
- Bundle CF sin `mysql2`/`nodemailer`; bundle node sin código Workers; ningún secreto en client.
- Formulario funcional sin JS (303 → `/gracias` | `/?e=<code>#contacto`).
- Deps permitidas: las del stack + `@types/node`, `@types/nodemailer`, `@astrojs/check`, `typescript`, `sharp` (transitiva de Astro). Nada más sin justificar.
- Copys, colores y medidas: exactos del mockup. `lang="es-CL"`.
- Guardar primero, correo después; el lead nunca se pierde por fallo de correo.
- `npm run setup` idempotente; nunca pisa `.env` sin preguntar (backup `.env.bak`); `--dry-run` y `--target=<t> --yes` para CI.

## Inventario de variables de entorno (contrato global)

```
DEPLOY_TARGET=node|cloudflare
PUBLIC_SITE_URL PUBLIC_SITE_NAME PUBLIC_BUSINESS_EMAIL PUBLIC_BUSINESS_PHONE
PUBLIC_BUSINESS_WHATSAPP PUBLIC_BUSINESS_STREET PUBLIC_BUSINESS_CITY
PUBLIC_BUSINESS_REGION PUBLIC_BUSINESS_COUNTRY PUBLIC_BUSINESS_SOCIAL
PUBLIC_ANALYTICS_PROVIDER=ga4|umami|plausible|cloudflare|none PUBLIC_ANALYTICS_ID PUBLIC_ANALYTICS_SRC
PUBLIC_CAPTCHA_PROVIDER=turnstile|recaptcha|none PUBLIC_CAPTCHA_SITE_KEY
CAPTCHA_SECRET IP_HASH_SALT RATE_LIMIT_MAX=5 RATE_LIMIT_WINDOW=3600
MYSQL_HOST MYSQL_PORT MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE
MAIL_PROVIDER=resend|smtp|none RESEND_API_KEY MAIL_FROM MAIL_TO
SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_SECURE
HOST PORT   (solo runtime node)
```

---

### Task 1: Scaffold + toolchain dual

**Files:** Create `package.json`, `tsconfig.json`, `astro.config.mjs`, `src/env.d.ts`, `.gitignore`, `.env.example`, `public/favicon.svg`, `src/assets/nexera-hero.png`, `src/assets/nexera-logo.png`, `public/og.png` (1200×630 desde el hero, generado una vez con sharp).

**Interfaces (produce):** aliases `@driver/db`→`src/lib/db/db.{mysql|d1}.ts`, `@driver/smtp`→`src/lib/mail/smtp.{real|stub}.ts`, `@runtime/env` e `@runtime/ip`→variantes `{node|cloudflare}`, y `@/`→`src/`; scripts npm `dev`, `dev:cf`, `build`, `build:node`, `build:cf`, `check`, `preview`, `setup`, `migrate:php`, `deploy`.

- [ ] Step 1: `package.json` — deps: astro ^7, @astrojs/node ^11, @astrojs/cloudflare ^14, @astrojs/sitemap ^3, zod ^3.24, mysql2 ^3, nodemailer ^9, @fontsource/{archivo,ibm-plex-sans,ibm-plex-mono}; dev: @astrojs/check, typescript ^5, wrangler ^4, @types/node, @types/nodemailer, sharp ^0.35. `engines.node >=22.12`.
- [ ] Step 2: `astro.config.mjs` — `loadEnv` de Vite para leer `.env` (`DEPLOY_TARGET`, `PUBLIC_SITE_URL`); adapter condicional:

```js
const target = process.env.DEPLOY_TARGET ?? env.DEPLOY_TARGET ?? 'node';
adapter: target === 'cloudflare'
  ? cloudflare({ imageService: 'compile' })
  : node({ mode: 'standalone' }),
vite: { resolve: { alias: {
  '@driver/db': fileURLToPath(new URL(target === 'cloudflare' ? './src/lib/db/db.d1.ts' : './src/lib/db/db.mysql.ts', import.meta.url)),
  '@driver/smtp': fileURLToPath(new URL(target === 'cloudflare' ? './src/lib/mail/smtp.stub.ts' : './src/lib/mail/smtp.real.ts', import.meta.url)),
  '@runtime/env': fileURLToPath(new URL(target === 'cloudflare' ? './src/lib/runtime/env.cloudflare.ts' : './src/lib/runtime/env.node.ts', import.meta.url)),
  '@': fileURLToPath(new URL('./src', import.meta.url)),
} } },
site: PUBLIC_SITE_URL || 'https://nexera.cl', output: 'static', integrations: [sitemap()]
```

- [ ] Step 3: `tsconfig.json` strict + paths (`@driver/db`→db.mysql, `@driver/smtp`→smtp.real, `@/*`→src/*). `src/env.d.ts`: `ImportMetaEnv` con todas las `PUBLIC_*`; `App.Locals.runtime?.env` declarado a mano (sin depender de tipos globales de workers).
- [ ] Step 4: copiar assets desde `_design/assets/`; generar `public/og.png` con sharp (script one-shot en eval, no queda en repo).
- [ ] Step 5: `npm install`; verificar `npx astro --version` → 5.x. Commit.

### Task 2: Tokens, layout y SEO shell

**Files:** Create `src/styles/global.css`, `src/config/site.ts`, `src/components/Seo.astro`, `src/components/JsonLd.astro`, `src/components/Analytics.astro`, `src/scripts/track.ts`, `src/layouts/Layout.astro`, `src/pages/robots.txt.ts`, `src/pages/index.astro` (placeholder mínimo), `src/pages/404.astro`.

**Interfaces (produce):**
- `site.ts`: `export const site = { url, name, email, phone, whatsapp, street, city, region, country, social: string[] }` leyendo `import.meta.env.PUBLIC_*` con defaults del mockup.
- `Seo.astro` props: `{ title: string; description: string; image?: string; noindex?: boolean }`.
- `track.ts`: `export function track(event: string): void` — switch por `PUBLIC_ANALYTICS_PROVIDER` (gtag/umami/plausible; cloudflare y none = no-op).
- `Layout.astro` slots default; props `{ title, description }`; `<html lang="es-CL" class="no-js">` + script inline que quita `no-js`.
- global.css: custom properties del mapa hex→token (spec §1), keyframes `rise fadein slide14 glow travel kb` bajo `prefers-reduced-motion: no-preference`, utilidades `.container` (1280/48), `.eyebrow`, `.btn`, `.btn-outline`, focus-visible, estilos base.

- [ ] Step 1: escribir todos los archivos. `Analytics.astro`: `is:inline` scripts con `define:vars`, `defer`, un bloque por proveedor.
- [ ] Step 2: `robots.txt.ts` GET → `Sitemap: ${site}/sitemap-index.xml`.
- [ ] Step 3: `npm run build` (node) pasa y `dist/` contiene HTML estático. Commit.

### Task 3: Capa de datos dual

**Files:** Create `db/schema.mysql.sql`, `db/schema.d1.sql` (verbatim spec §3), `src/lib/db/types.ts`, `src/lib/db/db.mysql.ts`, `src/lib/db/db.d1.ts`, `src/lib/db/index.ts`.

**Interfaces (produce):**

```ts
// types.ts
export interface NuevoContacto { nombre: string; email: string; telefono?: string | null;
  empresa?: string | null; tamano_empresa?: string | null; servicio?: string | null;
  mensaje: string; origen?: string | null; ip_hash?: string | null; user_agent?: string | null }
export type DbEnv = Record<string, unknown>;
// cada driver exporta:
export async function saveContacto(env: DbEnv, c: NuevoContacto): Promise<void>
export async function countRecentByIpHash(env: DbEnv, ipHash: string, windowSec: number): Promise<number>
// index.ts re-exporta desde '@driver/db'
```

- [ ] Step 1: `db.mysql.ts` — `let pool: Pool | undefined` module-singleton; `mysql2/promise` import estático (el alias garantiza que solo entra al bundle node); INSERT parametrizado; count con `created_at > NOW() - INTERVAL ? SECOND`.
- [ ] Step 2: `db.d1.ts` — `env.DB` binding tipado local (`interface D1Like { prepare(q: string): ... }`, sin dependencia de tipos globales); count con `datetime('now', ?)` y `-Ns seconds`.
- [ ] Step 3: `npx astro check` limpio. Commit.

### Task 4: env, ip, validación, captcha, correo

**Files:** Create `src/lib/env.ts`, `src/lib/ip.ts`, `src/lib/schema.ts`, `src/lib/captcha.ts`, `src/lib/mail/types.ts`, `src/lib/mail/smtp.real.ts`, `src/lib/mail/smtp.stub.ts`, `src/lib/mail/index.ts`.

**Interfaces (produce):**

```ts
// env.ts
export type Env = Record<string, string | undefined> & Record<string, unknown>;
export function getEnv(locals: App.Locals): Env   // locals.runtime?.env ?? process.env
// ip.ts
export function getClientIp(request: Request, fallback?: () => string | undefined): string | undefined
export async function sha256Hex(input: string): Promise<string>   // Web Crypto
// schema.ts
export const TAMANOS = ['1-10','11-50','51-200','+200'] as const;
export const SERVICIOS = ['Capacitación en IA','Consultoría de IA','Automatización de procesos','Consultoría tecnológica','Calidad y DevOps','Piloto o solución personalizada','Otro'] as const;
export const LIMITES = { nombre: [2,120], email: 180, telefono: 40, empresa: 160, mensaje: [10,5000] };
export const contactoSchema: z.ZodSchema<…>
export type ErrorCode = 'nombre'|'email'|'mensaje'|'invalido'|'captcha'|'limite'|'servidor';
export function firstErrorCode(e: z.ZodError): ErrorCode
// captcha.ts
export async function verifyCaptcha(env: Env, token: string | null, ip?: string): Promise<boolean>
// mail/index.ts
export async function sendContactoMail(env: Env, c: NuevoContacto): Promise<void>  // provider router; 'none'/ausente = no-op
// smtp.real.ts / smtp.stub.ts
export async function sendSmtp(env: Env, msg: { from: string; to: string; subject: string; text: string; replyTo?: string }): Promise<void>
```

- [ ] Step 1: escribir módulos. Turnstile → `https://challenges.cloudflare.com/turnstile/v0/siteverify`; reCAPTCHA → `https://www.google.com/recaptcha/api/siteverify`; sin provider → `true`.
- [ ] Step 2: `smtp.stub.ts` lanza `Error('SMTP no disponible en target cloudflare; usa MAIL_PROVIDER=resend')`.
- [ ] Step 3: `npx astro check` limpio. Commit.

### Task 5: Endpoint `POST /api/contacto`

**Files:** Create `src/pages/api/contacto.ts`.

**Interfaces (consume):** todo lo de Tasks 3–4. **Produce:** contrato HTTP del spec §5 (303 `/gracias` | `/?e=<code>#contacto`; JSON `{ok}`/`{ok:false,error}` con `Accept: application/json`).

- [ ] Step 1: pipeline exacto: honeypot `sitio_web` → time-trap `_ts` (solo si presente: <3000ms o >24h ⇒ éxito falso) → Zod → captcha → rate limit (`countRecentByIpHash`; fallo de DB en el count ⇒ continuar, log) → `saveContacto` (fallo ⇒ `servidor`) → `sendContactoMail` en try/catch (log-only) → respuesta.
- [ ] Step 2: `origen` = `utm_source` del Referer o host; `user_agent` truncado a 255; `ip_hash` = `sha256Hex(ip + IP_HASH_SALT)` si hay IP.
- [ ] Step 3: build node + `astro check`. Commit. (E2E en Task 10.)

### Task 6: Port visual completo

**Files:** Modify `src/pages/index.astro` (7 secciones del mockup), Create `src/components/ContactForm.astro`, `src/scripts/form.ts`, `src/scripts/enhance.ts`, Modify `src/pages/404.astro`, Create `src/pages/gracias.astro`.

**Interfaces (consume):** tokens de Task 2, `TAMANOS`/`SERVICIOS`/`LIMITES` de Task 4 (radios y atributos HTML). **Produce:** ids `#top #proceso #servicios #automatizacion #contacto`; form fields `nombre empresa email telefono mensaje tamano_empresa servicio sitio_web _ts`; data-attrs para scripts: `data-timeline`, `data-tabs`, `data-form`.

- [ ] Step 1: portar nav + hero + proceso + servicios + automatización + contacto + footer desde el mockup, con `<Image>` para hero/logo (dimensiones explícitas, `loading="eager"`/`fetchpriority="high"` en hero, `alt` del mockup). Contenido de steps/servicios prerenderizado (los 5 paneles/etapas en HTML; estado activo por clase).
- [ ] Step 2: `ContactForm.astro` — un form real, 3 fieldsets, radios estilizados `:checked`, inputs subrayados, mensajes de error por código (visibles vía `?e=` renderizado… la página es estática ⇒ error visible con CSS `:target` sobre `#contacto` + bloque `<noscript>`-friendly: anclas `#e-nombre` etc. y JS que lee `?e=`), progreso "Paso N de 3", nav Atrás/Continuar oculto en `.no-js`.
- [ ] Step 3: `enhance.ts` — timeline auto-avance 2600ms + click (para interval), tabs hover/click, nav links con `data-tab` que activan tab y scrollean. `form.ts` — wizard + fetch JSON + estado sent + `track('contacto_enviado')` + reset captcha.
- [ ] Step 4: `gracias.astro` — estado "sent" del mockup + `track('contacto_enviado')` on load; `404.astro` con la misma piel.
- [ ] Step 5: `npm run build` + `node dist/server/entry.mjs` + curls: HTML contiene los 5 servicios, form completo, honeypot, sin `sitio_web` visible (offscreen). Commit.

### Task 7: `npm run setup`

**Files:** Create `scripts/setup.mjs`, `public/.assetsignore` (`_worker.js`, `_routes.json`).

**Contrato:** flags `--target=node|cloudflare --yes --dry-run --no-db --push-secrets --help`. Flujo: cargar `.env` existente como defaults → preguntar target/DB/correo/analítica/captcha/SEO → validar (MySQL ping, Resend `GET /domains`, URL absoluta, wrangler presente y autenticado) → escribir `.env` (merge conservador + `.env.bak` si cambia y confirma), `.dev.vars` + `wrangler.jsonc` (binding DB, `compatibility_date` = hoy, `nodejs_compat`) si CF → crear D1 si falta (`wrangler d1 create`, capturar `database_id` de `d1 list --json`) → aplicar schema (`--local` y `--remote` | mysql `multipleStatements`) → ofrecer `wrangler secret put` (solo no-PUBLIC) → resumen con pasos manuales. Genera `IP_HASH_SALT` aleatorio si falta. `chmod 600 .env`.

- [ ] Step 1: implementar con `node:readline/promises` + `parseArgs` de `node:util`; helpers `loadEnvFile/serializeEnv/writeFileSafe(dryRun)`.
- [ ] Step 2: verificar: `node scripts/setup.mjs --help` · `--target=node --yes --dry-run --no-db` (sin tocar disco) · `--target=node --yes --no-db` dos veces ⇒ segundo run sin diff (`git status` + hash de `.env`). Commit.

### Task 8: Migración PHP

**Files:** Create `scripts/migrate-php.mjs`.

**Contrato:** flags `--source-table=<t> --map=viejo:nuevo,... --limit --dry-run --out=db/migracion-d1.sql`. Lee credenciales MySQL viejas de `.env` (`OLD_MYSQL_*` con fallback a `MYSQL_*`). Si la tabla no existe → mensaje y `exit 0`. Target node: INSERT directo por lotes. Target cloudflare: emite `.sql` escapado para `wrangler d1 execute --file`.

- [ ] Step 1: implementar; escapado SQL manual solo para el export (comillas simples dobladas, NULL).
- [ ] Step 2: `node scripts/migrate-php.mjs --help` OK; sin MySQL accesible → error claro de conexión (no stack trace crudo). Commit.

### Task 9: Deploy artifacts + README

**Files:** Create `deploy/nexera.service`, `deploy/nginx.conf`, `Dockerfile`, `.dockerignore`, `.github/workflows/deploy-vps.yml`, `.github/workflows/deploy-cloudflare.yml`, `README.md`.

- [ ] Step 1: systemd (`HOST=127.0.0.1`, `PORT`, `EnvironmentFile=/opt/nexera/.env`, `Restart=always`, user dedicado); nginx reverse proxy con `X-Forwarded-For`/`-Proto` + assets `_astro` inmutables; Dockerfile multi-stage non-root.
- [ ] Step 2: workflows gateados por `vars.DEPLOY_TARGET`; VPS: build + rsync + `npm ci --omit=dev` + restart; CF: build + `wrangler deploy` con `CLOUDFLARE_API_TOKEN`.
- [ ] Step 3: README completo (cero→prod ambos caminos, consultar leads, migración, decisiones de diseño, troubleshooting). Commit.

### Task 10: Verificación dual E2E

- [ ] Build node + build CF + `astro check` en ambos targets.
- [ ] Greps: `mysql2|nodemailer` ausentes en `dist/_worker.js/`; `runtime.env` ausente en bundle node; secretos (`CAPTCHA_SECRET`, valores de `.env`) ausentes en `dist/**/*.{js,html}` del cliente.
- [ ] E2E CF: `wrangler d1 execute --local --file=db/schema.d1.sql` + `wrangler dev` → `POST /api/contacto` (con `Origin`) → 303 `/gracias` → fila en D1 local con empresa/tamano/servicio. Honeypot → 303 sin fila. Email inválido → 303 `/?e=email#contacto`. JSON path → `{ok:true}`.
- [ ] E2E node: server standalone sin DB configurada → honeypot 303 éxito falso; validación 303 `?e=`; submit válido → 303 `?e=servidor` (graceful). Si Docker disponible: MySQL real → fila guardada.
- [ ] `/` estático (no ejecuta servidor), formulario presente sin JS, radios `:checked` estilizados.
- [ ] Lighthouse ≥95×4 si hay Chrome; si no, verificación proxy (peso página, fonts self-hosted, dimensiones de imagen, meta) y decirlo honestamente.
- [ ] Commit final + finishing-a-development-branch.

## Self-Review del plan

1. **Cobertura del spec:** trampas 1-3 (T1/T3/T4) · setup 10 pasos (T7) · form no-JS (T5/T6) · schema dual + extensión (T3) · anti-spam 4 capas (T5) · analítica intercambiable + conversión (T2/T6) · SEO/JSON-LD/sitemap/robots (T2) · deploy dual + workflows + README (T9) · migración PHP (T8) · criterios de aceptación (T10). Sin huecos.
2. **Placeholders:** ninguno — cada task nombra archivos, firmas y comandos exactos; el markup visual referencia su fuente de verdad en-repo.
3. **Consistencia de tipos:** `NuevoContacto`/`Env`/`ErrorCode`/`sendSmtp`/`saveContacto` idénticos entre T3-T5; `TAMANOS/SERVICIOS/LIMITES` definidos en T4 y consumidos en T6.
