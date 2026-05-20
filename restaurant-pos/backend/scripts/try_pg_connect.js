require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const ref = 'cdwhivhfugifnwufhtpz';
const host = 'db.' + ref + '.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY;

async function tryConnect() {
  const client = new Client({
    host,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: key,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    console.log('Connected!');
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('Schema reload triggered');
    const r = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tables:', r.rows.map(t => t.table_name).join(', '));

    // Check if ingredientes has proveedor_id
    const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='ingredientes'");
    console.log('ingredientes columns:', cols.rows.map(c => c.column_name).join(', '));

    await client.end();
  } catch (e) {
    console.log('Failed:', e.message);
  }
}
tryConnect();
