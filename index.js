require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Pedido = require('./models/Pedido');
// IMPORTANTE: Importamos el controlador de pagos que acabamos de crear
const {generarQROficial} = require('./controllers/paymentConroller');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

app.use(cors());
app.use(express.json());

// ─── Conexión MongoDB ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch((err) => console.error('❌ Error MongoDB:', err));

// ─── Middleware admin ────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ─── RUTAS ───────────────────────────────────────────────────────────────────

// POST /pedidos — Guardar un pedido nuevo (llamado desde la app)
app.post('/pedidos', async (req, res) => {
  try {
    const { nombre, items, total } = req.body;

    if (!nombre || !items || !total) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const pedido = new Pedido({ nombre, items, total });
    await pedido.save();

    res.status(201).json({ ok: true, id: pedido._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando el pedido' });
  }
});

// NUEVA RUTA: POST /pedidos/generar-qr-oficial — Solicita el QR transaccional a Bancolombia
// Simplemente le pasamos la función que importamos del controlador
app.post('/pedidos/generar-qr-oficial', generarQrOficial);

// GET /admin/pedidos — Ver todos los pedidos (panel admin)
app.get('/admin/pedidos', requireAdmin, async (req, res) => {
  try {
    const { desde, hasta, nombre } = req.query;
    const filtro = {};

    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = new Date(desde);
      if (hasta) filtro.fecha.$lte = new Date(hasta);
    }

    if (nombre) {
      filtro.nombre = { $regex: nombre, $options: 'i' };
    }

    const pedidos = await Pedido.find(filtro).sort({ fecha: -1 });
    const totalGeneral = pedidos.reduce((sum, p) => sum + p.total, 0);

    res.json({ pedidos, totalGeneral, cantidad: pedidos.length });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo pedidos' });
  }
});

// DELETE /admin/pedidos/:id — Eliminar un pedido
app.delete('/admin/pedidos/:id', requireAdmin, async (req, res) => {
  try {
    await Pedido.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando pedido' });
  }
});

// GET /health — Verificar que el servidor está vivo
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));