const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });

const sql = `
ALTER TABLE productos ADD COLUMN IF NOT EXISTS exento_iva BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS iva DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS total_con_iva DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS iva DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS subtotal_sin_iva DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS total_con_iva DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS direccion_entrega TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cargo_envio DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS propina DECIMAL(12,2) NOT NULL DEFAULT 0;
`;

async function main() {
  console.log('Ejecutando migración IVA contra Supabase...');
  console.log('URL:', supabaseUrl);

  // Try via supabase.rpc with various function names
  const attempts = ['exec_sql', 'execute_sql', 'run_sql', 'pg_query'];
  for (const fn of attempts) {
    try {
      const { data, error } = await supabase.rpc(fn, { query: sql });
      if (!error) {
        console.log(`✅ ${fn}(): ${JSON.stringify(data)}`);
        return;
      }
      console.log(`❌ ${fn}(): ${error.message}`);
    } catch (e) {
      console.log(`❌ ${fn}(): ${e.message}`);
    }
  }

  // Try direct HTTP to various Supabase endpoints
  const endpoints = [
    '/rest/v1/rpc/exec_sql',
    '/pg/v1/sql',
    '/api/sql',
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(supabaseUrl + ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ query: sql })
      });
      const text = await r.text();
      if (r.ok) {
        console.log(`✅ ${ep}: OK`);
        return;
      }
      console.log(`❌ ${ep} (${r.status}): ${text.substring(0, 200)}`);
    } catch (e) {
      console.log(`❌ ${ep}: ${e.message}`);
    }
  }

  // Use the _supabase GraphQL endpoint
  try {
    const r = await fetch(supabaseUrl + '/graphql/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ query: 'mutation { executeSQL(sql: "' + sql.replace(/"/g, '\\"') + '") }' })
    });
    const text = await r.text();
    console.log(`⚠ GraphQL (${r.status}): ${text.substring(0, 200)}`);
  } catch (e) {
    console.log(`❌ GraphQL: ${e.message}`);
  }

  console.log('\n⚠ No se pudo ejecutar automáticamente.');
  console.log('Por favor, abre el Dashboard de Supabase > SQL Editor y pega este SQL:\n');
  console.log(sql);
}

main().catch(console.error);
