const http = require('http');
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
const { initSocket }    = require('./config/socket');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
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

app.get('/', (req, res) => res.json({ message: '🚀 Backend Restaurant POS funcionando' }));

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT} con WebSocket`);
});
