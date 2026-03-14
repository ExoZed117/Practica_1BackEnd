const net = require('net');
const si = require('systeminformation');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let idRegional = "";

rl.question('🏙️  ¿Qué regional es esta?: ', (res) => {
    idRegional = res;
    conectarAlServidor();
});

function conectarAlServidor() {
    const client = net.createConnection({ port: 5000, host: 'localhost' }, () => {
        console.log(`📡 Conectado como: ${idRegional}`);
        setInterval(() => enviarDatos(client), 10000);
    });

    client.on('data', (data) => {
        const resp = JSON.parse(data.toString());
        if (resp.reason === "Inconsistencia de tiempo detectada") {
            console.warn(`🛑 ALERTA: El servidor detectó que tu reloj está mal. Hora server: ${resp.server_timestamp}`);
        }
    });

    client.on('close', () => setTimeout(conectarAlServidor, 5000));
    client.on('error', (err) => console.log("Error:", err.message));
}

async function enviarDatos(client) {
    try {
        const discos = await si.fsSize();
        const d = discos[0];
        const datos = {
            id_regional: idRegional,
            capacidad_total: Math.round(d.size / 1e9),
            espacio_libre: Math.round(d.available / 1e9),
            timestamp: new Date()
        };
        client.write(JSON.stringify(datos));
    } catch (e) { console.error(e); }
}