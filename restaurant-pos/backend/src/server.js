process.env.TZ = 'America/El_Salvador';

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes        = require('./routes/authRoutes');
const usuariosRoutes    = require('./routes/usuariosRoutes');
const productosRoutes   = require('./routes/productosRoutes');
const promocionesRoutes = require('./routes/promocionesRoutes');
const inventarioRoutes  = require('./routes/inventarioRoutes');
const pedidosRoutes     = require('./routes/pedidosRoutes');
const mesasRoutes       = require('./routes/mesasRoutes');
const ingredientesRoutes = require('./routes/ingredientesRoutes');
const recetasRoutes     = require('./routes/recetasRoutes');
const proveedoresRoutes = require('./routes/proveedoresRoutes');
const pagosRoutes       = require('./routes/pagosRoutes');
const cajaRoutes        = require('./routes/cajaRoutes');
const reportesRoutes    = require('./routes/reportesRoutes');
const { initSocket }    = require('./config/socket');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', true);
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

app.use('/auth',        authRoutes);
app.use('/usuarios',    usuariosRoutes);
app.use('/productos',   productosRoutes);
app.use('/promociones', promocionesRoutes);
app.use('/inventario',  inventarioRoutes);
app.use('/pedidos',     pedidosRoutes);
app.use('/mesas',         mesasRoutes);
app.use('/ingredientes',  ingredientesRoutes);
app.use('/recetas',       recetasRoutes);
app.use('/proveedores',   proveedoresRoutes);
app.use('/pagos',         pagosRoutes);
app.use('/api/caja',      cajaRoutes);
app.use('/api/reportes',  reportesRoutes);

const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT} con WebSocket`);
});
