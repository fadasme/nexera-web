import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  renderBanner,
  renderChoiceMenu,
  renderConfigurationSummary,
  renderNextSteps,
  resolveChoice,
} from '../scripts/setup-ui.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const setupScript = fileURLToPath(new URL('../scripts/setup.mjs', import.meta.url));

async function createSetupFixture(street) {
  const root = await mkdtemp(join(tmpdir(), 'nexera-setup-env-'));
  await mkdir(join(root, 'scripts'));
  await Promise.all([
    copyFile(join(projectRoot, 'scripts/setup.mjs'), join(root, 'scripts/setup.mjs')),
    copyFile(join(projectRoot, 'scripts/setup-ui.mjs'), join(root, 'scripts/setup-ui.mjs')),
    copyFile(join(projectRoot, 'package.json'), join(root, 'package.json')),
  ]);
  const example = await readFile(join(projectRoot, '.env.example'), 'utf8');
  await writeFile(
    join(root, '.env.example'),
    example.replace(/^PUBLIC_BUSINESS_STREET=.*$/m, `PUBLIC_BUSINESS_STREET=${JSON.stringify(street)}`),
  );
  return root;
}

function runSetupFixture(root) {
  return spawnSync(
    process.execPath,
    [join(root, 'scripts/setup.mjs'), '--target=node', '--yes', '--no-db'],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
      timeout: 10_000,
    },
  );
}

const targets = [
  { value: 'node', label: 'VPS / Node.js', description: 'MySQL, Nginx y systemd o Docker' },
  { value: 'cloudflare', label: 'Cloudflare', description: 'Workers y D1' },
];

test('el asistente explica los dos destinos desde la primera pantalla', () => {
  const banner = renderBanner({ color: false });
  assert.match(banner, /NEXERA SETUP/);
  assert.match(banner, /Node \+ MySQL/);
  assert.match(banner, /Workers \+ D1/);
});

test('los menús aceptan tanto el número como el valor canónico', () => {
  assert.equal(resolveChoice('1', targets), 'node');
  assert.equal(resolveChoice('cloudflare', targets), 'cloudflare');
  assert.equal(resolveChoice(' 2 ', targets), 'cloudflare');
  assert.equal(resolveChoice('otro', targets), undefined);

  const menu = renderChoiceMenu(targets, 'node', { color: false });
  assert.match(menu, /1\s+VPS \/ Node\.js/);
  assert.match(menu, /2\s+Cloudflare/);
  assert.match(menu, /actual/);
});

test('el resumen muestra decisiones sin imprimir secretos', () => {
  const secret = 'secret-value-that-must-not-leak';
  const summary = renderConfigurationSummary({
    target: 'node',
    siteName: 'Nexera',
    siteUrl: 'https://nexera.cl',
    database: 'MySQL 127.0.0.1:3306/nexera',
    mail: 'resend',
    analytics: 'none',
    captcha: 'turnstile',
    files: '.env, .env.bak (si cambia)',
    noDb: false,
    secrets: [
      ['IP_HASH_SALT', secret],
      ['CAPTCHA_SECRET', ''],
    ],
  }, { color: false });

  assert.match(summary, /Revisa antes de aplicar/);
  assert.match(summary, /Nexera · https:\/\/nexera\.cl/);
  assert.match(summary, /IP_HASH_SALT.*configurado/);
  assert.match(summary, /CAPTCHA_SECRET.*vacío/);
  assert.doesNotMatch(summary, new RegExp(secret));
});

test('los próximos pasos cambian según el destino', () => {
  const node = renderNextSteps('node', { color: false });
  const cloudflare = renderNextSteps('cloudflare', { color: false });

  assert.match(node, /npm run build:node/);
  assert.match(node, /deploy\/nexera\.service/);
  assert.match(cloudflare, /npm run build:cf/);
  assert.match(cloudflare, /npm run deploy/);
});

test('el dry-run no interactivo recorre el asistente sin filtrar secretos', () => {
  const result = spawnSync(
    process.execPath,
    [setupScript, '--target=node', '--yes', '--dry-run', '--no-db'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
      timeout: 10_000,
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /NEXERA SETUP/);
  assert.match(result.stdout, /\[1\/5\] DESTINO/);
  assert.match(result.stdout, /\[5\/5\] REVISIÓN/);
  assert.match(result.stdout, /Simulación completada; no se hicieron cambios/);
  assert.match(result.stdout, /PRÓXIMOS PASOS/);
  assert.doesNotMatch(result.stdout, /\u001b\[/);
  assert.doesNotMatch(result.stdout, /(?:IP_HASH_SALT|MYSQL_PASSWORD)=(?!<)/);
});

test('las respuestas secretas no quedan en el historial de readline', async () => {
  const source = await readFile(setupScript, 'utf8');
  assert.match(
    source,
    /createInterface\(\{[\s\S]*?historySize:\s*0,[\s\S]*?\}\)/,
    'La interfaz debe desactivar el historial para que ARROW UP no revele secretos',
  );
});

test('el modo interactivo exige terminal en stdin y stdout', async () => {
  const [source, readme] = await Promise.all([
    readFile(setupScript, 'utf8'),
    readFile(join(projectRoot, 'README.md'), 'utf8'),
  ]);
  assert.match(
    source,
    /!process\.stdin\.isTTY\s*\|\|\s*!process\.stdout\.isTTY/,
    'El modo interactivo no debe degradar el ocultamiento cuando stdout está redirigido',
  );
  assert.match(
    readme,
    /`stdin` o `stdout`[\s\S]*tuberías o redirección[\s\S]*`--yes`/,
    'La guía debe explicar que ambos extremos necesitan TTY',
  );

  const result = spawnSync(
    process.execPath,
    [setupScript, '--target=node', '--dry-run', '--no-db'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
      input: '',
      timeout: 10_000,
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /terminal interactiva[\s\S]*--yes/);
  assert.doesNotMatch(result.stdout, /\[2\/5\] IDENTIDAD DEL SITIO/);
});

test('el .env generado conserva apóstrofes y dólares al cargarlo con Node', async (t) => {
  const expected = "Av. O'Higgins $100";
  const root = await createSetupFixture(expected);
  t.after(() => rm(root, { recursive: true, force: true }));

  const setup = runSetupFixture(root);
  assert.equal(setup.status, 0, setup.stderr);

  const probe = spawnSync(
    process.execPath,
    [`--env-file=${join(root, '.env')}`, '-e', 'process.stdout.write(process.env.PUBLIC_BUSINESS_STREET ?? "")'],
    { encoding: 'utf8', timeout: 10_000 },
  );
  assert.equal(probe.status, 0, probe.stderr);
  assert.equal(probe.stdout, expected);
});

test('el setup rechaza valores que Node y systemd no pueden compartir sin pérdida', async (t) => {
  const root = await createSetupFixture(`say "hi" it's`);
  t.after(() => rm(root, { recursive: true, force: true }));

  const setup = runSetupFixture(root);
  assert.notEqual(setup.status, 0);
  assert.match(setup.stderr, /no puede representarse[\s\S]*Node y systemd/i);
});
