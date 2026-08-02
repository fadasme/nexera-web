#!/usr/bin/env node

import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DESTINATION_COLUMNS = [
  'nombre',
  'email',
  'telefono',
  'empresa',
  'tamano_empresa',
  'servicio',
  'mensaje',
  'origen',
  'ip_hash',
  'user_agent',
  'created_at',
];
const DESTINATION_COLUMN_SET = new Set(DESTINATION_COLUMNS);
const REQUIRED_COLUMNS = new Set(['nombre', 'email', 'mensaje']);
const NON_NULL_COLUMNS = new Set([...REQUIRED_COLUMNS, 'created_at']);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const DEFAULT_BATCH_SIZE = 500;

class CliError extends Error {}

function help() {
  return `Migra contactos desde una tabla MySQL de un sitio PHP.

Uso:
  node scripts/migrate-php.mjs [opciones]

Opciones:
  --source-table <tabla>  Tabla MySQL fuente (por defecto: contactos)
  --map <viejo:nuevo,...> Renombra columnas; las columnas compatibles restantes
                          se detectan por su nombre lógico
  --limit <n>             Tamaño del lote; no limita el total (por defecto: 500)
  --dry-run               Lee y valida sin insertar; en Cloudflare emite SQL a stdout
  --out <archivo>         Guarda el SQL D1 en el archivo indicado (solo Cloudflare)
  --help, -h              Muestra esta ayuda

Se aceptan también --opcion=valor. Las credenciales fuente usan OLD_MYSQL_*
con fallback por variable a MYSQL_*. DEPLOY_TARGET debe ser node o cloudflare.`;
}

function parseArgs(argv) {
  const options = {
    sourceTable: 'contactos',
    map: '',
    limit: DEFAULT_BATCH_SIZE,
    dryRun: false,
    out: undefined,
    help: false,
  };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--dry-run') {
      if (seen.has('dry-run')) throw new CliError('La opción --dry-run está repetida.');
      seen.add('dry-run');
      options.dryRun = true;
      continue;
    }
    if (!argument.startsWith('--')) {
      throw new CliError(`Argumento inesperado: ${argument}`);
    }

    const separator = argument.indexOf('=');
    const name = argument.slice(2, separator === -1 ? undefined : separator);
    if (!['source-table', 'map', 'limit', 'out'].includes(name)) {
      throw new CliError(`Opción desconocida: --${name}`);
    }
    if (seen.has(name)) throw new CliError(`La opción --${name} está repetida.`);
    seen.add(name);

    let value = separator === -1 ? undefined : argument.slice(separator + 1);
    if (value === undefined) {
      value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new CliError(`Falta el valor de --${name}.`);
      }
      index += 1;
    }
    if (value.length === 0) throw new CliError(`El valor de --${name} no puede estar vacío.`);

    if (name === 'source-table') options.sourceTable = value;
    if (name === 'map') options.map = value;
    if (name === 'out') options.out = value;
    if (name === 'limit') {
      const limit = Number(value);
      if (!Number.isSafeInteger(limit) || limit <= 0) {
        throw new CliError('--limit debe ser un entero positivo.');
      }
      options.limit = limit;
    }
  }

  assertIdentifier(options.sourceTable, 'tabla fuente');
  return options;
}

function assertIdentifier(value, label) {
  if (!IDENTIFIER.test(value)) {
    throw new CliError(
      `Nombre de ${label} inválido: "${value}". Usa solo letras ASCII, números y guion bajo; no puede comenzar con un número.`,
    );
  }
}

function parseMap(value) {
  if (!value) return new Map();

  const mappings = new Map();
  const sources = new Set();
  for (const entry of value.split(',')) {
    const parts = entry.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new CliError(`Mapeo inválido: "${entry}". Usa viejo:nuevo,otro:destino.`);
    }
    const [source, destination] = parts;
    assertIdentifier(source, 'columna fuente');
    assertIdentifier(destination, 'columna destino');
    if (!DESTINATION_COLUMN_SET.has(destination)) {
      throw new CliError(
        `Columna destino no permitida: "${destination}". Permitidas: ${DESTINATION_COLUMNS.join(', ')}.`,
      );
    }
    const sourceKey = source.toLowerCase();
    if (sources.has(sourceKey)) throw new CliError(`Columna fuente repetida en --map: "${source}".`);
    if (mappings.has(destination)) {
      throw new CliError(`Columna destino repetida en --map: "${destination}".`);
    }
    sources.add(sourceKey);
    mappings.set(destination, source);
  }
  return mappings;
}

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trimStart();

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (value.startsWith("'")) {
      if (!value.endsWith("'")) throw new CliError(`Comilla simple sin cerrar en .env: ${key}.`);
      value = value.slice(1, -1);
    } else if (value.startsWith('"')) {
      if (!value.endsWith('"')) throw new CliError(`Comilla doble sin cerrar en .env: ${key}.`);
      value = value.slice(1, -1).replace(/\\([nrt"\\])/g, (_, escaped) => {
        return { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' }[escaped];
      });
    } else {
      value = value.replace(/\s+#.*$/, '').trimEnd();
    }
    values[key] = value;
  }
  return values;
}

async function loadEnvironment() {
  let fileValues = {};
  try {
    fileValues = parseEnv(await readFile(resolve('.env'), 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      if (error instanceof CliError) throw error;
      throw new CliError(`No se pudo leer .env: ${errorMessage(error)}`);
    }
  }
  return { ...fileValues, ...process.env };
}

function envValue(environment, key) {
  const value = environment[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function mysqlConfig(environment, prefix, fallbackPrefix) {
  const get = (suffix) =>
    envValue(environment, `${prefix}${suffix}`) ??
    (fallbackPrefix ? envValue(environment, `${fallbackPrefix}${suffix}`) : undefined);
  const host = get('HOST');
  const user = get('USER');
  const database = get('DATABASE');
  if (!host || !user || !database) {
    const names = [`${prefix}HOST`, `${prefix}USER`, `${prefix}DATABASE`];
    const fallback = fallbackPrefix ? ` (con fallback a ${fallbackPrefix}*)` : '';
    throw new CliError(`Faltan credenciales MySQL: ${names.join(', ')}${fallback}.`);
  }

  const rawPort = get('PORT') ?? '3306';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new CliError(`${prefix}PORT debe ser un puerto válido.`);
  }

  return {
    host,
    port,
    user,
    password: get('PASSWORD') ?? '',
    database,
    charset: 'utf8mb4',
    dateStrings: true,
    multipleStatements: false,
  };
}

async function connectMysql(mysql, config, label) {
  try {
    return await mysql.createConnection(config);
  } catch (error) {
    throw new CliError(`No se pudo conectar a MySQL ${label}: ${errorMessage(error)}`);
  }
}

async function inspectSource(connection, database, table) {
  const [tables] = await connection.execute(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      LIMIT 1`,
    [database, table],
  );
  if (tables.length === 0) return undefined;

  const canonicalTable = String(tables[0].TABLE_NAME);
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`,
    [database, canonicalTable],
  );
  const [primaryKey] = await connection.execute(
    `SELECT COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION`,
    [database, canonicalTable],
  );
  return {
    table: canonicalTable,
    columns: columns.map((row) => String(row.COLUMN_NAME)),
    primaryKey: primaryKey.map((row) => String(row.COLUMN_NAME)),
  };
}

function resolveMappings(sourceColumns, requestedMappings) {
  const sourceByLowercase = new Map(sourceColumns.map((column) => [column.toLowerCase(), column]));
  const resolved = new Map();
  const usedSources = new Set();

  for (const [destination, requestedSource] of requestedMappings) {
    const source = sourceByLowercase.get(requestedSource.toLowerCase());
    if (!source) {
      throw new CliError(`La columna fuente "${requestedSource}" indicada en --map no existe.`);
    }
    resolved.set(destination, source);
    usedSources.add(source.toLowerCase());
  }

  for (const destination of DESTINATION_COLUMNS) {
    const source = sourceByLowercase.get(destination.toLowerCase());
    if (!resolved.has(destination) && source && !usedSources.has(source.toLowerCase())) {
      resolved.set(destination, source);
      usedSources.add(source.toLowerCase());
    }
  }

  const missing = [...REQUIRED_COLUMNS].filter((column) => !resolved.has(column));
  if (missing.length > 0) {
    throw new CliError(
      `Faltan columnas requeridas para contactos: ${missing.join(', ')}. Agrégalas con --map=vieja:nueva.`,
    );
  }

  return new Map(
    DESTINATION_COLUMNS.filter((column) => resolved.has(column)).map((column) => [column, resolved.get(column)]),
  );
}

function quoteMysqlIdentifier(identifier) {
  return `\`${identifier.replaceAll('`', '``')}\``;
}

async function readBatches(connection, sourceInfo, mappings, batchSize, onBatch) {
  const destinations = [...mappings.keys()];
  const selection = [...mappings]
    .map(([destination, source]) => `${quoteMysqlIdentifier(source)} AS ${quoteMysqlIdentifier(destination)}`)
    .join(', ');
  const orderColumns =
    sourceInfo.primaryKey.length > 0 ? sourceInfo.primaryKey : [...new Set(mappings.values())];
  const ordering = orderColumns.map(quoteMysqlIdentifier).join(', ');
  let offset = 0;

  while (true) {
    const [rows] = await connection.query(
      `SELECT ${selection}
         FROM ${quoteMysqlIdentifier(sourceInfo.table)}
        ORDER BY ${ordering}
        LIMIT ? OFFSET ?`,
      [batchSize, offset],
    );
    if (rows.length === 0) break;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      for (const column of destinations) {
        if (NON_NULL_COLUMNS.has(column) && rows[rowIndex][column] == null) {
          throw new CliError(`Fila ${offset + rowIndex + 1}: la columna "${column}" no puede ser NULL.`);
        }
      }
    }

    await onBatch(rows, destinations);
    offset += rows.length;
    if (rows.length < batchSize) break;
  }

  return offset;
}

async function insertBatch(connection, rows, columns) {
  const columnSql = columns.map(quoteMysqlIdentifier).join(', ');
  const tuple = `(${columns.map(() => '?').join(', ')})`;
  const values = rows.flatMap((row) => columns.map((column) => row[column] ?? null));
  await connection.execute(
    `INSERT INTO contactos (${columnSql}) VALUES ${rows.map(() => tuple).join(', ')}`,
    values,
  );
}

function sqlString(value) {
  const text = String(value);
  if (text.includes('\0')) {
    throw new CliError('D1 no admite bytes NUL en un literal SQL; corrige el dato fuente.');
  }
  return `'${text.replaceAll("'", "''")}'`;
}

function sqlLiteral(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CliError(`Valor numérico no importable en D1: ${value}.`);
    return String(value);
  }
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Buffer.isBuffer(value)) return sqlString(value.toString('utf8'));
  if (value instanceof Date) return sqlString(value.toISOString());
  if (typeof value === 'object') {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new TypeError('resultado indefinido');
      return sqlString(serialized);
    } catch (error) {
      throw new CliError(`Objeto no serializable para D1: ${errorMessage(error)}`);
    }
  }
  return sqlString(value);
}

function d1Inserts(rows, columns) {
  const columnSql = columns.map((column) => `"${column}"`).join(', ');
  return rows
    .map(
      (row) =>
        `INSERT INTO contactos (${columnSql}) VALUES (${columns
          .map((column) => sqlLiteral(row[column]))
          .join(', ')});\n`,
    )
    .join('');
}

async function createSqlWriter(outputPath, dryRun) {
  if (!outputPath || dryRun) {
    return {
      async write(chunk) {
        if (!process.stdout.write(chunk)) {
          await new Promise((accept) => process.stdout.once('drain', accept));
        }
      },
      async commit() {},
      async abort() {},
    };
  }

  const finalPath = resolve(outputPath);
  const temporaryPath = `${finalPath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(finalPath), { recursive: true });
  const file = await open(temporaryPath, 'wx');
  let closed = false;
  return {
    async write(chunk) {
      await file.write(chunk);
    },
    async commit() {
      await file.close();
      closed = true;
      await rename(temporaryPath, finalPath);
    },
    async abort() {
      if (!closed) await file.close().catch(() => {});
      await rm(temporaryPath, { force: true }).catch(() => {});
    },
  };
}

async function exportD1(source, sourceInfo, mappings, batchSize, outputPath, dryRun) {
  const writer = await createSqlWriter(outputPath, dryRun);
  try {
    await writer.write('-- Generado por scripts/migrate-php.mjs para Wrangler D1.\n');
    const total = await readBatches(source, sourceInfo, mappings, batchSize, async (rows, columns) => {
      await writer.write(d1Inserts(rows, columns));
    });
    await writer.commit();
    return total;
  } catch (error) {
    await writer.abort();
    throw error;
  }
}

async function startConsistentSnapshot(connection) {
  await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
}

async function databaseIdentity(connection) {
  const [rows] = await connection.query(
    'SELECT @@hostname AS serverHost, @@port AS serverPort, DATABASE() AS databaseName',
  );
  const row = rows[0];
  return `${row.serverHost}:${row.serverPort}:${row.databaseName}`;
}

async function sameDatabaseConnections(source, destination) {
  const [sourceIdentity, destinationIdentity] = await Promise.all([
    databaseIdentity(source),
    databaseIdentity(destination),
  ]);
  return sourceIdentity === destinationIdentity;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(help());
    return;
  }

  const requestedMappings = parseMap(options.map);
  const environment = await loadEnvironment();
  const target = envValue(environment, 'DEPLOY_TARGET') ?? 'node';
  if (target !== 'node' && target !== 'cloudflare') {
    throw new CliError(`DEPLOY_TARGET debe ser "node" o "cloudflare" (recibido: "${target}").`);
  }
  if (target === 'node' && options.out) {
    throw new CliError('--out solo se puede usar con DEPLOY_TARGET=cloudflare.');
  }

  const sourceConfig = mysqlConfig(environment, 'OLD_MYSQL_', 'MYSQL_');
  const destinationConfig =
    target === 'node' && !options.dryRun ? mysqlConfig(environment, 'MYSQL_') : undefined;

  const { default: mysql } = await import('mysql2/promise');
  const source = await connectMysql(mysql, sourceConfig, 'fuente');
  let destination;
  let snapshotStarted = false;

  try {
    const sourceInfo = await inspectSource(source, sourceConfig.database, options.sourceTable);
    if (!sourceInfo) {
      console.log(
        `La tabla fuente "${options.sourceTable}" no existe en la base "${sourceConfig.database}". No se migró nada.`,
      );
      return;
    }
    const mappings = resolveMappings(sourceInfo.columns, requestedMappings);
    await startConsistentSnapshot(source);
    snapshotStarted = true;

    if (target === 'cloudflare') {
      const total = await exportD1(
        source,
        sourceInfo,
        mappings,
        options.limit,
        options.out,
        options.dryRun,
      );
      if (options.out && !options.dryRun) {
        console.log(`SQL D1 generado en ${options.out}: ${total} contacto(s).`);
      } else {
        console.error(
          `${options.dryRun ? 'Dry-run' : 'SQL D1 emitido'}: ${total} contacto(s); no se modificó ninguna base destino.`,
        );
      }
      return;
    }

    if (!options.dryRun) {
      destination = await connectMysql(mysql, destinationConfig, 'destino');
      if (
        sourceInfo.table.toLowerCase() === 'contactos' &&
        (await sameDatabaseConnections(source, destination))
      ) {
        throw new CliError(
          'La tabla fuente y contactos destino son la misma; se canceló para evitar una autocopia.',
        );
      }
    }
    const total = await readBatches(
      source,
      sourceInfo,
      mappings,
      options.limit,
      options.dryRun ? async () => {} : (rows, columns) => insertBatch(destination, rows, columns),
    );
    console.log(
      options.dryRun
        ? `Dry-run completado: ${total} contacto(s) válidos; no se insertó nada.`
        : `Migración completada: ${total} contacto(s) insertados en MySQL.`,
    );
  } finally {
    if (snapshotStarted) await source.rollback().catch(() => {});
    await Promise.allSettled([source.end(), destination?.end()]);
  }
}

run().catch((error) => {
  console.error(`Error: ${errorMessage(error)}`);
  process.exitCode = 1;
});
