import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const colorToken = (css, name) => {
  const value = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  assert.ok(value, `Falta el token --${name}`);
  return value;
};

const luminance = (hex) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (foreground, background) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

test('el sitemap excluye la página noindex de gracias con o sin slash final', async () => {
  const [config, thanksPage, seo] = await Promise.all([
    source('astro.config.mjs'),
    source('src/pages/gracias.astro'),
    source('src/components/Seo.astro'),
  ]);

  assert.ok(
    config.includes("filter: (page) => !/\\/gracias\\/?$/.test(page)"),
    'El filtro debe excluir /gracias y /gracias/',
  );
  assert.match(thanksPage, /<Layout[\s\S]*?\bnoindex\b[\s\S]*?>/);
  assert.match(seo, /noindex\s*&&\s*<meta name="robots" content="noindex"/);
});

test('el title SEO conserva la marca configurable y cabe en resultados', async () => {
  const [page, site] = await Promise.all([
    source('src/pages/index.astro'),
    source('src/config/site.ts'),
  ]);
  assert.match(page, /title=\{site\.seoTitle\}/);
  assert.match(site, /const name = env\.PUBLIC_SITE_NAME \?\? 'Nexera';/);
  assert.match(site, /\n\s*name,\n/);

  const suffix = site.match(/seoTitle:\s*`\$\{name\}([^`]+)`/)?.[1];
  assert.ok(suffix, 'site.seoTitle debe interpolar name');
  const defaultTitle = `Nexera${suffix}`;
  assert.ok(
    [...defaultTitle].length <= 60,
    `El title predeterminado tiene ${[...defaultTitle].length} caracteres`,
  );
});

test('los textos pequeños apagados mantienen contraste AA', async () => {
  const css = await source('src/styles/global.css');
  const pairs = [
    ['text-mute', 'bg'],
    ['text-mute', 'bg-alt'],
    ['text-mute-2', 'bg'],
    ['text-warm', 'bg-panel'],
  ];

  for (const [foreground, background] of pairs) {
    const ratio = contrast(colorToken(css, foreground), colorToken(css, background));
    assert.ok(ratio >= 4.5, `--${foreground} sobre --${background}: ${ratio.toFixed(2)}:1`);
  }
});

test('el timeline usa su texto visible como nombre accesible nativo', async () => {
  const process = await source('src/components/Proceso.astro');
  const buttonStart = process.indexOf('<button');
  const buttonTag = process.slice(buttonStart, process.indexOf('>', buttonStart) + 1);

  assert.doesNotMatch(buttonTag, /\baria-label=/);
  assert.match(process, /<span class="num">\{p\.num\}<\/span>/);
  assert.match(process, /<span class="title">\{p\.title\}<\/span>/);
});

test('el schema reserva LocalBusiness para una calle y conserva la localidad', async () => {
  const jsonLd = await source('src/components/JsonLd.astro');
  assert.match(jsonLd, /const hasAddress = Boolean\(site\.street\.trim\(\)\);/);
  assert.match(jsonLd, /const hasLocality = Boolean\(/);
  assert.match(jsonLd, /if \(hasAddress \|\| hasLocality\)/);
  assert.match(jsonLd, /hasAddress \? \{ streetAddress: site\.street\.trim\(\) \} : \{\}/);
  assert.doesNotMatch(jsonLd, /site\.street\s*\|\|\s*site\.city/);
});
