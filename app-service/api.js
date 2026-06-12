// src/services/api.js
// Cambia esta URL por la que te da Render cuando despliegues
const BASE_URL = 'https://TU-APP.onrender.com';

/**
 * Guarda un pedido en la base de datos.
 * Llámalo desde InvoiceScreen justo después de generar el comprobante.
 *
 * Ejemplo de uso:
 *   await guardarPedido(cartItems, nombre, cartTotal);
 */
export async function guardarPedido(items, nombre, total) {
  try {
    const response = await fetch(`${BASE_URL}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, items, total }),
    });

    if (!response.ok) throw new Error('Error en el servidor');

    const data = await response.json();
    return { ok: true, id: data.id };
  } catch (error) {
    console.error('Error guardando pedido:', error);
    return { ok: false };
  }
}
