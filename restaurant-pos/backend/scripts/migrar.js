const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id', { count: 'exact', head: true });
    if (error && error.code === '42P01') return false;
    if (error) throw error;
    return true;
  } catch (e) {
    if (e.code === '42P01') return false;
    console.error(`Error checking ${tableName}:`, e.message);
    return false;
  }
}

async function runSQLViaFetch(sql) {
  const url = `${supabaseUrl}/rest/v1/rpc/`;
  const response = await fetch(`${supabaseUrl}/sql/v1/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ query: sql })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SQL error (${response.status}): ${text}`);
  }
  return response.json();
}

async function runSQL(sql, label) {
  console.log(`\n--- ${label} ---`);
  try {
    // Try the sql/v1/sql endpoint first
    const response = await fetch(`${supabaseUrl}/sql/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: sql })
    });
    if (response.ok) {
      console.log(`OK: ${label}`);
      return;
    }
    const text = await response.text();
    console.log(`sql/v1 failed (${response.status}): ${text.substring(0, 200)}`);
  } catch (e) {
    console.log(`sql/v1 error: ${e.message}`);
  }
  // Try via pg query with direct connection
  console.log(`Attempting direct pg connection...`);
  try {
    const { Client } = require('pg');
    const dbUrl = `postgresql://postgres:${encodeURIComponent(supabaseServiceKey)}@db.${new URL(supabaseUrl).hostname.replace('.supabase.co', '')}.supabase.co:5432/postgres`;
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query(sql);
    await client.end();
    console.log(`OK (pg direct): ${label}`);
  } catch (e2) {
    console.log(`pg direct error: ${e2.message}`);
    console.log(`\n⚠ No se pudo ejecutar automáticamente.`);
    console.log(`Ejecuta este SQL en el Dashboard de Supabase > SQL Editor:\n`);
    console.log(sql);
  }
}

async function main() {
  console.log('Supabase URL:', supabaseUrl);
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  console.log('Project ref:', ref);

  const migraciones = [
    { file: '../sql/migracion_recetas.sql', label: 'Migración Recetas/Ingredientes' },
    { file: '../sql/migracion_iva.sql', label: 'Migración IVA/Propinas/Domicilio' }
  ];

  for (const mig of migraciones) {
    const sqlPath = path.join(__dirname, mig.file);
    if (!fs.existsSync(sqlPath)) {
      console.log(`Archivo no encontrado: ${sqlPath}`);
      continue;
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await runSQL(sql, mig.label);
  }

  console.log('\n✅ Proceso de migración completado.');
}

main().catch(console.error);
