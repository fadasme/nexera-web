import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = () =>
  readFile(new URL('../scripts/migrate-php.mjs', import.meta.url), 'utf8');

test('la detección de autocopia funciona en MySQL y MariaDB', async () => {
  const migration = await source();
  assert.match(migration, /@@hostname\s+AS\s+serverHost/i);
  assert.doesNotMatch(migration, /@@server_uuid/i);
});

test('el paginado parametrizado es compatible con MySQL 8', async () => {
  const migration = await source();
  const batches = migration.slice(
    migration.indexOf('async function readBatches'),
    migration.indexOf('function insertBatch'),
  );
  assert.match(batches, /connection\.query\([\s\S]*?LIMIT \? OFFSET \?`[\s\S]*?\[batchSize, offset\]/);
});
