# Nexera Landing — Design Spec

**Fecha:** 2026-07-30 · **Estado:** aprobado por Roberto (schema extendido + diseño completo)

## Objetivo

Landing de Nexera en Astro 7 que porta fielmente el mockup `Nexera Landing.dc.html`
(Claude Design, proyecto `a2a37776`) y soporta **dos destinos de deploy desde el mismo
código**: VPS (Node + MySQL) o Cloudflare (Workers + D1), elegidos por configuración
(`npm run setup`), nunca reescribiendo código. Migra una landing PHP+MySQL existente.

## Alcance

- Página única `/` (prerenderizada) + `/gracias` + `/404` + `robots.txt` + sitemap.
- Un solo endpoint SSR: `POST /api/contacto` (`prerender = false`).
- Script `npm run setup` interactivo/CI, idempotente, con `--dry-run`.
- Script `npm run migrate:php` para copiar la tabla PHP antigua.
- Deploy: systemd + nginx + Dockerfile (VPS) · `wrangler deploy` (Cloudflare) · 2 workflows GH Actions.

Fuera de alcance: panel de administración, i18n, modo claro, `Nexera 3 Direcciones.dc.html`.

## 1 · Diseño visual (fuente: markup raw del mockup)

### Mapa hex → token (CSS custom properties en `src/styles/global.css`)

| Token | Valor | Uso en mockup |
|---|---|---|
| `--bg` | `#080D16` | fondo base, panel servicio activo |
| `--bg-alt` | `#0B1420` | secciones servicios/contacto |
| `--bg-panel` | `#0A111C` | panel "Desafíos" |
| `--bg-node` | `#0E1725` | nodos idle timeline/diagrama |
| `--accent` | `#45C7FF` | acento principal (CTAs, eyebrows, líneas) |
| `--accent-2` | `#C86BFF` | fin del gradiente del wordmark |
| `--on-accent` | `#04121C` | texto sobre CTA cyan |
| `--text-hi` | `#EAF1F8` | headings |
| `--text-body` | `#93A4B8` | cuerpo estándar (también `#9FB6CC` hero sub) |
| `--text-body-2` | `#9FB6CC` | subtítulo hero |
| `--text-dim` | `#8FA0B4` | descripciones nodos, chips |
| `--text-dim-2` | `#8494A8` | lista desafíos, pick-buttons idle |
| `--text-mute` | `#54677E` | labels muted, números idle |
| `--text-mute-2` | `#4E5F74` | placeholders, bottom bar |
| `--text-soft` | `#7E8FA3` | títulos idle timeline, footer copy |
| `--text-warm` | `#8B6B6B` | label "Desafíos" |
| `--text-onlist` | `#C6D4E2` | lista "Qué hacemos" |
| `--text-picked` | `#DCEEFB` | pick-button seleccionado |
| `--link-hover` | `#8FDBFF` | hover de links |
| `--border` | `rgba(255,255,255,.08)` | bordes (variantes .07–.22 conservadas literal) |

Reglas: bordes/tintes con alfa (`rgba(69,199,255,.X)`, `rgba(255,255,255,.X)`) se conservan
literales del mockup. Radios: botones 3px, chips 2px, pill 99px. Contenedor 1280px,
padding lateral 48px (mobile: reducir a 20–24px, ver §1.4).

### Tipografía (self-hosted vía `@fontsource`, subset latin, woff2)

- **Archivo** 500/600/700/800 — headings, wordmark (`letter-spacing` negativos exactos del mockup).
- **IBM Plex Sans** 400/500/600 — cuerpo.
- **IBM Plex Mono** 400/500/600 — eyebrows, botones, labels, footer meta.

Dependencias justificadas: `@fontsource/archivo`, `@fontsource/ibm-plex-sans`,
`@fontsource/ibm-plex-mono` (elimina Google Fonts: sin third-party, sin FOUT/CLS).

### Secciones (medidas exactas del mockup)

1. **Nav sticky** — `rgba(10,17,28,.92)` + `backdrop-filter:blur(10px)`, borde inferior,
   wordmark NEXERA 17px/800 gradiente 90deg accent→accent-2; links 13px; CTA "Contacto"
   cyan 10×18px r3; línea viajera (`travel` 4.5s) en el borde inferior.
2. **Hero** `#top` — `<Image>` hero a la derecha (`width:64%;object-fit:cover`, Ken Burns
   `kb` 26s alternate), overlay `linear-gradient(90deg,#080D16 0/34%, .72 58%, .35 100%)`;
   logo 188px; eyebrow mono 11px `.18em`; H1 Archivo 800 56px/1.03 `-.035em`; sub 16.5px/1.65
   `#9FB6CC` max 34em; CTAs "Conversemos →" (cyan) y "Conoce nuestros servicios" (outline
   `rgba(255,255,255,.22)`); diagrama 3 nodos (IA / Capacitación / Boutique) con líneas
   punteadas animadas (`slide14`), primer nodo activo con halo `0 0 0 5px rgba(69,199,255,.14)`.
3. **Proceso** `#proceso` — eyebrow "Cómo trabajamos"; H2 42px; timeline 5 nodos
   (ancho fijo 140px por nodo, líneas punteadas entre ellos); panel detalle con borde
   `rgba(69,199,255,.28)` y gradiente vertical `.07→0`; "Etapa {NN} de 05". Auto-avance
   cada 2.6 s (para al interactuar), clickeable. Etapas: 01 Entendemos · 02 Priorizamos ·
   03 Diseñamos e implementamos · 04 Acompañamos · 05 Evolucionamos (copys exactos del mockup).
4. **Servicios** `#servicios` (bg alt) — grid `400px 1fr` gap 40; 5 tabs activables por
   hover/click (activo: `rgba(69,199,255,.1)` + border-left 2px accent; idle: border-left
   `rgba(255,255,255,.09)`); panel derecho con título 29px, descripción, separador punteado,
   chips (borde `.14`, mono 12px), CTA outline "Conversemos →". Nota derecha:
   "↑ pasa el cursor por la lista". Contenido exacto (5 servicios + chips) del script del mockup.
5. **Automatización** `#automatizacion` — grid `1fr 84px 1fr`; panel "Desafíos" (3 ítems con
   guión mono) vs "Qué hacemos" (3 ítems con `+` accent y `<strong>`); flecha circular 38px
   sobre línea punteada animada.
6. **Contacto** `#contacto` (bg alt) — grid `1fr 1fr` gap 56. Izquierda: eyebrow, H2 36px,
   copy, y datos: `contacto@nexera.cl`, WhatsApp `wa.me/56954009251`, "Santiago, Chile ·
   Atención directa" (desde config del sitio, defaults = valores del mockup). Derecha:
   **formulario wizard** (ver §2).
7. **Footer** — línea viajera superior (6s); grid `1.3fr 1fr 1fr 1fr`; brand + copy + pill
   "Atención directa" (glow 2.2s); columnas Servicios / Nexera / Contacto; bottom bar
   "© 2026 Nexera" / "Santiago, Chile · Atención directa".

### Animaciones y responsive

Keyframes portados 1:1: `rise`, `fadein`, `slide14`, `glow`, `travel`, `kb`. Todo se
envuelve en `@media (prefers-reduced-motion: no-preference)`. El mockup es desktop
(1280px); breakpoints añadidos: ≤1024px (grids a 1 columna, nav colapsa links secundarios),
≤640px (H1 36px, padding 20px, timeline vertical u horizontal con scroll). El hero pasa a
imagen de fondo completa con overlay más denso en mobile.

### Assets

- `src/assets/nexera-hero.png` (1720×1640) y `src/assets/nexera-logo.png` (544×377),
  descargados del proyecto de diseño. Servidos vía `astro:assets` (`<Image>`, dimensiones
  explícitas, formatos modernos). OG image por defecto derivada del hero en build.

## 2 · Formulario: wizard fiel + sin JavaScript

**Un solo `<form method="POST" action="/api/contacto">`** con tres `<fieldset data-step>`:

1. "Tamaño aproximado de la empresa" — radios `tamano_empresa`: `1-10`, `11-50`, `51-200`, `+200`,
   estilizados como pick-buttons del mockup vía `:checked` (funciona sin JS). Opcional.
2. "Servicio de interés" — radios `servicio`: Capacitación en IA · Consultoría de IA ·
   Automatización de procesos · Consultoría tecnológica · Calidad y DevOps ·
   Piloto o solución personalizada · Otro. Opcional.
3. "Tus datos y el desafío" — inputs subrayados (border-bottom, focus accent): `nombre`*,
   `empresa`, `email`*, `telefono`, `mensaje`* (textarea). Límites HTML = límites Zod.

**Con JS** (`src/scripts/form.ts`): fieldsets de a uno, barra de progreso "Paso N de 3" +
porcentaje (width transition .5s), botones "← Atrás" / "Continuar →" / "Enviar consulta →",
submit por `fetch` con `Accept: application/json`, éxito inline = estado "sent" del mockup
(círculo ✓ 40px + mensaje). Dispara `track('contacto_enviado')`.

**Sin JS**: los tres fieldsets se muestran apilados (mismos estilos), botones de navegación
ocultos (`html.no-js`), submit nativo → `303 /gracias`. `/gracias` reproduce el estado "sent"
del mockup y dispara la conversión. Errores: `303` de vuelta a `/?e=<código>#contacto` con
mensajes visibles vía CSS `:target`/query — códigos: `nombre`, `email`, `mensaje`, `invalido`,
`captcha`, `limite`, `servidor`.

Honeypot: input `sitio_web` posicionado fuera de pantalla + `tabindex="-1"` +
`autocomplete="off"`. Time-trap: hidden `_ts` puesto por JS al cargar; **solo se valida si
viene presente** (sin JS no bloquea; el spam sin JS lo cubren honeypot/rate-limit/captcha).

Tabs de servicios y timeline degradan sin JS: clase `no-js` en `<html>` (removida por script
inline) muestra todos los paneles apilados / timeline estática con nodo 1 activo.

## 3 · Datos

Extensión aprobada del schema del spec: columnas nullable `empresa`, `tamano_empresa`,
`servicio` (capturadas por el wizard).

```sql
-- db/schema.mysql.sql
CREATE TABLE IF NOT EXISTS contactos (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(120)  NOT NULL,
  email          VARCHAR(180)  NOT NULL,
  telefono       VARCHAR(40)   NULL,
  empresa        VARCHAR(160)  NULL,
  tamano_empresa VARCHAR(20)   NULL,
  servicio       VARCHAR(80)   NULL,
  mensaje        TEXT          NOT NULL,
  origen         VARCHAR(120)  NULL,
  ip_hash        CHAR(64)      NULL,
  user_agent     VARCHAR(255)  NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_email (email),
  INDEX idx_iphash_created (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

```sql
-- db/schema.d1.sql (misma forma lógica, dialecto SQLite)
CREATE TABLE IF NOT EXISTS contactos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL,
  email          TEXT NOT NULL,
  telefono       TEXT,
  empresa        TEXT,
  tamano_empresa TEXT,
  servicio       TEXT,
  mensaje        TEXT NOT NULL,
  origen         TEXT,
  ip_hash        TEXT,
  user_agent     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_created ON contactos (created_at);
CREATE INDEX IF NOT EXISTS idx_email ON contactos (email);
CREATE INDEX IF NOT EXISTS idx_iphash_created ON contactos (ip_hash, created_at);
```

Zod (`src/lib/schema.ts`): `nombre` 2–120 · `email` ≤180 válido · `telefono` opcional ≤40
patrón laxo · `empresa` opcional ≤160 · `tamano_empresa` enum opcional
`{1-10, 11-50, 51-200, +200}` · `servicio` enum opcional (7 valores del mockup) ·
`mensaje` 10–5000. Mismos límites en atributos HTML.

## 4 · Arquitectura de portabilidad

### Trampa 1 — bundle limpio por target

Alias de Vite en `astro.config.mjs` según `DEPLOY_TARGET`:

- `@driver/db` → `src/lib/db/db.mysql.ts` (node) | `src/lib/db/db.d1.ts` (cloudflare)
- `@driver/smtp` → `src/lib/mail/smtp.real.ts` (node) | `src/lib/mail/smtp.stub.ts` (cloudflare)

El módulo descartado nunca se resuelve → nunca se bundlea. `tsconfig.json` apunta los paths
a la variante mysql/real para el chequeo de tipos; ambas variantes implementan la misma
interfaz exportada por `src/lib/db/types.ts` y `src/lib/mail/types.ts`.

- Interfaz DB: `saveContacto(env, c: NuevoContacto): Promise<void>` ·
  `countRecentByIpHash(env, ipHash: string, windowSec: number): Promise<number>`.
  MySQL: pool `mysql2/promise` singleton module-level. D1: binding `env.DB`, statements preparados.
- Interfaz mail: `sendMail(env, msg): Promise<void>`. Router `src/lib/mail/index.ts` por
  `MAIL_PROVIDER`: `resend` (fetch API, ambos targets) · `smtp` (`@driver/smtp`) · `none`/ausente.
  El stub lanza error descriptivo si se configura `smtp` en target cloudflare (y el setup no lo ofrece).

### Trampa 2 — entorno unificado

`src/lib/env.ts`: `getEnv(locals): Record<string, unknown>` usa un alias target-aware:
`env` de `cloudflare:workers` en Workers y `process.env` en Node. Astro 7 eliminó
`locals.runtime.env`. Nada más toca env de servidor. `PUBLIC_*` solo vía
`import.meta.env` (inline de Vite, idéntico en ambos).

### Trampa 3 — dos dialectos SQL

Schemas gemelos (§3) + fachada `saveContacto`/`countRecentByIpHash`. Rate limit cuenta filas
recientes por `ip_hash` en la propia tabla (sin dependencia extra): MySQL
`created_at > NOW() - INTERVAL ? SECOND`; D1 `created_at > datetime('now', ?)`.

## 5 · Endpoint `POST /api/contacto`

Pipeline: honeypot (→ éxito falso) → time-trap (solo si `_ts` presente; <3s → éxito falso) →
Zod → captcha (si configurado; Turnstile `siteverify` / reCAPTCHA) → rate limit
(`RATE_LIMIT_MAX` por `RATE_LIMIT_WINDOW` seg, default 5/3600; fallo → `limite`) →
`saveContacto` → correo (fallo solo se loguea) → respuesta.

- IP: `CF-Connecting-IP` → primer valor de `X-Forwarded-For` → `clientAddress`;
  `ip_hash = SHA-256(ip + IP_HASH_SALT)` (Web Crypto, portable).
- `origen`: `utm_source` del Referer o el host del Referer.
- Respuesta HTML: `303 /gracias` | `303 /?e=<código>#contacto`. Respuesta JSON
  (si `Accept: application/json`): `{ ok: true }` | `{ ok: false, error: <código> }` con status 200/400/429/500.
- CSRF: `security.checkOrigin` de Astro activo (default). Tests con curl deben mandar `Origin`.

## 6 · Analítica y SEO

- `<Analytics/>` en el layout lee `PUBLIC_ANALYTICS_PROVIDER`: `ga4` (gtag + `PUBLIC_ANALYTICS_ID`) ·
  `umami` / `plausible` (`PUBLIC_ANALYTICS_ID` + `PUBLIC_ANALYTICS_SRC` para self-hosted) ·
  `cloudflare` (beacon token) · `none`/ausente → nada. Scripts `defer`.
- `src/scripts/track.ts`: `track(evento)` — switch único por proveedor; agregar proveedor nuevo
  = un caso aquí + un caso en `<Analytics/>`.
- `<Seo/>`: title/description/canonical/OG/Twitter, `lang="es-CL"`, OG image absoluta.
- JSON-LD `LocalBusiness` (u `Organization` si no hay dirección) desde `src/config/site.ts`
  (valores desde `PUBLIC_*`; defaults del mockup: contacto@nexera.cl, +56 9 5400 9251,
  Santiago, Chile).
- `@astrojs/sitemap` + `src/pages/robots.txt.ts` apuntando al sitemap; `site` desde `PUBLIC_SITE_URL`.

## 7 · Setup, deploy y migración

Según el spec del proyecto, sin cambios: `scripts/setup.mjs` (readline/promises, idempotente,
`--dry-run`, `--target=<t> --yes`, valida MySQL/Resend/URLs, escribe `.env` [+`.env.bak`],
`.dev.vars` + `wrangler.jsonc` (+ `public/.assetsignore`) en cloudflare, crea D1 y captura
`database_id`, aplica schema local+remote, ofrece `wrangler secret put`, resumen final).
`scripts/migrate-php.mjs` (`--dry-run`, mapeo de columnas, export `.sql` para D1, sale limpio
si no existe la tabla). Deploy: `deploy/nexera.service`, `deploy/nginx.conf`, `Dockerfile`,
`.github/workflows/deploy-vps.yml` + `deploy-cloudflare.yml` activados por variable de repo.

## 8 · Criterios de aceptación

Los 8 del spec del proyecto, verbatim, más:

9. La página reproduce las 7 secciones del mockup con sus tokens, tipografías, copys y
   animaciones; wizard de 3 pasos con JS y formulario completo apilado sin JS.
10. `empresa`, `tamano_empresa` y `servicio` se persisten en ambos motores.
