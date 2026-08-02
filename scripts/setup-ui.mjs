const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
};

const STATUS = {
  pending: { label: '..', codes: ['cyan'] },
  ok: { label: 'ok', codes: ['green'] },
  skip: { label: '--', codes: ['yellow'] },
  error: { label: '!!', codes: ['red'] },
};

export const colorEnabled = Boolean(
  process.stdout.isTTY
    && !process.env.NO_COLOR
    && process.env.TERM !== 'dumb',
);

const tone = (text, codes, color) => (
  color ? `${codes.map((code) => ANSI[code]).join('')}${text}${ANSI.reset}` : text
);

const row = (label, value) => `  ${label.padEnd(17)} ${value}`;

export function renderBanner({ color = colorEnabled } = {}) {
  const width = 62;
  const border = `+${'-'.repeat(width - 2)}+`;
  const line = (text = '') => `| ${text.padEnd(width - 4)} |`;
  return [
    tone(border, ['cyan'], color),
    tone(line('NEXERA SETUP'), ['bold', 'cyan'], color),
    line('Configuración guiada, portable y sin valores hardcodeados.'),
    line(),
    line('VPS: Node + MySQL  |  Cloudflare: Workers + D1'),
    tone(border, ['cyan'], color),
  ].join('\n');
}

export function renderSection(step, total, title, description = '', { color = colorEnabled } = {}) {
  const heading = `[${step}/${total}] ${title.toUpperCase()}`;
  return [
    '',
    tone(heading, ['bold', 'cyan'], color),
    ...(description ? [tone(description, ['dim'], color)] : []),
  ].join('\n');
}

export function resolveChoice(input, options) {
  const normalized = String(input ?? '').trim().toLowerCase();
  const index = /^[1-9]\d*$/.test(normalized) ? Number(normalized) - 1 : -1;
  if (options[index]) return options[index].value;
  return options.find((option) => option.value.toLowerCase() === normalized)?.value;
}

export function renderChoiceMenu(options, current, { color = colorEnabled } = {}) {
  return options.map((option, index) => {
    const selected = option.value === current ? tone('  actual', ['green'], color) : '';
    return [
      `  ${tone(String(index + 1), ['bold', 'cyan'], color)}  ${tone(option.label, ['bold'], color)}${selected}`,
      `     ${tone(option.description, ['dim'], color)}`,
    ].join('\n');
  }).join('\n');
}

export function renderConfigurationSummary(config, { color = colorEnabled } = {}) {
  const secretStates = config.secrets
    .map(([name, value]) => `${name}=<${value ? 'configurado' : 'vacío'}>`)
    .join(', ');
  const rows = [
    ['Destino', config.target === 'node' ? 'VPS / Node.js' : 'Cloudflare Workers'],
    ['Sitio', `${config.siteName} · ${config.siteUrl}`],
    ['Base de datos', `${config.database}${config.noDb ? ' (sin validar ni aplicar)' : ''}`],
    ['Correo', config.mail],
    ['Analítica', config.analytics],
    ['Captcha', config.captcha],
    ['Secretos', secretStates],
    ['Archivos', config.files],
  ];
  return [
    tone('Revisa antes de aplicar', ['bold', 'yellow'], color),
    ...rows.map(([label, value]) => row(label, value)),
    tone('  Los valores secretos nunca se muestran.', ['dim'], color),
  ].join('\n');
}

export function renderStatus(status, message, { color = colorEnabled } = {}) {
  const { label, codes } = STATUS[status] ?? STATUS.pending;
  return `${tone(`[${label}]`, codes, color)} ${message}`;
}

export function renderNextSteps(target, { color = colorEnabled } = {}) {
  const heading = tone('PRÓXIMOS PASOS', ['bold', 'cyan'], color);
  const steps = target === 'node'
    ? [
        'Revisa .env y guárdalo en /opt/nexera/.env con permisos 0640.',
        'Construye el servidor: npm run build:node',
        'Instala deploy/nexera.service y deploy/nginx.conf en el VPS.',
        'Apunta el DNS al VPS, activa TLS y verifica el formulario.',
      ]
    : [
        'Revisa wrangler.jsonc y confirma el binding DB.',
        'Construye el Worker: npm run build:cf',
        'Publica: npm run deploy',
        'Asocia el dominio en Workers & Pages y verifica el formulario.',
      ];
  return [heading, ...steps.map((step, index) => `  ${index + 1}. ${step}`)].join('\n');
}
