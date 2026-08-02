#!/usr/bin/env node

import { createRequire } from 'node:module';

// Astro templates still need the TypeScript 6 programmatic API, which the `@volar/kit`
// override keeps isolated in a nested dependency. Resolve it exactly as Volar does.
const require = createRequire(import.meta.url);
const languageServerRequire = createRequire(require.resolve('@astrojs/language-server'));
const volarRequire = createRequire(languageServerRequire.resolve('@volar/kit'));
const legacyTypeScript = volarRequire.resolve('typescript');

const { AstroCheck } = await import('@astrojs/language-server');
const checker = new AstroCheck(process.cwd(), legacyTypeScript, 'tsconfig.json');
const result = await checker.lint({ logErrors: { level: 'hint' } });

console.info(
  `Astro templates (${result.fileChecked} files): ${result.errors} errors, ${result.warnings} warnings, ${result.hints} hints`,
);

if (result.errors > 0) process.exitCode = 1;
