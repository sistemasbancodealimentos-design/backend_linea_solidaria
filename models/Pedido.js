const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  id: String,
  nombre: String,
  unidad: String,
  precio: Number,
  cantidad: Number,
});

const PedidoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
  },
  fecha: {
    type: Date,
    default: Date.now,
  },
  items: [ItemSchema],
  total: {
    type: Number,
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Pedido', PedidoSchema);
