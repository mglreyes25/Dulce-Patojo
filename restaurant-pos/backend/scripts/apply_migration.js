const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Key length:', supabaseKey?.length);
console.log('Key prefix:', supabaseKey?.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  // Check if stock columns exist
  console.log('\n--- Checking productos table ---');
  const { data: prod, error: prodErr } = await supabase
    .from('productos')
    .select('id, nombre, stock, stock_minimo')
    .limit(3);

  if (prodErr) {
    console.error('Error querying productos:', JSON.stringify(prodErr, null, 2));
  } else {
    console.log('Productos query OK, rows:', prod?.length);
    if (prod && prod.length > 0) {
      console.log('Sample row keys:', Object.keys(prod[0]));
      console.log('stock:', prod[0].stock);
      console.log('stock_minimo:', prod[0].stock_minimo);
    } else {
      console.log('No products found - table might be empty');
    }
  }

  // Check if inventario_movimientos exists
  console.log('\n--- Checking inventario_movimientos table ---');
  const { data: mov, error: movErr } = await supabase
    .from('inventario_movimientos')
    .select('id')
    .limit(1);

  if (movErr) {
    console.error('Error:', JSON.stringify(movErr, null, 2));
  } else {
    console.log('Table exists OK');
  }

  // Try to apply migration via Management API if possible
  // First check if there's a supabase management API token
  if (process.env.SUPABASE_MANAGEMENT_TOKEN) {
    console.log('\n--- Applying migration via Management API ---');
    const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
    const sql = `
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_minimo integer DEFAULT 0;
      CREATE TABLE IF NOT EXISTS inventario_movimientos (
        id SERIAL PRIMARY KEY,
        producto_id integer REFERENCES productos(id) ON DELETE CASCADE,
        tipo varchar(20) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
        cantidad integer NOT NULL,
        stock_anterior integer NOT NULL,
        stock_nuevo integer NOT NULL,
        descripcion text,
        usuario_id integer REFERENCES usuarios(id),
        creado_en timestamptz DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_producto ON inventario_movimientos(producto_id);
      CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_fecha ON inventario_movimientos(creado_en DESC);
    `;
    
    try {
      const response = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_MANAGEMENT_TOKEN}`,
          },
          body: JSON.stringify({ query: sql }),
        }
      );
      const result = await response.text();
      console.log('Management API response:', response.status, result.substring(0, 500));
    } catch (e) {
      console.error('Management API error:', e.message);
    }
  } else {
    console.log('\n⚠️ No SUPABASE_MANAGEMENT_TOKEN found.');
    console.log('To apply the migration, run this SQL in your Supabase Dashboard SQL Editor:');
    console.log('='.repeat(60));
    const fs = require('fs');
    const migrationSQL = fs.readFileSync(require('path').join(__dirname, '..', 'sql', 'migracion_inventario.sql'), 'utf8');
    console.log(migrationSQL);
  }
}

main().catch(console.error);
