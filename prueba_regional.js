const net = require('net');
const si = require('systeminformation');
const readline = require('readline');

// Configuración de entrada por terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let intervaloEnvio = 10000; 
let timerId = null;
let idRegional = "";

// PREGUNTA INICIAL: Para elegir qué ciudad eres
rl.question('🏙️  ¿Qué regional es esta laptop? (Ej: Oruro, La Paz, Pando...): ', (respuesta) => {
    idRegional = respuesta;
    conectarAlServidor();
});

function conectarAlServidor() {
    // CAMBIA 'localhost' por tu IP Real (Ej: '192.168.1.15') para la prueba de 3 laptops
    const client = net.createConnection({ port: 5000, host: 'localhost' }, () => {
        console.log(`📡 Conectado como: ${idRegional}. Enviando datos...`);
        iniciarEnvioDatos(client);
    });

    // Escuchar órdenes del servidor (Bidireccional)
    client.on('data', (data) => {
        try {
            const response = JSON.parse(data.toString());
            if (response.action && response.action.comando === "SET_REFRESH") {
                intervaloEnvio = response.action.milisegundos;
                console.log(`🔄 Servidor cambió el refresh a: ${intervaloEnvio}ms`);
                iniciarEnvioDatos(client);
            }
        } catch (e) {
            console.log("Mensaje recibido:", data.toString());
        }
    });

    client.on('error', (err) => console.error('❌ Error:', err.message));
    client.on('close', () => {
        console.log('🔴 Desconectado. Reintentando en 5s...');
        setTimeout(conectarAlServidor, 5000);
    });
}

async function enviarDatos(client) {
    try {
        const discos = await si.fsSize();
        const principal = discos[0]; // Guiño: Primer dispositivo detectado real

        const datos = {
            id_regional: idRegional,
            nombre_disco: principal.fs,
            tipo_disco: "SSD",
            capacidad_total: Math.round(principal.size / 1024 / 1024 / 1024),
            espacio_libre: Math.round(principal.available / 1024 / 1024 / 1024),
            iops: Math.floor(Math.random() * 300) + 100,
            timestamp: new Date()
        };
        
        client.write(JSON.stringify(datos));
    } catch (err) {
        console.error("Error leyendo hardware:", err);
    }
}

function iniciarEnvioDatos(client) {
    if (timerId) clearInterval(timerId);
    enviarDatos(client);
    timerId = setInterval(() => enviarDatos(client), intervaloEnvio);
}