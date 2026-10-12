import pg from 'pg';

// Import a dated public municipality directory into PostgreSQL. This is an
// explicit operator task (not a request-time scrape or a client-side fixture).
// Review the source when municipal boundaries/names change before reimporting.
const source = 'https://en.wikipedia.org/wiki/List_of_municipalities_in_South_Africa';
const response = await fetch(source);
if (!response.ok) throw new Error(`Municipality directory unavailable: HTTP ${response.status}`);
const html = await response.text();
const plain = (value) => value.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ').trim();
const municipalities = new Map();
// The source's first three municipality tables contain metros, districts and
// locals respectively. Later tables contain historical names and must not be used.
const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].slice(1, 4);
for (const table of tables) {
  for (const row of table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => plain(cell[1]));
    if (cells.length < 3) continue;
    const [name, code, province] = cells;
    if (!/^(?:DC\d+|[A-Z]{2,3}\d{3}|BUF|CPT|EKU|ETH|JHB|MAN|NMA|TSH)$/.test(code)) continue;
    if (!/Municipality$/.test(name)) continue;
    const kind = ['BUF', 'CPT', 'EKU', 'ETH', 'JHB', 'MAN', 'NMA', 'TSH'].includes(code) ? 'metropolitan' : code.startsWith('DC') ? 'district' : 'local';
    municipalities.set(code, { code, name, province, kind });
  }
}
// Reject a partial or changed source format instead of silently publishing an
// incomplete list. Expected: 8 metropolitan, 44 district and 205 local.
const counts = ['metropolitan', 'district', 'local'].map((kind) => [...municipalities.values()].filter((m) => m.kind === kind).length);
if (counts.join(',') !== '8,44,205') throw new Error(`Directory incomplete: metro/district/local = ${counts.join('/')}; no data imported`);
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before importing');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  for (const { code, name, province, kind } of municipalities.values()) {
    await client.query('INSERT INTO municipalities (code, name, province, kind) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, province = EXCLUDED.province, kind = EXCLUDED.kind', [code, name, province, kind]);
  }
  await client.query('COMMIT');
  console.log(`Imported ${municipalities.size} municipalities from ${source}`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
