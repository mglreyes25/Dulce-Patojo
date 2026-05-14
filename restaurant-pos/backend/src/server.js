const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes        = require('./routes/authRoutes');
const usuariosRoutes    = require('./routes/usuariosRoutes');
const productosRoutes   = require('./routes/productosRoutes');
const promocionesRoutes = require('./routes/promocionesRoutes');
const inventarioRoutes  = require('./routes/inventarioRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/auth',        authRoutes);
app.use('/usuarios',    usuariosRoutes);
app.use('/productos',   productosRoutes);
app.use('/promociones', promocionesRoutes);
app.use('/inventario',  inventarioRoutes);

app.get('/', (req, res) => res.json({ message: '🚀 Backend Restaurant POS funcionando' }));

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});