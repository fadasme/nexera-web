# Implementation Notes

## Deviations

- El plan recomienda worktree aislado; la sesión ya venía trabajando en la rama dedicada `feat/nexera-landing` dentro del checkout administrado por Orca. Se continúa ahí para no mover cambios ni romper el contexto; revisitable creando un worktree antes de otra feature.
- Tasks 1–6 se implementaron inline antes de reanudar; Tasks 7–9 se delegan como unidades independientes y la validación global se ejecuta una sola vez al final para evitar interferencia entre cambios concurrentes.

## Discovered edge cases

- El CodeGraph no está inicializado en este repositorio; la exploración previa a cambios devuelve un error explícito, así que se usa el plan aprobado y lecturas directas.
- `workerd` necesitó aprobación de postinstall para que `astro check` y el adapter Cloudflare funcionaran localmente.
- El formulario estático no puede renderizar errores de query en servidor; usa anclas CSS `:target` sin JS y lectura de `?e=` como enhancement.
- Astro valida `Origin` contra `security.allowedDomains`; el POST detrás de nginx devolvía 403 antes de alcanzar el endpoint. `astro.config.mjs` deriva el dominio permitido desde `PUBLIC_SITE_URL`.
- El redirect de validación apuntaba a `#contacto`, pero solo los bloques `#e-<code>` usan `:target`; se alineó el fragmento para que el error sea visible con JavaScript deshabilitado.
- En setup, `--no-db` debe omitir conexiones/creación/esquema, no omitir la captura de credenciales; de lo contrario una configuración interactiva queda incompleta.
- La actualización a Astro 7 elimina `platformProxy` (el adapter v14 usa workerd/Vite por defecto) y `locals.runtime.env`; la configuración privada ahora se resuelve por alias a `cloudflare:workers` o `process.env`.
- En Astro 7, `ctx.clientAddress` ya contiene el `X-Forwarded-For` validado cuando `allowedDomains` acepta el host; volver a leer el header tras comprobar loopback era código muerto. El helper Node delega en Astro y el contrato de seguridad exige Nginx sobrescribiendo XFF y systemd ligado a loopback.
- El salto a Nodemailer 9 y Sharp 0.35 elimina los avisos high de `npm audit --omit=dev`; `createTransport`/`sendMail` conservan la API usada y Nodemailer 9 endurece la validación TLS por defecto.

## Questions for review

- Ninguna por ahora.
