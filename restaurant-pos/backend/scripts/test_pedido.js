// Test: start server, create pedido, capture error
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'src', 'server.js');
const server = spawn('node', [serverPath], {
  cwd: path.join(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let serverOutput = '';

server.stdout.on('data', d => { serverOutput += d.toString(); });
server.stderr.on('data', d => { serverOutput += d.toString(); });

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (serverOutput.includes('Servidor corriendo')) {
      console.log('Server started');
      return true;
    }
  }
  console.log('Server output:', serverOutput);
  return false;
}

async function test() {
  const started = await waitForServer();
  if (!started) { console.log('Server failed to start'); server.kill(); return; }

  try {
    // Login
    const loginRes = await fetch('http://localhost:5000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'test@prueba.com', password: 'Test1234!' })
    });
    const loginData = await loginRes.json();
    console.log('Login:', loginData.message || loginData.error);
    const token = loginData.token;

    // Create pedido
    const pedidoRes = await fetch('http://localhost:5000/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        items: [{ id: 1, tipo: 'producto', nombre: 'Test', precio: 5.00, cantidad: 1 }],
        tipo: 'en_mesa',
        mesa_id: 1,
        cliente_nombre: 'Test',
        notas: 'Test pedido'
      })
    });
    const pedidoData = await pedidoRes.json();
    console.log('Pedido status:', pedidoRes.status);
    console.log('Pedido response:', JSON.stringify(pedidoData));
    if (!pedidoRes.ok) {
      console.log('\n=== SERVER LOGS (last 2000 chars) ===');
      console.log(serverOutput.slice(-2000));
    }
  } catch (e) {
    console.log('Fetch error:', e.message);
    console.log('\n=== SERVER LOGS ===');
    console.log(serverOutput);
  }

  server.kill();
}

test();
