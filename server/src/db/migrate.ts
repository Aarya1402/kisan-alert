import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from './pool.js';

// Read schema from the source tree relative to cwd (npm runs from server/),
// so this works identically whether run via tsx, node, or an esbuild bundle.
function schemaPath(): string {
  const candidates = [
    join(process.cwd(), 'src/db/schema.sql'),
    join(process.cwd(), 'dist/schema.sql'),
    join(process.cwd(), 'schema.sql'),
  ];
  return candidates.find(existsSync) || candidates[0];
}

async function main() {
  const sql = readFileSync(schemaPath(), 'utf8');
  await pool.query(sql);
  console.log('✓ Schema applied');
  await pool.end();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
