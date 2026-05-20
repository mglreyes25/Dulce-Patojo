// Direct test of crearPedido logic
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function test() {
  console.log('1. Testing insert into pedidos...');
  const pedidoInsert = {
    numero_ticket: 9999,
    tipo: 'en_mesa',
    mesa_id: 1,
    estado: 'recibido',
    subtotal: 10,
    descuento: 0,
    total: 10,
    usuario_id: 18,
    notas: 'test',
  };
  
  // Try with IVA fields
  const r1 = await supabase.from('pedidos').insert({ ...pedidoInsert, iva: 1.30, total_con_iva: 11.30 }).select().single();
  console.log('  With IVA:', r1.error ? 'FAIL: ' + r1.error.message : 'OK id=' + r1.data?.id);
  
  if (r1.data?.id) {
    await supabase.from('pedidos').delete().eq('id', r1.data.id);
    console.log('  Cleaned up test pedido');
  }

  console.log('\n2. Testing insert into pedido_items...');
  const r2 = await supabase.from('pedido_items').insert({
    pedido_id: 1,
    producto_id: 1,
    tipo_item: 'producto',
    nombre: 'Test',
    cantidad: 1,
    precio_unitario: 5.00,
  }).select().single();
  console.log('  pedido_items:', r2.error ? 'FAIL: ' + r2.error.message : 'OK');

  console.log('\n3. Testing insert into bitacora_permisos...');
  const r3 = await supabase.from('bitacora_permisos').insert({
    usuario_id: 18, accion: 'TEST', descripcion: 'test'
  }).select().single();
  console.log('  bitacora:', r3.error ? 'FAIL: ' + r3.error.message : 'OK');

  console.log('\n4. Testing query productos exento_iva...');
  const r4 = await supabase.from('productos').select('exento_iva').eq('id', 99999).maybeSingle();
  console.log('  producto nonexistent:', r4.error ? 'FAIL: ' + r4.error.message : 'data=' + JSON.stringify(r4.data));

  console.log('\n5. Testing descontarStock logic...');
  const r5 = await supabase.from('productos').select('id, nombre, stock').eq('id', 1).single();
  console.log('  producto 1:', r5.error ? 'FAIL: ' + r5.error.message : 'stock=' + r5.data?.stock);

  console.log('\n6. Testing inventario_movimientos...');
  const r6 = await supabase.from('inventario_movimientos').insert({
    producto_id: 1, tipo: 'salida', cantidad: 1,
    stock_anterior: 10, stock_nuevo: 9,
    descripcion: 'test', usuario_id: 18,
  }).select().single();
  console.log('  inventario_movimientos:', r6.error ? 'FAIL: ' + r6.error.message : 'OK');

  console.log('\n7. Testing combo_productos...');
  const r7 = await supabase.from('combo_productos').select('*').limit(1);
  console.log('  combo_productos:', r7.error ? 'FAIL: ' + r7.error.message : (r7.data?.length || 0) + ' rows');

  console.log('\n8. Testing promociones query...');
  const r8 = await supabase.from('promociones').select('producto_id').eq('id', 1).maybeSingle();
  console.log('  promocion 1:', r8.error ? 'FAIL: ' + r8.error.message : JSON.stringify(r8.data));

  console.log('\n✅ Tests completed');
}
test().catch(console.error);
