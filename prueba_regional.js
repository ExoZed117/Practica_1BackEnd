const net = require('net');
const si = require('systeminformation');

let intervaloEnvio = 10000; // Por defecto: 10 segundos
let timerId = null;

const client = net.createConnection({ port: 5000 }, () => {
    console.log('📡 Regional conectada. Esperando órdenes del servidor...');
    iniciarEnvioDatos();
});

// Función para enviar datos y simular el disco
async function enviarDatos() {
    try {
        const discos = await si.fsSize();
        const principal = discos[0];

        const datos = {
            id_regional: "Santa Cruz - Regional 1",
            nombre_disco: principal.fs || "C:",
            tipo_disco: "SSD", // Guiño
            capacidad_total: Math.round(principal.size / 1024 / 1024 / 1024),
            espacio_libre: Math.round(principal.available / 1024 / 1024 / 1024),
            iops: Math.floor(Math.random() * 300) + 100,
            timestamp: new Date() // Guiño: Hora del cliente
        };
        
        client.write(JSON.stringify(datos));
        console.log(`📤 Datos enviados. Próximo envío en ${intervaloEnvio/1000}s`);
    } catch (err) {
        console.error("Error leyendo disco:", err);
    }
}

function iniciarEnvioDatos() {
    if (timerId) clearInterval(timerId);
    enviarDatos(); // Enviar uno inmediato
    timerId = setInterval(enviarDatos, intervaloEnvio);
}

// ESCUCHAR ÓRDENES DEL SERVIDOR (Bidireccional y Autorefresh)
client.on('data', (data) => {
    const response = JSON.parse(data.toString());
    
    if (response.action) {
        console.log(`🤖 ¡ORDEN RECIBIDA DEL SERVIDOR!:`, response.action);
        
        // GUIÑO: Autorefresh parametrizable remoto
        if (response.action.comando === "SET_REFRESH") {
            intervaloEnvio = response.action.milisegundos;
            console.log(`🔄 Servidor ordenó cambiar refresh a: ${intervaloEnvio}ms`);
            iniciarEnvioDatos();
        }
    }
});

client.on('error', (err) => console.error('Error de conexión:', err.message));
client.on('close', () => console.log('🔴 Desconectado del servidor.'));