# Nexera

Landing en Astro 7 con formulario, base de datos, correo, analítica y dos destinos de producción desde el mismo código.

## Empieza aquí

### 1. Elige el destino

| Destino | Elígelo si… | Runtime y datos |
|---|---|---|
| **VPS / Node.js** | Ya tienes un VPS o quieres control total del servidor | Node.js 22 + MySQL 8 |
| **Cloudflare** | Prefieres una operación serverless sin administrar Linux | Workers + D1 |

No hay dos ramas ni dos aplicaciones. `DEPLOY_TARGET` selecciona el adapter, la base de datos y el correo al construir.

### 2. Instala las dependencias

```bash
git clone <URL_DEL_REPOSITORIO> nexera
cd nexera
npm ci
```

El repositorio versiona `package-lock.json`, por eso los ejemplos usan npm y `npm ci` es la instalación reproducible. Si ya instalaste las dependencias con pnpm, ejecuta el asistente de forma explícita con `pnpm run setup`.

Requisitos:

- Node.js 22.12 o posterior.
- VPS: Linux con systemd, Nginx y MySQL 8.
- Cloudflare: cuenta con Workers y D1; ejecuta `npx wrangler login` antes del setup.

### 3. Revisa el plan sin cambiar nada

```bash
npm run setup -- --dry-run
```

El modo simulación no escribe archivos, no crea bases y no usa la red. El asistente muestra cinco etapas, oculta contraseñas y termina con un resumen.

### 4. Aplica la configuración

```bash
npm run setup
```

El asistente pregunta:

1. Destino: VPS/Node o Cloudflare.
2. URL, marca y datos públicos del negocio.
3. Analítica, captcha y correo. Los tres pueden quedar desactivados.
4. MySQL o D1, según el destino.
5. Confirmación final antes de escribir o ejecutar comandos externos.

Solo la base de datos es obligatoria para recibir leads. Sin correo, captcha ni analítica, el formulario guarda y responde normalmente.

Antes de ejecutar el setup:

- **Node:** crea la base y el usuario MySQL. El asistente valida la conexión y crea la tabla `contactos`.
- **Cloudflare:** autentica Wrangler. El asistente crea o reutiliza D1, añade el binding `DB` y aplica el esquema.

Si `.env` ya existe, nada se escribe hasta la confirmación final y cualquier reemplazo deja `.env.bak`. Repetir el setup con las mismas respuestas no cambia el estado.

### 5. Prueba localmente

Node + MySQL:

```bash
npm run dev
```

Cloudflare + D1:

```bash
npm run dev:cf
```

Abre `http://localhost:4321`, envía el formulario y confirma el lead con las consultas de [Consultar leads](#consultar-leads).

### 6. Despliega

Escoge una ruta:

| Ruta | Qué administra | Cuándo usarla |
|---|---|---|
| [VPS con systemd + Nginx](#producción-en-vps-node--mysql) | Proceso Node, TLS y reverse proxy | Recomendado si ya tienes VPS/MySQL |
| [Docker en VPS](#docker-en-vps) | Contenedor Node; Nginx sigue delante | Si tu servidor ya opera con contenedores |
| [Cloudflare Workers + D1](#producción-en-cloudflare-workers--d1) | Worker, D1, dominio y TLS | Si no quieres administrar servidor |
| [GitHub Actions](#automatizar-despliegues-con-github-actions) | Automatiza una de las rutas anteriores | Después de validar el primer deploy manual |

GitHub Actions no es un cuarto destino: automatiza VPS o Cloudflare según la variable de repositorio `DEPLOY_TARGET`.

## Qué genera `npm run setup`

| Destino | Archivos | Acciones |
|---|---|---|
| Node | `.env` y, si cambia, `.env.bak` | Valida MySQL, aplica `db/schema.mysql.sql` y valida Resend si se usa |
| Cloudflare | `.env`, `.dev.vars`, `wrangler.jsonc` y posible `.env.bak` | Crea/reutiliza D1, aplica `db/schema.d1.sql` local y remoto, y puede publicar secretos |

Wrangler no lee `.env` durante el desarrollo local. Por eso el target Cloudflare genera también `.dev.vars`.

Flags útiles:

| Flag | Uso |
|---|---|
| `--target=node` / `--target=cloudflare` | Preselecciona el destino |
| `--dry-run` | Muestra el plan sin escribir ni usar la red |
| `--no-db` | Omite validación, creación y esquema de la base |
| `--yes` | Usa valores existentes sin preguntas; pensado para CI |
| `--push-secrets` | Publica secretos con Wrangler; solo Cloudflare |

Usa `NO_COLOR=1 npm run setup` si la terminal no admite colores. Consulta todas las opciones con `npm run setup -- --help`.

Si `stdin` o `stdout` no son una terminal (CI, cron, tuberías o redirección), `--yes` es obligatorio. El script falla con código distinto de cero en vez de aparentar éxito con respuestas incompletas.

## Configuración y secretos

`.env.example` es el inventario completo. El setup conserva claves desconocidas y genera `IP_HASH_SALT` cuando falta. `.env`, `.env.bak` y `.dev.vars` están ignorados por Git: nunca los subas.

- `PUBLIC_*`: Vite las incrusta durante el build. Son visibles en el navegador; un cambio exige otro deploy.
- Secretos de servidor (`CAPTCHA_SECRET`, `IP_HASH_SALT`, MySQL, Resend o SMTP): viven en `/opt/nexera/.env` para Node o como secretos del Worker para Cloudflare.
- `HOST` y `PORT`: solo afectan a Node. systemd fuerza `HOST=127.0.0.1`; Nginx es la entrada pública.

No pongas contraseñas, tokens ni salts bajo un nombre `PUBLIC_*`.

## Producción en VPS: Node + MySQL

Recorrido recomendado: prepara MySQL, ejecuta el setup en el VPS, construye `dist/`, instala systemd/Nginx y recién después activa CI. Docker reemplaza systemd, no se usa encima de él.

### 1. Prepara MySQL

En MySQL 8, crea la base y un usuario con contraseña generada por el propio servidor:

```sql
CREATE DATABASE nexera CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nexera'@'127.0.0.1' IDENTIFIED BY RANDOM PASSWORD;
GRANT SELECT, INSERT ON nexera.* TO 'nexera'@'127.0.0.1';
```

Guarda la contraseña devuelta en un gestor de secretos. Para el primer setup tienes dos opciones:

- Concede temporalmente `CREATE` e `INDEX`, ejecuta el setup y revoca esos permisos al terminar.
- Aplica el esquema con un usuario administrador y ejecuta el setup con `--no-db`.

```sql
GRANT CREATE, INDEX ON nexera.* TO 'nexera'@'127.0.0.1';
-- Después del setup:
REVOKE CREATE, INDEX ON nexera.* FROM 'nexera'@'127.0.0.1';
```

```bash
# Alternativa con usuario administrador:
sudo mysql nexera < db/schema.mysql.sql
npm run setup -- --target=node --no-db
```

En operación normal, el usuario de la app solo necesita `SELECT` e `INSERT`. Si usaste los permisos temporales, ejecuta `npm run setup -- --target=node`; el asistente validará MySQL y aplicará `db/schema.mysql.sql`.

Después de revocar esos permisos, usa `--no-db` para cambiar solo la configuración. Para una migración futura, aplica el SQL como administrador o concede los permisos de forma temporal.

### 2. Crea usuarios y permisos

Usa una cuenta sin login para el proceso y una cuenta SSH separada para CI:

```bash
sudo useradd --system --home-dir /opt/nexera --shell /usr/sbin/nologin nexera
sudo adduser deploy
sudo usermod --append --groups nexera deploy
sudo install --directory --owner=nexera --group=nexera --mode=2775 /opt/nexera
sudo install --owner=nexera --group=nexera --mode=0640 .env /opt/nexera/.env
```

Permite a `deploy` reiniciar solo esta unidad mediante `/etc/sudoers.d/nexera-deploy`:

```text
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart nexera
```

Configura la clave pública de CI en `~deploy/.ssh/authorized_keys`. No reutilices una clave personal.

### 3. Instala systemd y Nginx

Desde un checkout del repositorio en el servidor:

```bash
sudo install --mode=0644 deploy/nexera.service /etc/systemd/system/nexera.service
sudo install --mode=0644 deploy/nginx.conf /etc/nginx/sites-available/nexera
sudo ln -s /etc/nginx/sites-available/nexera /etc/nginx/sites-enabled/nexera
sudo systemctl daemon-reload
sudo systemctl enable nexera
sudo systemctl reload nginx
```

`deploy/nginx.conf` usa `nexera.cl` y `www.nexera.cl`. Si el dominio cambia, ajusta `server_name`, actualiza `PUBLIC_SITE_URL` y vuelve a construir. El proceso permanece ligado a `127.0.0.1`; Nginx es el único proxy confiable, conserva `Host`, fija los headers `X-Forwarded-*` y sobrescribe `X-Forwarded-For` con `$remote_addr` para evitar spoofing. Astro valida el host mediante `security.allowedDomains` antes de exponer esa IP como `ctx.clientAddress`. Nginx también limita el body a 64 KiB y da caché pública inmutable por un año a `/_astro/`.

Mantén `PUBLIC_SITE_URL` igual al origen HTTPS canónico. `astro.config.mjs` deriva de esa URL `security.allowedDomains`; junto con los headers `X-Forwarded-*`, permite que `checkOrigin` acepte el `POST /api/contacto` legítimo detrás de Nginx sin relajar la protección CSRF.

Crea registros DNS `A` y, si corresponde, `AAAA` hacia el VPS. Cuando resuelvan, emite el certificado TLS con el cliente ACME de tu distribución y fuerza HTTPS. No habilites HSTS antes de confirmar que todos los subdominios funcionan por HTTPS.

### 4. Construye y publica por primera vez

Desde el checkout configurado:

```bash
npm run build:node
sudo install --owner=nexera --group=nexera --mode=0644 \
  package.json package-lock.json /opt/nexera/
sudo rsync --archive --delete --chown=nexera:nexera dist/ /opt/nexera/dist/
sudo -u nexera npm --prefix /opt/nexera ci --omit=dev
sudo systemctl restart nexera
```

Comprueba el proceso antes de abrir el tráfico:

```bash
sudo systemctl status nexera
sudo journalctl --unit=nexera --lines=100 --no-pager
curl --fail http://127.0.0.1:4321/
```

Para un deploy manual posterior, repite el build, la copia de `dist/`, la instalación de dependencias y el restart. Nunca copies `.env` desde CI.

### 5. Automatiza los siguientes deploys

En GitHub, crea el environment `production` y configura:

- Variable **de repositorio** `DEPLOY_TARGET=node`; el gate se evalúa antes de acceder al environment.
- Variables públicas `PUBLIC_SITE_URL`, `PUBLIC_SITE_NAME`, `PUBLIC_BUSINESS_*`, `PUBLIC_ANALYTICS_*` y `PUBLIC_CAPTCHA_*`, en el repositorio o en `production`, con los mismos valores usados por setup.
- Secrets de `production`: `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY` y `VPS_KNOWN_HOSTS`.

Usa `deploy` como `VPS_USER`. Obtén `VPS_KNOWN_HOSTS` desde una sesión administrativa confiable y verifica la huella del servidor antes de guardarla; el workflow no acepta hosts desconocidos automáticamente.

Cada push a `main` ejecuta `.github/workflows/deploy-vps.yml` solo cuando la variable de repositorio vale `node`. El job construye con `npm run build:node`, sincroniza `dist/` y los manifiestos con rsync, ejecuta `npm ci --omit=dev` en `/opt/nexera` y reinicia `nexera`. La sincronización excluye `.env`.

## Docker en VPS

El Dockerfile es una alternativa al servicio Node directo, no una capa adicional. Construye una imagen multi-stage; la etapa final contiene solo dependencias de producción, ejecuta como el usuario no-root `node` y expone el puerto 4321.

Las variables públicas se fijan durante el build. Este ejemplo activa Turnstile sin exponer su secreto:

```bash
docker build --tag nexera:prod \
  --build-arg PUBLIC_SITE_URL=https://nexera.cl \
  --build-arg PUBLIC_CAPTCHA_PROVIDER=turnstile \
  --build-arg PUBLIC_CAPTCHA_SITE_KEY="$PUBLIC_CAPTCHA_SITE_KEY" \
  .
docker run --detach --name nexera --restart unless-stopped \
  --user "$(id -u nexera):$(id -g nexera)" \
  --mount type=bind,src=/opt/nexera/.env,dst=/run/secrets/nexera.env,readonly \
  --env HOST=0.0.0.0 --env PORT=4321 \
  --publish 127.0.0.1:4321:4321 \
  nexera:prod
```

Pasa solo valores `PUBLIC_*` como `--build-arg`: los argumentos quedan en metadatos del build. El `.env` generado por setup usa comillas compatibles con Node y systemd; `docker run --env-file` las conservaría literalmente. Por eso el ejemplo monta el archivo en modo de solo lectura y el `CMD` deja que Node 22 lo interprete con `--env-file-if-exists`. `HOST` y `PORT` se inyectan explícitamente y tienen precedencia. `--user` alinea el proceso no-root con el propietario de `/opt/nexera/.env`. Mantén Nginx y DNS como en el recorrido anterior, pero no habilites `nexera.service` si Docker administra el proceso.

## Producción en Cloudflare: Workers + D1

Recorrido recomendado: autentica Wrangler, ejecuta el setup, prueba con `npm run dev:cf`, despliega manualmente y recién después activa CI.

### 1. Crea y prepara D1

```bash
npx wrangler login
npm run setup -- --target=cloudflare
```

El asistente:

- Crea o reutiliza la base D1.
- Aplica `db/schema.d1.sql` local y remotamente.
- Genera `.dev.vars` para desarrollo.
- Genera `wrangler.jsonc` con el binding `DB`, assets, `nodejs_compat` y la fecha de compatibilidad.
- Ofrece publicar `IP_HASH_SALT`, `CAPTCHA_SECRET` y `RESEND_API_KEY` sin mostrarlos.

Revisa y versiona `wrangler.jsonc`: `database_id` no es una credencial. Nunca versiones `.dev.vars`.

Si omitiste los secretos durante el primer setup, publícalos desde los valores ya guardados:

```bash
npm run setup -- --target=cloudflare --yes --no-db --push-secrets
```

Para reaplicar solo el esquema remoto, usa el `database_name` de `wrangler.jsonc`:

```bash
npx wrangler d1 execute nexera --remote --file=db/schema.d1.sql
```

Cloudflare no admite `MAIL_PROVIDER=smtp`; usa `resend` o `none`.

### 2. Construye y despliega por primera vez

```bash
npm run build:cf
npm run deploy
```

Mantén este orden. Astro 7 genera en el build la configuración que Wrangler usa desde `dist/server`; desplegar un `dist/` de Node o un build antiguo publica el runtime equivocado.

Asocia el dominio desde **Workers & Pages → Nexera → Settings → Domains & Routes**. Cloudflare crea el DNS y el certificado administrado; no uses Nginx ni systemd en este target.

Comprueba la publicación:

```bash
curl --fail https://nexera.cl/
```

### 3. Automatiza los siguientes deploys

En GitHub, configura:

- Variable **de repositorio** `DEPLOY_TARGET=cloudflare`.
- Las variables públicas del build en el repositorio o en el environment `production`.
- Secrets de `production`: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

Limita el token a la cuenta y recursos necesarios para editar Workers. `.github/workflows/deploy-cloudflare.yml` se salta salvo que `DEPLOY_TARGET` valga exactamente `cloudflare`; cuando coincide, ejecuta `npm run build:cf` y `npm run deploy`. Los secretos de la aplicación permanecen en Cloudflare.

## Automatizar despliegues con GitHub Actions

El repositorio contiene dos workflows y solo se ejecuta el que coincide con la variable de repositorio:

| `DEPLOY_TARGET` | Workflow | Necesita |
|---|---|---|
| `node` | `.github/workflows/deploy-vps.yml` | SSH al VPS y la unidad systemd ya instalada |
| `cloudflare` | `.github/workflows/deploy-cloudflare.yml` | Token y account ID de Cloudflare |

Haz primero un deploy manual. Así separas problemas de infraestructura de problemas de CI. Después configura el environment `production`, sus variables públicas y los secrets indicados en la sección del target. Un push a `main` o `workflow_dispatch` publica solo ese destino.

## Verificación antes de producción

Ejecuta la suite y ambos builds desde un árbol limpio:

```bash
npm test
npm run check
npm run build:node
npm run build:cf
```

Cada build reemplaza `dist/`; despliega inmediatamente después del comando del target correcto. Antes de cambiar DNS o abrir tráfico, confirma:

- La portada carga y `/api/contacto` es la única ruta dinámica.
- El formulario guarda con JavaScript deshabilitado y responde con `303`.
- Un fallo de correo no elimina el lead guardado.
- El target Cloudflare no contiene `mysql2` ni `nodemailer`.
- Ningún secreto aparece en `dist/client`.
- La consulta de leads devuelve el envío de prueba.

Si algo falla, usa la tabla de [Solución de problemas](#solución-de-problemas) antes de repetir el deploy.

## Turnstile

1. Crea un widget Turnstile y restringe sus hostnames a producción y previews necesarios.
2. Define `PUBLIC_CAPTCHA_PROVIDER=turnstile` y `PUBLIC_CAPTCHA_SITE_KEY` en el entorno de build.
3. Guarda `CAPTCHA_SECRET` en `/opt/nexera/.env` (VPS) o con `wrangler secret put` (Cloudflare).
4. Vuelve a desplegar: el proveedor y site key son públicos y se incrustan en el build.

El site key y el secret deben pertenecer al mismo widget. Nunca uses el secret como variable pública.

Turnstile y reCAPTCHA requieren JavaScript. Con `PUBLIC_CAPTCHA_PROVIDER=none`, el formulario conserva su submit nativo y funciona sin JavaScript. Al activar un captcha, el servidor falla cerrado si falta el token y `<noscript>` ofrece el correo como canal alternativo; nunca se omite el captcha silenciosamente.

## Analítica

Configura un proveedor mediante variables públicas y vuelve a desplegar:

| Proveedor | Variables |
|---|---|
| Desactivada | `PUBLIC_ANALYTICS_PROVIDER=none` |
| Google Analytics 4 | `PUBLIC_ANALYTICS_PROVIDER=ga4`, `PUBLIC_ANALYTICS_ID` |
| Umami | `PUBLIC_ANALYTICS_PROVIDER=umami`, `PUBLIC_ANALYTICS_ID`, `PUBLIC_ANALYTICS_SRC` si es self-hosted |
| Plausible | `PUBLIC_ANALYTICS_PROVIDER=plausible`, `PUBLIC_ANALYTICS_ID`, `PUBLIC_ANALYTICS_SRC` si es self-hosted |
| Cloudflare Web Analytics | `PUBLIC_ANALYTICS_PROVIDER=cloudflare`, `PUBLIC_ANALYTICS_ID` con el beacon token |

Para Cloudflare Web Analytics, crea el sitio en **Analytics & Logs → Web Analytics → Add a site**, copia el beacon token en `PUBLIC_ANALYTICS_ID`, define `PUBLIC_ANALYTICS_PROVIDER=cloudflare` y vuelve a desplegar.

El componente carga scripts con `defer`. `src/scripts/track.ts` envía el evento `contacto_enviado` con el mismo proveedor.

## Consultar leads

Los leads contienen datos personales. Limita el acceso a operadores autorizados y no expongas estas consultas como endpoint público.

MySQL:

```bash
mysql --host=127.0.0.1 --user=nexera --password --database=nexera \
  --execute="SELECT id,nombre,email,empresa,tamano_empresa,servicio,origen,created_at FROM contactos ORDER BY created_at DESC LIMIT 50"
```

D1 remoto:

```bash
npx wrangler d1 execute nexera --remote \
  --command="SELECT id,nombre,email,empresa,tamano_empresa,servicio,origen,created_at FROM contactos ORDER BY created_at DESC LIMIT 50"
```

Cambia `nexera` por el `database_name` de `wrangler.jsonc` si elegiste otro nombre. Evita consultar o exportar `ip_hash` y `user_agent` salvo una investigación justificada.

## Migrar una landing PHP/MySQL

Haz una copia de seguridad de la base antigua. El migrador lee `OLD_MYSQL_HOST`, `OLD_MYSQL_PORT`, `OLD_MYSQL_USER`, `OLD_MYSQL_PASSWORD` y `OLD_MYSQL_DATABASE`; si faltan, usa las variables `MYSQL_*`. `--source-table` vale `contactos` por defecto, `--limit` procesa lotes de 500 filas y el mapa opcional tiene forma `columna_antigua:columna_nueva`.

Para Node, valida primero la conexión y el mapeo sin insertar:

```bash
DEPLOY_TARGET=node npm run migrate:php -- --dry-run
```

Después importa. Sin `--map`, el script usa nombres lógicos coincidentes:

```bash
DEPLOY_TARGET=node npm run migrate:php -- \
  --source-table=contactos_legacy \
  --map=nombre_viejo:nombre,email_viejo:email
```

Para D1, el migrador emite SQL escapado. `--dry-run` lo escribe en stdout para inspección; la ejecución normal admite `--out`:

```bash
DEPLOY_TARGET=cloudflare npm run migrate:php -- \
  --source-table=contactos_legacy --dry-run
DEPLOY_TARGET=cloudflare npm run migrate:php -- \
  --source-table=contactos_legacy \
  --out=db/migracion-d1.sql
npx wrangler d1 execute nexera --remote --file=db/migracion-d1.sql
```

Si la tabla origen no existe, el migrador informa el caso y termina sin error. No versiones el SQL exportado si contiene datos reales.

## Las tres decisiones de portabilidad

### 1. Bundle limpio por target

`astro.config.mjs` resuelve `@driver/db`, `@driver/smtp`, `@runtime/env` y `@runtime/ip` a implementaciones propias de cada target según `DEPLOY_TARGET`. El código descartado nunca se resuelve: el Worker no incluye `mysql2` ni `nodemailer`, y el build Node no arrastra bindings, headers ni APIs de Workers. Las variantes respetan las mismas fachadas.

### 2. Entorno unificado

El código de servidor obtiene configuración solo mediante `getEnv(locals)`. El alias `@runtime/env` usa `env` de `cloudflare:workers` en Workers y `process.env` en Node; Astro 7 ya no expone `locals.runtime.env`. Las variables `PUBLIC_*` se leen con `import.meta.env` y se inlinean de la misma forma en ambos builds. Esta separación impide depender accidentalmente de una API de entorno exclusiva de un runtime.

### 3. Dos dialectos SQL detrás de una fachada

`db/schema.mysql.sql` y `db/schema.d1.sql` conservan la misma forma lógica. `saveContacto` y `countRecentByIpHash` ocultan las diferencias: MySQL usa `NOW() - INTERVAL ? SECOND`; D1 usa `datetime('now', ?)`. El rate limit persiste en la tabla de contactos y no agrega otro servicio.

## Solución de problemas

| Síntoma | Revisión y corrección |
|---|---|
| Quiero revisar sin tocar nada | Ejecuta `npm run setup -- --dry-run`; no escribe archivos, no usa la red y no aplica esquemas. |
| Setup falla con permisos MySQL | Concede `CREATE`/`INDEX` temporalmente o aplica el esquema como administrador y repite con `--no-db`. |
| Cloudflare local no ve variables | Wrangler lee `.dev.vars`, no `.env`; vuelve a ejecutar setup con target `cloudflare`. |
| Wrangler no está instalado | Ejecuta `npm ci` desde la raíz; Wrangler es una dependencia de desarrollo del proyecto. |
| El workflow aparece como *skipped* | Comprueba la variable de repositorio `DEPLOY_TARGET`; debe ser exactamente `node` o `cloudflare`. |
| El build usa el adapter equivocado | Usa `npm run build:node` o `npm run build:cf`; no reutilices `dist/` de otro target. |
| VPS devuelve 502 | Revisa `systemctl status nexera`, `journalctl -u nexera` y que Nginx y systemd usen el mismo puerto 4321. |
| El deploy VPS no escribe o no reinicia | Confirma que `deploy` pertenece al grupo `nexera`, que `/opt/nexera` tiene grupo escribible y que sudoers permite solo el restart indicado. |
| `Host key verification failed` | Actualiza `VPS_KNOWN_HOSTS` desde una sesión confiable después de verificar la nueva huella; no desactives la comprobación. |
| Node no conecta a MySQL | Compara `MYSQL_HOST`, puerto, usuario y base en `/opt/nexera/.env`; prueba el cliente MySQL desde el VPS y revisa `journalctl`. |
| D1 informa `no such table: contactos` | Confirma el binding `DB` y ejecuta `wrangler d1 execute ... --remote --file=db/schema.d1.sql`. |
| Wrangler no autentica en CI | Comprueba el scope y cuenta de `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; no uses un token global. |
| Turnstile no aparece | Verifica proveedor y site key en las variables públicas y vuelve a desplegar. |
| Turnstile rechaza envíos | Verifica hostname, que site key y secret pertenezcan al mismo widget y que `CAPTCHA_SECRET` exista en el runtime. |
| No aparece analítica | Revisa proveedor, ID y URL de script; como son `PUBLIC_*`, cualquier cambio requiere un build nuevo. |
| El formulario falla detrás de proxy | Conserva `Host` y todos los headers `X-Forwarded-*` del archivo Nginx; las solicitudes de prueba deben enviar un `Origin` válido por la protección CSRF de Astro. |
| La migración no conecta | Revisa `OLD_MYSQL_*` o el fallback `MYSQL_*`, conectividad y permisos de lectura de la tabla origen; repite primero con `--dry-run`. |
