/**
 * server/local-db.ts
 * Starts the project-local PostgreSQL cluster (binaries from embedded-postgres).
 * Data persists in ./.pgdata between runs. No system-wide install or admin
 * rights required. Run with: npm run db
 */

import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const DATA_DIR = path.join(ROOT, '.pgdata');
const PORT = Number(process.env.PGPORT || 5432);
const USER = process.env.PGUSER || 'postgres';
const PASSWORD = process.env.PGPASSWORD || 'postgres';
const DATABASE = process.env.PGDATABASE || 'police_municipale';

// Cache and write settings tuned for small, read-heavy local workloads.
// Each tuning option is passed as "-c", "name=value" (separate argv entries).
const tuning: [string, string][] = [
  ['listen_addresses', '127.0.0.1'],
  ['shared_buffers', '256MB'],
  ['effective_cache_size', '768MB'],
  ['work_mem', '16MB'],
  ['maintenance_work_mem', '64MB'],
  ['random_page_cost', '1.1'],
  ['max_connections', '30'],
  ['wal_compression', 'on'],
  ['log_min_duration_statement', '250'],
];
const postgresFlags = tuning.flatMap(([key, value]) => ['-c', `${key}=${value}`]);

// UTF-8 encoding is required for Arabic text.
const initdbFlags = ['--encoding=UTF8', '--locale=C'];

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: USER,
  password: PASSWORD,
  persistent: true,
  autoRehydrateSymlinks: true,
  initdbFlags,
  postgresFlags,
});

function isInitialised(): boolean {
  return fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));
}

async function ensureDatabase(): Promise<void> {
  const client = pg.getPgClient('postgres');
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DATABASE]);
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${DATABASE}"`);
      console.log(`🗄️  Created database "${DATABASE}"`);
    }
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  if (!isInitialised()) {
    console.log('📦 Initialising PostgreSQL cluster in .pgdata ...');
    await pg.initialise();
  }

  await pg.start();
  await ensureDatabase();

  console.log(`✅ PostgreSQL ready on postgresql://${USER}:****@127.0.0.1:${PORT}/${DATABASE}`);
  console.log('   Press Ctrl+C to stop the database.');
}

async function shutdown(): Promise<void> {
  try {
    await pg.stop();
    console.log('\n🛑 PostgreSQL stopped.');
  } catch (err) {
    console.error('Error while stopping PostgreSQL:', err);
  }
}

process.on('SIGINT', () => void shutdown().then(() => process.exit(0)));
process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)));

main().catch(async (err) => {
  console.error('❌ Failed to start local PostgreSQL:', err ?? 'postgres exited unexpectedly (see log above)');
  await shutdown();
  process.exit(1);
});

export { pg, PORT as LOCAL_PG_PORT, DATABASE as LOCAL_PG_DATABASE };
