#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, chmod, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  renderBanner,
  renderChoiceMenu,
  renderConfigurationSummary,
  renderNextSteps,
  renderSection,
  renderStatus,
  resolveChoice,
} from './setup-ui.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = resolve(ROOT, '.env');
const ENV_EXAMPLE_PATH = resolve(ROOT, '.env.example');
const DEV_VARS_PATH = resolve(ROOT, '.dev.vars');
const WRANGLER_PATH = resolve(ROOT, 'wrangler.jsonc');
const D1_SCHEMA_PATH = resolve(ROOT, 'db/schema.d1.sql');
const MYSQL_SCHEMA_PATH = resolve(ROOT, 'db/schema.mysql.sql');
const WRANGLER_BIN = resolve(ROOT, 'node_modules/wrangler/bin/wrangler.js');
const PACKAGE_PATH = resolve(ROOT, 'package.json');

const HELP = `Nexera Setup

Configura el mismo proyecto para VPS (Node + MySQL) o Cloudflare
(Workers + D1). El asistente valida, resume y recién entonces escribe.

Ruta rápida:
  npm run setup
  npm run setup -- --dry-run

Uso:
  npm run setup -- [opciones]

Opciones:
  --target=node|cloudflare  Preseleccionar destino
  --yes                    Aceptar valores existentes (CI)
  --dry-run                Mostrar el plan sin escribir ni usar la red
  --no-db                   Omitir validación y migración de la base
  --push-secrets            Publicar secretos con Wrangler (Cloudflare)
  --help                    Mostrar esta ayuda

Colores:
  Usa NO_COLOR=1 para desactivar el formato ANSI.
`;

const ENV_KEYS = [
  'DEPLOY_TARGET', 'PUBLIC_SITE_URL', 'PUBLIC_SITE_NAME', 'PUBLIC_BUSINESS_EMAIL',
  'PUBLIC_BUSINESS_PHONE', 'PUBLIC_BUSINESS_WHATSAPP', 'PUBLIC_BUSINESS_STREET',
  'PUBLIC_BUSINESS_CITY', 'PUBLIC_BUSINESS_REGION', 'PUBLIC_BUSINESS_COUNTRY',
  'PUBLIC_BUSINESS_SOCIAL', 'PUBLIC_ANALYTICS_PROVIDER', 'PUBLIC_ANALYTICS_ID',
  'PUBLIC_ANALYTICS_SRC', 'PUBLIC_CAPTCHA_PROVIDER', 'PUBLIC_CAPTCHA_SITE_KEY',
  'CAPTCHA_SECRET', 'IP_HASH_SALT', 'RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW',
  'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE',
  'MAIL_PROVIDER', 'RESEND_API_KEY', 'MAIL_FROM', 'MAIL_TO', 'SMTP_HOST',
  'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'HOST', 'PORT',
];

const SECRET_KEYS = ['CAPTCHA_SECRET', 'IP_HASH_SALT', 'RESEND_API_KEY', 'SMTP_PASS'];
const CLOUDFLARE_RUNTIME_KEYS = [
  'CAPTCHA_SECRET', 'IP_HASH_SALT', 'RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW',
  'MAIL_PROVIDER', 'RESEND_API_KEY', 'MAIL_FROM', 'MAIL_TO',
];

async function readText(path, fallback = '') {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function loadEnvFile(path) {
  const text = await readText(path);
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\\$/g, '$');
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    values[match[1]] = value;
  }
  return { text, values };
}

function formatEnvValue(value, key) {
  const text = String(value ?? '');
  if (text === '') return '';
  if (/^[A-Za-z0-9_./:@+,-]+$/.test(text)) return text;
  if (!text.includes("'") && !/[\r\n]/.test(text)) return `'${text}'`;
  if (!/["\\\r\n]/.test(text)) return `"${text}"`;
  throw new Error(
    `${key}: un valor de .env con comillas dobles, barra invertida o salto de línea no puede representarse de forma compatible con Node y systemd.`,
  );
}

export function serializeEnv(baseText, values, keys = Object.keys(values)) {
  const remaining = new Set(keys.filter((key) => Object.hasOwn(values, key)));
  const lines = baseText ? baseText.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n') : [];
  const output = lines.map((line) => {
    const match = line.match(/^(\s*)(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !remaining.has(match[2])) return line;
    const key = match[2];
    remaining.delete(key);
    return `${match[1]}${key}=${formatEnvValue(values[key], key)}`;
  });
  if (remaining.size > 0 && output.length > 0 && output.at(-1) !== '') output.push('');
  for (const key of keys) {
    if (remaining.delete(key)) output.push(`${key}=${formatEnvValue(values[key], key)}`);
  }
  return `${output.join('\n')}\n`;
}

export async function writeFileSafe(path, content, dryRun, mode) {
  const current = await readText(path, null);
  if (current === content) {
    if (!dryRun && mode) await chmod(path, mode);
    return false;
  }
  if (dryRun) return true;
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, content, { encoding: 'utf8', mode });
    await rename(temporary, path);
    if (mode) await chmod(path, mode);
    return true;
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

function parseJsonc(text) {
  if (!text.trim()) return {};
  let clean = '';
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (lineComment) {
      if (char === '\n') { lineComment = false; clean += char; }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (inString) {
      clean += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; clean += char; }
    else if (char === '/' && next === '/') { lineComment = true; index += 1; }
    else if (char === '/' && next === '*') { blockComment = true; index += 1; }
    else clean += char;
  }
  let json = '';
  inString = false;
  escaped = false;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    if (inString) {
      json += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      json += char;
    } else if (char === ',') {
      let next = index + 1;
      while (/\s/.test(clean[next] ?? '')) next += 1;
      if (clean[next] !== '}' && clean[next] !== ']') json += char;
    } else {
      json += char;
    }
  }
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('wrangler.jsonc no contiene JSONC válido; corrígelo antes de ejecutar setup.');
  }
}

function absoluteUrl(value, label, { optional = false } = {}) {
  if (optional && !value) return;
  try {
    const url = new URL(value);
    if (!url.protocol || !url.hostname) throw new Error();
  } catch {
    throw new Error(`${label} debe ser una URL absoluta (por ejemplo, https://nexera.cl).`);
  }
}

function integer(value, label) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) throw new Error(`${label} debe ser un entero positivo.`);
}

function choice(value, options, label) {
  if (!options.includes(value)) throw new Error(`${label} debe ser uno de: ${options.join(', ')}.`);
  return value;
}

function required(value, label) {
  if (!value) throw new Error(`${label} no puede quedar vacío.`);
}

function command(program, args, { input } = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(program, args, { cwd: ROOT, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => reject(new Error(`No se pudo ejecutar ${program}: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolveCommand({ stdout, stderr });
      else reject(new Error((stderr || stdout || `${program} terminó con código ${code}`).trim()));
    });
    child.stdin.end(input === undefined ? undefined : `${input}\n`);
  });
}

async function wrangler(args, options) {
  try {
    await access(WRANGLER_BIN);
  } catch {
    throw new Error('Wrangler no está instalado. Ejecuta `npm install` y vuelve a intentar.');
  }
  return command(process.execPath, [WRANGLER_BIN, ...args], options);
}

function createPromptTerminal(input = process.stdin, stdout = process.stdout) {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) stdout.write(chunk);
      callback();
    },
  });
  output.isTTY = stdout.isTTY;
  output.columns = stdout.columns;
  output.rows = stdout.rows;

  const rl = createInterface({
    input,
    output,
    terminal: Boolean(input.isTTY && stdout.isTTY),
    historySize: 0,
  });
  const questionSecret = async (prompt) => {
    stdout.write(prompt);
    muted = true;
    try {
      return await rl.question('');
    } finally {
      muted = false;
      stdout.write('\n');
    }
  };
  return { rl, questionSecret };
}

function createPrompts(rl, yes, questionSecret) {
  const ask = async (label, fallback = '', validate) => {
    if (yes) {
      if (validate) validate(fallback);
      return fallback;
    }
    while (true) {
      const answer = (await rl.question(`  ${label}${fallback ? ` [${fallback}]` : ''}\n  > `)).trim() || fallback;
      try {
        if (validate) validate(answer);
        return answer;
      } catch (error) {
        console.error(renderStatus('error', error.message));
      }
    }
  };
  const askSecret = async (label, fallback = '', validate) => {
    if (yes) {
      if (validate) validate(fallback);
      return fallback;
    }
    while (true) {
      const answer = (await questionSecret(`  ${label}${fallback ? ' [Enter conserva el actual]' : ''}\n  > `)).trim() || fallback;
      try {
        if (validate) validate(answer);
        return answer;
      } catch (error) {
        console.error(renderStatus('error', error.message));
      }
    }
  };
  const choose = async (label, options, fallback) => {
    if (yes) {
      const selected = resolveChoice(fallback, options);
      if (!selected) throw new Error(`${label} no tiene una opción predeterminada válida.`);
      return selected;
    }
    console.log(renderChoiceMenu(options, fallback));
    const fallbackNumber = options.findIndex((option) => option.value === fallback) + 1;
    while (true) {
      const answer = (await rl.question(`  ${label}${fallbackNumber ? ` [${fallbackNumber}]` : ''}\n  > `)).trim();
      const selected = resolveChoice(answer || fallback, options);
      if (selected) return selected;
      console.error(renderStatus('error', `Elige un número entre 1 y ${options.length}.`));
    }
  };
  const confirm = async (label, fallback = true) => {
    if (yes) return fallback;
    while (true) {
      const answer = (await rl.question(`  ${label} [${fallback ? 'S/n' : 's/N'}]\n  > `)).trim().toLowerCase();
      if (!answer) return fallback;
      if (['s', 'si', 'sí', 'y', 'yes'].includes(answer)) return true;
      if (['n', 'no'].includes(answer)) return false;
      console.error(renderStatus('error', 'Responde sí o no.'));
    }
  };
  return { ask, askSecret, choose, confirm };
}

async function collectConfiguration(env, targetArg, prompts) {
  const targetOptions = [
    {
      value: 'node',
      label: 'VPS / Node.js',
      description: 'MySQL, Nginx y systemd; Docker también disponible',
    },
    {
      value: 'cloudflare',
      label: 'Cloudflare',
      description: 'Workers, D1 y dominio administrado desde Cloudflare',
    },
  ];

  console.log(renderSection(1, 5, 'Destino', 'El código no cambia; solo cambia el target de build.'));
  const target = targetArg
    || await prompts.choose('¿Dónde quieres desplegar?', targetOptions, env.DEPLOY_TARGET || 'node');
  choice(target, ['node', 'cloudflare'], 'Destino');
  env.DEPLOY_TARGET = target;
  console.log(renderStatus('ok', target === 'node' ? 'VPS / Node.js seleccionado' : 'Cloudflare Workers seleccionado'));

  console.log(renderSection(2, 5, 'Identidad del sitio', 'Estos datos alimentan SEO, JSON-LD y el contacto visible.'));
  env.PUBLIC_SITE_URL = await prompts.ask('URL pública del sitio', env.PUBLIC_SITE_URL || 'https://nexera.cl', (v) => absoluteUrl(v, 'PUBLIC_SITE_URL'));
  env.PUBLIC_SITE_NAME = await prompts.ask('Nombre del sitio', env.PUBLIC_SITE_NAME || 'Nexera');
  env.PUBLIC_BUSINESS_EMAIL = await prompts.ask('Correo público', env.PUBLIC_BUSINESS_EMAIL || 'contacto@nexera.cl');
  env.PUBLIC_BUSINESS_PHONE = await prompts.ask('Teléfono público', env.PUBLIC_BUSINESS_PHONE || '+56 9 5400 9251');
  env.PUBLIC_BUSINESS_WHATSAPP = await prompts.ask('WhatsApp público', env.PUBLIC_BUSINESS_WHATSAPP || '56954009251');
  env.PUBLIC_BUSINESS_STREET = await prompts.ask('Dirección física (opcional)', env.PUBLIC_BUSINESS_STREET || '');
  env.PUBLIC_BUSINESS_CITY = await prompts.ask('Ciudad', env.PUBLIC_BUSINESS_CITY || 'Santiago');
  env.PUBLIC_BUSINESS_REGION = await prompts.ask('Región', env.PUBLIC_BUSINESS_REGION || 'Región Metropolitana');
  env.PUBLIC_BUSINESS_COUNTRY = await prompts.ask('Código de país', env.PUBLIC_BUSINESS_COUNTRY || 'CL');
  env.PUBLIC_BUSINESS_SOCIAL = await prompts.ask('Redes sociales (URLs separadas por comas)', env.PUBLIC_BUSINESS_SOCIAL || '', (value) => {
    for (const url of value.split(',').map((item) => item.trim()).filter(Boolean)) {
      absoluteUrl(url, 'Cada valor de PUBLIC_BUSINESS_SOCIAL');
    }
  });

  console.log(renderSection(3, 5, 'Integraciones', 'Todas son opcionales; la base de datos basta para recibir leads.'));
  const analyticsOptions = [
    { value: 'none', label: 'Sin analítica', description: 'No inyecta scripts' },
    { value: 'ga4', label: 'Google Analytics 4', description: 'Requiere un ID G-XXXX' },
    { value: 'umami', label: 'Umami', description: 'Cloud o instancia propia' },
    { value: 'plausible', label: 'Plausible', description: 'Cloud o instancia propia' },
    { value: 'cloudflare', label: 'Cloudflare Web Analytics', description: 'Requiere beacon token' },
  ];
  env.PUBLIC_ANALYTICS_PROVIDER = await prompts.choose(
    'Proveedor de analítica',
    analyticsOptions,
    env.PUBLIC_ANALYTICS_PROVIDER || 'none',
  );
  if (env.PUBLIC_ANALYTICS_PROVIDER !== 'none') {
    env.PUBLIC_ANALYTICS_ID = await prompts.ask('ID, dominio o token de analítica', env.PUBLIC_ANALYTICS_ID || '', (value) => required(value, 'PUBLIC_ANALYTICS_ID'));
  }
  if (['umami', 'plausible'].includes(env.PUBLIC_ANALYTICS_PROVIDER)) {
    env.PUBLIC_ANALYTICS_SRC = await prompts.ask('URL del script (vacío usa el oficial)', env.PUBLIC_ANALYTICS_SRC || '', (v) => absoluteUrl(v, 'PUBLIC_ANALYTICS_SRC', { optional: true }));
  }

  const captchaOptions = [
    { value: 'none', label: 'Sin captcha', description: 'Mantiene el formulario funcional sin JavaScript' },
    { value: 'turnstile', label: 'Cloudflare Turnstile', description: 'Recomendado para ambos targets' },
    { value: 'recaptcha', label: 'Google reCAPTCHA', description: 'Requiere site key y secret' },
  ];
  env.PUBLIC_CAPTCHA_PROVIDER = await prompts.choose(
    'Protección captcha',
    captchaOptions,
    env.PUBLIC_CAPTCHA_PROVIDER || 'none',
  );
  if (env.PUBLIC_CAPTCHA_PROVIDER !== 'none') {
    env.PUBLIC_CAPTCHA_SITE_KEY = await prompts.ask('Clave pública del captcha', env.PUBLIC_CAPTCHA_SITE_KEY || '', (value) => required(value, 'PUBLIC_CAPTCHA_SITE_KEY'));
    env.CAPTCHA_SECRET = await prompts.askSecret('Secreto del captcha (entrada oculta)', env.CAPTCHA_SECRET || '', (value) => required(value, 'CAPTCHA_SECRET'));
  }

  const mailOptions = target === 'node'
    ? [
        { value: 'none', label: 'Solo guardar', description: 'No envía correo; el lead queda en MySQL' },
        { value: 'resend', label: 'Resend', description: 'API HTTP disponible en ambos targets' },
        { value: 'smtp', label: 'SMTP', description: 'Solo Node; usa Nodemailer' },
      ]
    : [
        { value: 'none', label: 'Solo guardar', description: 'No envía correo; el lead queda en D1' },
        { value: 'resend', label: 'Resend', description: 'API HTTP compatible con Workers' },
      ];
  const mailDefault = mailOptions.some((option) => option.value === env.MAIL_PROVIDER)
    ? env.MAIL_PROVIDER
    : 'none';
  env.MAIL_PROVIDER = await prompts.choose('Entrega por correo', mailOptions, mailDefault);
  if (env.MAIL_PROVIDER === 'resend') {
    env.RESEND_API_KEY = await prompts.askSecret('API key de Resend (entrada oculta)', env.RESEND_API_KEY || '', (value) => required(value, 'RESEND_API_KEY'));
  } else if (env.MAIL_PROVIDER === 'smtp') {
    env.SMTP_HOST = await prompts.ask('Host SMTP', env.SMTP_HOST || '', (value) => required(value, 'SMTP_HOST'));
    env.SMTP_PORT = await prompts.ask('Puerto SMTP', env.SMTP_PORT || '587', (v) => integer(v, 'SMTP_PORT'));
    env.SMTP_USER = await prompts.ask('Usuario SMTP (opcional)', env.SMTP_USER || '');
    env.SMTP_PASS = await prompts.askSecret('Contraseña SMTP (entrada oculta)', env.SMTP_PASS || '');
    env.SMTP_SECURE = await prompts.choose(
      'Cifrado SMTP',
      [
        { value: 'false', label: 'STARTTLS', description: 'Normalmente puerto 587' },
        { value: 'true', label: 'TLS directo', description: 'Normalmente puerto 465' },
      ],
      env.SMTP_SECURE || 'false',
    );
  }
  if (env.MAIL_PROVIDER !== 'none') {
    env.MAIL_FROM = await prompts.ask('Remitente', env.MAIL_FROM || 'Nexera <no-reply@nexera.cl>');
    env.MAIL_TO = await prompts.ask('Destinatario', env.MAIL_TO || env.PUBLIC_BUSINESS_EMAIL || 'contacto@nexera.cl');
  }
  if (!env.IP_HASH_SALT) env.IP_HASH_SALT = randomBytes(32).toString('hex');
  integer(env.RATE_LIMIT_MAX || '5', 'RATE_LIMIT_MAX');
  integer(env.RATE_LIMIT_WINDOW || '3600', 'RATE_LIMIT_WINDOW');
  return target;
}

async function collectMysql(env, prompts) {
  env.MYSQL_HOST = await prompts.ask('Host MySQL', env.MYSQL_HOST || '127.0.0.1');
  env.MYSQL_PORT = await prompts.ask('Puerto MySQL', env.MYSQL_PORT || '3306', (v) => integer(v, 'MYSQL_PORT'));
  env.MYSQL_USER = await prompts.ask('Usuario MySQL', env.MYSQL_USER || 'nexera');
  env.MYSQL_PASSWORD = await prompts.askSecret('Contraseña MySQL', env.MYSQL_PASSWORD || '');
  env.MYSQL_DATABASE = await prompts.ask('Base MySQL', env.MYSQL_DATABASE || 'nexera');
  if (!env.MYSQL_HOST || !env.MYSQL_USER || !env.MYSQL_DATABASE) throw new Error('MySQL requiere host, usuario y base de datos.');
}

function validateResend(apiKey) {
  if (!/^re_[A-Za-z0-9_-]+$/.test(apiKey)) {
    throw new Error('La API key de Resend no tiene el formato esperado (re_...).');
  }
}

async function applyMysql(env) {
  let connection;
  try {
    const mysql = await import('mysql2/promise');
    connection = await mysql.createConnection({ host: env.MYSQL_HOST, port: Number(env.MYSQL_PORT), user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DATABASE, charset: 'utf8mb4', multipleStatements: true });
    await connection.query('SELECT 1');
    await connection.query(await readFile(MYSQL_SCHEMA_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo validar/aplicar MySQL: ${error.message}`);
  } finally {
    await connection?.end();
  }
}

async function checkWranglerAuth() {
  const { stdout, stderr } = await wrangler(['whoami']);
  if (/not authenticated|not logged in/i.test(`${stdout}\n${stderr}`)) throw new Error('Wrangler no está autenticado. Ejecuta `npx wrangler login`.');
}

async function findOrCreateD1(databaseName) {
  const list = async () => {
    const { stdout } = await wrangler(['d1', 'list', '--json']);
    try {
      const parsed = JSON.parse(stdout);
      return Array.isArray(parsed) ? parsed : parsed.result ?? [];
    } catch {
      throw new Error('Wrangler devolvió una lista D1 que no se pudo interpretar.');
    }
  };
  let database = (await list()).find((item) => item.name === databaseName || item.database_name === databaseName);
  if (!database) {
    await wrangler(['d1', 'create', databaseName]);
    database = (await list()).find((item) => item.name === databaseName || item.database_name === databaseName);
  }
  const databaseId = database?.database_id ?? database?.uuid ?? database?.id;
  if (!databaseId) throw new Error(`No se pudo obtener database_id para D1 "${databaseName}".`);
  return databaseId;
}

function mergeWrangler(existing, packageName, databaseName, databaseId, includeDb) {
  const existingFlags = Array.isArray(existing.compatibility_flags) ? existing.compatibility_flags : [];
  const config = {
    ...existing,
    $schema: existing.$schema ?? 'node_modules/wrangler/config-schema.json',
    name: existing.name ?? packageName,
    main:
      !existing.main || existing.main === 'dist/_worker.js/index.js'
        ? '@astrojs/cloudflare/entrypoints/server'
        : existing.main,
    assets: {
      binding: 'ASSETS',
      directory: './dist',
      ...(existing.assets ?? {}),
    },
    compatibility_date: existing.compatibility_date ?? new Date().toISOString().slice(0, 10),
    compatibility_flags: Array.from(new Set([
      ...existingFlags,
      'nodejs_compat',
      'global_fetch_strictly_public',
    ])),
  };
  const databases = Array.isArray(existing.d1_databases) ? existing.d1_databases : [];
  if (includeDb) {
    const binding = { ...(databases.find((entry) => entry.binding === 'DB') ?? {}), binding: 'DB', database_name: databaseName, database_id: databaseId };
    config.d1_databases = [...databases.filter((entry) => entry.binding !== 'DB'), binding];
  } else {
    const remaining = databases.filter((entry) => entry.binding !== 'DB');
    if (remaining.length > 0) config.d1_databases = remaining;
    else delete config.d1_databases;
  }
  return config;
}

async function applyD1(databaseName) {
  await wrangler(['d1', 'execute', databaseName, '--local', '--file', D1_SCHEMA_PATH]);
  await wrangler(['d1', 'execute', databaseName, '--remote', '--file', D1_SCHEMA_PATH]);
}

async function pushCloudflareSecrets(env) {
  const keys = ['IP_HASH_SALT'];
  if (env.PUBLIC_CAPTCHA_PROVIDER !== 'none') keys.push('CAPTCHA_SECRET');
  if (env.MAIL_PROVIDER === 'resend') keys.push('RESEND_API_KEY');
  for (const key of keys) {
    if (env[key]) await wrangler(['secret', 'put', key], { input: env[key] });
  }
}

function cloudflareDevVars(env, baseText) {
  return serializeEnv(baseText, Object.fromEntries(CLOUDFLARE_RUNTIME_KEYS.map((key) => [key, env[key] ?? ''])), CLOUDFLARE_RUNTIME_KEYS);
}

function cloudflareVars(env) {
  return Object.fromEntries(CLOUDFLARE_RUNTIME_KEYS.filter((key) => !SECRET_KEYS.includes(key) && env[key] !== undefined).map((key) => [key, env[key]]));
}

function serializeWrangler(existing, packageName, databaseName, databaseId, env) {
  const merged = mergeWrangler(existing, packageName, databaseName, databaseId, Boolean(databaseId));
  merged.vars = { ...(existing.vars ?? {}), ...cloudflareVars(env) };
  return `${JSON.stringify(merged, null, 2)}\n`;
}

function printConfigurationSummary(target, env, d1Name, noDb) {
  const files = target === 'cloudflare'
    ? '.env, .env.bak (si cambia), .dev.vars, wrangler.jsonc'
    : '.env, .env.bak (si cambia)';
  const database = target === 'cloudflare'
    ? `D1 ${d1Name}`
    : `MySQL ${env.MYSQL_HOST}:${env.MYSQL_PORT}/${env.MYSQL_DATABASE}`;
  const secrets = [
    ['IP_HASH_SALT', env.IP_HASH_SALT],
    ...(target === 'node' ? [['MYSQL_PASSWORD', env.MYSQL_PASSWORD]] : []),
    ...(env.PUBLIC_CAPTCHA_PROVIDER !== 'none'
      ? [['CAPTCHA_SECRET', env.CAPTCHA_SECRET]]
      : []),
    ...(env.MAIL_PROVIDER === 'resend'
      ? [['RESEND_API_KEY', env.RESEND_API_KEY]]
      : []),
    ...(env.MAIL_PROVIDER === 'smtp'
      ? [['SMTP_PASS', env.SMTP_PASS]]
      : []),
  ];
  console.log(renderConfigurationSummary({
    target,
    siteName: env.PUBLIC_SITE_NAME,
    siteUrl: env.PUBLIC_SITE_URL,
    database,
    mail: env.MAIL_PROVIDER,
    analytics: env.PUBLIC_ANALYTICS_PROVIDER,
    captcha: env.PUBLIC_CAPTCHA_PROVIDER,
    files,
    noDb,
    secrets,
  }));
}

async function runAction(label, action) {
  console.log(renderStatus('pending', label));
  try {
    const result = await action();
    console.log(renderStatus('ok', label));
    return result;
  } catch (error) {
    console.error(renderStatus('error', label));
    throw error;
  }
}

async function writeEnvFiles(previousText, content, touched) {
  if (previousText && previousText !== content
    && await writeFileSafe(`${ENV_PATH}.bak`, previousText, false, 0o600)) {
    touched.push('.env.bak');
  }
  if (await writeFileSafe(ENV_PATH, content, false, 0o600)) touched.push('.env');
}

async function main() {
  const { values: flags } = parseArgs({ options: {
    target: { type: 'string' }, yes: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false }, 'no-db': { type: 'boolean', default: false },
    'push-secrets': { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false },
  }, strict: true });
  if (flags.help) { console.log(HELP); return; }
  if (!flags.yes && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new Error('Setup requiere una terminal interactiva; usa --yes para el modo no interactivo.');
  }
  if (flags.target) choice(flags.target, ['node', 'cloudflare'], '--target');

  console.log(renderBanner());
  if (flags['dry-run']) console.log(renderStatus('skip', 'Modo simulación: no se escribirán archivos ni se usará la red.'));
  if (flags.yes) console.log(renderStatus('skip', 'Modo no interactivo: se usarán los valores existentes.'));

  const [exampleFile, currentFile, devVarsFile, wranglerText, packageText] = await Promise.all([
    loadEnvFile(ENV_EXAMPLE_PATH), loadEnvFile(ENV_PATH), loadEnvFile(DEV_VARS_PATH),
    readText(WRANGLER_PATH), readFile(PACKAGE_PATH, 'utf8'),
  ]);
  const env = { ...exampleFile.values, ...currentFile.values };
  const wranglerConfig = parseJsonc(wranglerText);
  const packageConfig = JSON.parse(packageText);
  const { rl, questionSecret } = createPromptTerminal();
  const prompts = createPrompts(rl, flags.yes, questionSecret);
  const touched = [];
  const manual = [];

  try {
    const target = await collectConfiguration(env, flags.target, prompts);
    if (flags['push-secrets'] && target !== 'cloudflare') {
      throw new Error('--push-secrets solo está disponible para Cloudflare.');
    }

    console.log(renderSection(4, 5, 'Base de datos', target === 'node'
      ? 'Se validará la conexión y se aplicará db/schema.mysql.sql.'
      : 'Wrangler creará o reutilizará D1 y aplicará db/schema.d1.sql.'));
    let d1Name = '';
    let d1Id = '';
    if (target === 'node') {
      await collectMysql(env, prompts);
    } else {
      const currentBinding = wranglerConfig.d1_databases?.find?.((entry) => entry.binding === 'DB');
      d1Name = await prompts.ask('Nombre de la base D1', currentBinding?.database_name || env.MYSQL_DATABASE || 'nexera');
      d1Id = currentBinding?.database_name === d1Name ? currentBinding.database_id || '' : '';
    }

    let pushSecrets = flags['push-secrets'];
    if (target === 'cloudflare' && !pushSecrets && !flags.yes) {
      pushSecrets = await prompts.confirm('¿Publicar los secretos con Wrangler?', false);
    }

    const envContent = serializeEnv(currentFile.text || exampleFile.text, env, ENV_KEYS);
    console.log(renderSection(5, 5, 'Revisión', 'Nada se escribe hasta que apruebes este resumen.'));
    printConfigurationSummary(target, env, d1Name, flags['no-db']);

    if (!flags['dry-run'] && !(await prompts.confirm('¿Aplicar esta configuración ahora?', true))) {
      console.log(`\n${renderStatus('skip', 'Configuración cancelada; no se hicieron cambios.')}`);
      return;
    }

    if (flags['dry-run']) {
      if (await writeFileSafe(ENV_PATH, envContent, true, 0o600)) touched.push('.env (plan)');
      if (target === 'cloudflare') {
        if (await writeFileSafe(DEV_VARS_PATH, cloudflareDevVars(env, devVarsFile.text), true, 0o600)) {
          touched.push('.dev.vars (plan)');
        }
        if (d1Id || flags['no-db']) {
          const content = serializeWrangler(wranglerConfig, packageConfig.name, d1Name, d1Id, env);
          if (await writeFileSafe(WRANGLER_PATH, content, true)) touched.push('wrangler.jsonc (plan)');
        } else {
          touched.push('wrangler.jsonc (plan; database_id se resolverá al aplicar)');
        }
        manual.push('Ejecuta setup sin --dry-run para autenticar Wrangler y preparar D1.');
      }
      if (!flags['no-db']) {
        manual.push(`Ejecuta setup sin --dry-run para validar y aplicar ${target === 'node' ? 'MySQL' : 'D1'}.`);
      }
      if (env.MAIL_PROVIDER === 'resend') {
        manual.push('La clave de Resend se verificará al enviar el primer correo; usa una clave de solo envío limitada al dominio.');
      }
    } else {
      if (env.MAIL_PROVIDER === 'resend') {
        await runAction('Comprobando el formato de la API key de Resend', () => validateResend(env.RESEND_API_KEY));
      }
      if (target === 'node') {
        if (flags['no-db']) {
          console.log(renderStatus('skip', 'Validación y esquema MySQL omitidos por --no-db.'));
        } else {
          await runAction('Validando MySQL y aplicando el esquema', () => applyMysql(env));
        }
        await writeEnvFiles(currentFile.text, envContent, touched);
      } else {
        await runAction('Comprobando la sesión de Wrangler', checkWranglerAuth);
        if (flags['no-db']) {
          console.log(renderStatus('skip', 'Creación y esquema D1 omitidos por --no-db.'));
        } else {
          d1Id = await runAction('Creando o reutilizando la base D1', () => findOrCreateD1(d1Name));
        }
        if (!d1Id) {
          manual.push('Crea o configura D1 y repite setup sin --no-db para añadir el binding DB.');
        }
        const wranglerContent = serializeWrangler(wranglerConfig, packageConfig.name, d1Name, d1Id, env);
        await writeEnvFiles(currentFile.text, envContent, touched);
        if (await writeFileSafe(DEV_VARS_PATH, cloudflareDevVars(env, devVarsFile.text), false, 0o600)) {
          touched.push('.dev.vars');
        }
        if (await writeFileSafe(WRANGLER_PATH, wranglerContent, false)) touched.push('wrangler.jsonc');
        if (!flags['no-db']) {
          await runAction('Aplicando el esquema D1 local y remoto', () => applyD1(d1Name));
        }
        if (pushSecrets) {
          await runAction('Publicando secretos del Worker', () => pushCloudflareSecrets(env));
        } else {
          manual.push('Publica los secretos luego con: npm run setup -- --target=cloudflare --yes --no-db --push-secrets');
        }
      }
    }

    const completion = flags['dry-run']
      ? 'Simulación completada; no se hicieron cambios.'
      : 'Configuración completada.';
    console.log(`\n${renderStatus(flags['dry-run'] ? 'skip' : 'ok', completion)}`);
    console.log(`Archivos ${flags['dry-run'] ? 'que cambiarían' : 'tocados'}: ${touched.length ? touched.join(', ') : 'ninguno; ya estaban actualizados'}.`);
    if (manual.length > 0) {
      console.log('\nPendiente:');
      for (const step of manual) console.log(`  - ${step}`);
    }
    console.log(`\n${renderNextSteps(target)}`);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(`\n${renderStatus('error', `Setup detenido: ${error.message}`)}`);
  process.exitCode = 1;
});
