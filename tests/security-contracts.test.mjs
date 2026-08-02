import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('los errores no-JS redirigen al bloque visible que corresponde', async () => {
  const endpoint = await source('src/pages/api/contacto.ts');
  assert.match(endpoint, /Location:\s*`\/\?e=\$\{code\}#e-\$\{code\}`/);
});

test('Astro confía en el dominio canónico detrás del reverse proxy', async () => {
  const config = await source('astro.config.mjs');
  assert.match(config, /security:\s*\{[\s\S]*allowedDomains:/);
  assert.match(config, /hostname:\s*siteOrigin\.hostname/);
});

test('un captcha configurado sin secreto falla cerrado', async () => {
  const captcha = await source('src/lib/captcha.ts');
  assert.match(captcha, /if \(!secret\)\s*\{[\s\S]*?return false;\s*\}/);
});

test('nunca se genera un hash de IP con salt vacío', async () => {
  const endpoint = await source('src/pages/api/contacto.ts');
  assert.doesNotMatch(endpoint, /envStr\(env,\s*'IP_HASH_SALT'\)\s*\?\?\s*''/);
});

test('un provider captcha desconocido no desactiva la verificación', async () => {
  const captcha = await source('src/lib/captcha.ts');
  assert.match(captcha, /if \(provider === 'none'\) return true;/);
  assert.match(
    captcha,
    /if \(provider !== 'turnstile' && provider !== 'recaptcha'\)[\s\S]*?return false;/,
  );
});

test('la verificación captcha tiene timeout', async () => {
  const captcha = await source('src/lib/captcha.ts');
  assert.match(captcha, /AbortSignal\.timeout\(/);
});

test('el tamaño del body se rechaza antes de materializar FormData', async () => {
  const endpoint = await source('src/pages/api/contacto.ts');
  const sizeGuard = endpoint.indexOf("request.headers.get('content-length')");
  const formData = endpoint.indexOf('request.formData()');
  assert.ok(sizeGuard >= 0 && sizeGuard < formData, 'Content-Length debe validarse antes de formData()');
});

test('Node delega XFF a Astro solo detrás del reverse proxy protegido', async () => {
  const [nodeIp, cloudflareIp, config, nginx, service] = await Promise.all([
    source('src/lib/runtime/ip.node.ts'),
    source('src/lib/runtime/ip.cloudflare.ts'),
    source('astro.config.mjs'),
    source('deploy/nginx.conf'),
    source('deploy/nexera.service'),
  ]);
  assert.doesNotMatch(nodeIp, /x-forwarded-for|cf-connecting-ip/);
  assert.match(nodeIp, /return direct;/);
  assert.match(config, /security:\s*\{[\s\S]*allowedDomains:/);
  assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr;/);
  assert.doesNotMatch(nginx, /\$proxy_add_x_forwarded_for/);
  assert.match(service, /Environment=HOST=127\.0\.0\.1/);
  assert.match(cloudflareIp, /cf-connecting-ip/);
  assert.doesNotMatch(cloudflareIp, /x-forwarded-for/);
});

test('el modo sin JS no ofrece un submit que el captcha rechazará', async () => {
  const form = await source('src/components/ContactForm.astro');
  assert.match(form, /<noscript>[\s\S]*?conCaptcha[\s\S]*?site\.email[\s\S]*?<\/noscript>/);
});

test('Docker deja que Node interprete el .env generado sin conservar comillas', async () => {
  const [dockerfile, dockerignore, readme] = await Promise.all([
    source('Dockerfile'),
    source('.dockerignore'),
    source('README.md'),
  ]);
  assert.match(
    dockerfile,
    /CMD \["node", "--env-file-if-exists=\/run\/secrets\/nexera\.env", "dist\/server\/entry\.mjs"\]/,
  );
  assert.doesNotMatch(readme, /--env-file\s+\/opt\/nexera\/\.env/);
  assert.match(
    readme,
    /--mount type=bind,src=\/opt\/nexera\/\.env,dst=\/run\/secrets\/nexera\.env,readonly/,
  );
  assert.match(dockerignore, /^\.dev\.vars$/m);
});
