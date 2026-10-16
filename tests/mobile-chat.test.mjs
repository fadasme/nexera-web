import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('el chat móvil se adapta al viewport visible al abrir el teclado', async () => {
  const [script, component] = await Promise.all([
    source('src/scripts/chatbox.ts'),
    source('src/components/Chatbox.astro'),
  ]);

  assert.match(script, /visualViewport\?\.addEventListener\('resize'/);
  assert.match(script, /visualViewport\?\.addEventListener\('scroll'/);
  assert.match(script, /input\.addEventListener\('focus'/);
  assert.match(script, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /--chat-viewport-height, 100dvh/);
  assert.match(component, /\.chatbox\.is-input-focused \.window/);
  assert.match(component, /min-height: 0;/);
});
