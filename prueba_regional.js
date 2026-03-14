const net = require('net');
const si = require('systeminformation');
const readline = require('readline');

// Configuración de interfaz para el menú en consola
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Listado oficial de las 9 administraciones regionales de la CNS
const ciudades = [
    "La Paz", "Santa Cruz", "Cochabamba", 
    "Oruro", "Potosí", "Tarija", 
    "Beni", "Pando", "Chuquisaca"
];

let idRegional = "";
let intervaloEnvio = 10000; // 10 segundos por defecto
let timerId = null;

console.log('--- 🏥 SIMULADOR DE NODO REGIONAL (CNS) ---');
console.log('Seleccione la regional que emulará esta laptop:');

// Despliegue del menú numerado para evitar errores de dedo
ciudades.forEach((ciudad, index) => {
    console.log(`${index + 1}. ${ciudad}`);
});

rl.question('\n🔢 Ingrese el número de la ciudad: ', (opcion) => {
    const seleccion = parseInt(opcion) - 1;

    if (seleccion >= 0 && seleccion < ciudades.length) {
        idRegional = ciudades[seleccion];
        console.log(`✅ Regional seleccionada: ${idRegional}`);
        conectarAlServidor();
    } else {
        console.log('❌ Opción inválida. Reinicie el script.');
        process.exit();
    }
});

function conectarAlServidor() {
    /** * IMPORTANTE: Para la prueba de las 3 laptops, cambia 'localhost' 
     * por la dirección IP de tu laptop servidor (ej: '192.168.1.15').
     */
    const client = net.createConnection({ port: 5000, host: 'localhost' }, () => {
        console.log(`📡 Conectado al servidor central como: ${idRegional}`);
        iniciarEnvioDatos(client);
    });

    // REQUERIMIENTO 7.1: Escucha de órdenes del servidor (Bidireccional)
    client.on('data', (data) => {
        try {
            const response = JSON.parse(data.toString());
            
            // Caso 1: El servidor ordena cambiar el tiempo de reporte
            if (response.action && response.action.comando === "SET_REFRESH") {
                intervaloEnvio = response.action.milisegundos;
                console.log(`🔄 Servidor ordenó cambiar el refresh a: ${intervaloEnvio}ms`);
                iniciarEnvioDatos(client);
            }

            // Caso 2: El servidor detecta que tu reloj está mal sincronizado
            if (response.action === "Actualización de configuración") {
                console.warn(`🛑 ALERTA DEL SERVIDOR: ${response.reason}`);
                console.warn(`⏰ Hora del Servidor: ${response.server_timestamp}`);
            }

            if (response.status === 'ACK') {
                console.log('✔️ Servidor confirmó recepción de datos (ACK)');
            }

        } catch (e) {
            console.log("📩 Mensaje recibido (Texto):", data.toString());
        }
    });

    client.on('error', (err) => {
        console.error('❌ Error de conexión:', err.message);
    });

    client.on('close', () => {
        console.log('🔴 Conexión cerrada. Reintentando en 5 segundos...');
        setTimeout(conectarAlServidor, 5000); // Reintento automático
    });
}

// GUIÑO 4.1: Obtención de datos reales del hardware
async function enviarDatos(client) {
    try {
        const discos = await si.fsSize();
        const principal = discos[0]; // Reporta únicamente el primer disco detectado

        const datos = {
            id_regional: idRegional,
            nombre_disco: principal.fs || "C:",
            tipo_disco: "SSD",
            capacidad_total: Math.round(principal.size / 1024 / 1024 / 1024), // GB
            espacio_libre: Math.round(principal.available / 1024 / 1024 / 1024), // GB
            iops: Math.floor(Math.random() * 300) + 100, // Simulación técnica
            timestamp: new Date() // Sincronización con fecha del cliente
        };
        
        client.write(JSON.stringify(datos));
        console.log(`📤 Reporte enviado. Próximo en ${intervaloEnvio/1000}s`);
    } catch (err) {
        console.error("❌ Error leyendo el disco duro:", err.message);
    }
}

function iniciarEnvioDatos(client) {
    if (timerId) clearInterval(timerId);
    enviarDatos(client); // Envío inicial inmediato
    timerId = setInterval(() => enviarDatos(client), intervaloEnvio);
}