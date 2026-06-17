// controllers/paymentController.js
const fs = require('fs');
const path = require('path');
const https = require('https');

// URLs de Sandbox de Bancolombia
const HOST_AUTENTICACION = 'api.sandbox.bancolombia.com';
const URL_TOKEN = '/oauth2/token';
const URL_QR_CODE = '/v3/sales/qr/request';

// Cargamos las llaves desde la carpeta certs/ (Subiendo dos niveles desde controllers/)
const agentOptions = {
    cert: fs.readFileSync(path.join(__dirname, '../certificado.pem')),
    key: fs.readFileSync(path.join(__dirname, '../llave_privada.key')),
    rejectUnauthorized: false // Permite omitir la validación estricta de CA en Sandbox
};
const httpsAgent = new https.Agent(agentOptions);

/**
 * Función interna para obtener el Access Token (OAuth 2.0)
 */
async function obtenerAccessToken() {
    const clientId = process.env.BANCOLOMBIA_CLIENT_ID;
    const clientSecret = process.env.BANCOLOMBIA_CLIENT_SECRET;

    const credencialesBase64 = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const cuerpoDetalle = 'grant_type=client_credentials';

    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST_AUTENTICACION,
            path: URL_TOKEN,
            method: 'POST',
            agent: httpsAgent,
            headers: {
                'Authorization': `Basic ${credencialesBase64}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(cuerpoDetalle)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const json = JSON.parse(data);
                    resolve(json.access_token);
                } else {
                    reject(new Error(`Fallo en autenticación: Código ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(cuerpoDetalle);
        req.end();
    });
}

/**
 * Lógica del Endpoint expuesto para generar el QR oficial
 */
async function generarQrOficial(req, res) {
    try {
        const { total, referencia } = req.body;

        if (!total || !referencia) {
            return res.status(400).json({ error: 'Monto total y referencia requeridos' });
        }

        // Solicitamos el token dinámico de acceso
        const tokenBancolombia = await obtenerAccessToken();

        // Estructura del cuerpo exigida por Bancolombia QR Code v3
        const dataPago = JSON.stringify({
            data: {
                amount: parseFloat(total).toFixed(2),
                currency: "COP",
                reference: `FUBAM-${referencia.replace(/\s+/g, '_')}`,
                description: "Pago de productos Linea Solidaria FUBAM",
                account: {
                    type: "Ahorros",
                    number: "02126634032"
                }
            }
        });

        const options = {
            hostname: HOST_AUTENTICACION,
            path: URL_QR_CODE,
            method: 'POST',
            agent: httpsAgent,
            headers: {
                'Authorization': `Bearer ${tokenBancolombia}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': Buffer.byteLength(dataPago)
            }
        };

        const requestQr = https.request(options, (responseBancolombia) => {
            let bodyData = '';
            responseBancolombia.on('data', (chunk) => bodyData += chunk);
            responseBancolombia.on('end', () => {
                if (responseBancolombia.statusCode === 200 || responseBancolombia.statusCode === 201) {
                    const respuestaJson = JSON.parse(bodyData);
                    const hashQR = respuestaJson.data?.qrCode || respuestaJson.data?.text;
                    res.json({ ok: true, qrString: hashQR });
                } else {
                    console.error('Error en API de Bancolombia:', bodyData);
                    res.status(responseBancolombia.statusCode).json({ error: 'Error al procesar el QR en Bancolombia' });
                }
            });
        });

        requestQr.on('error', (err) => {
            console.error('Error de red HTTPS:', err);
            res.status(500).json({ error: 'Fallo de conexión segura con el banco' });
        });

        requestQr.write(dataPago);
        requestQr.end();

    } catch (error) {
        console.error('Error general generando QR:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = { generarQrOficial };