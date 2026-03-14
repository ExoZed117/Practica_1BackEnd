require('dotenv').config();
const fs = require('fs');
const conectarDB = require('./config/db');
const { iniciarTCPServer } = require('./servers/tcpServer');
const app = require('./servers/httpServer');
const Reporte = require('./models/Reporte');

conectarDB();
iniciarTCPServer(process.env.PORT_TCP || 5000);

const PORT = process.env.PORT_API || 3000;
app.listen(PORT, () => console.log(`🌐 [HTTP] API en puerto ${PORT}`));

// 1. WATCHDOG: Cambia estado a 'No Reporta' cada 10s
setInterval(async () => {
    try {
        const hace20Segundos = new Date(Date.now() - 20000); 
        await Reporte.updateMany(
            { estado: 'Activo', timestamp: { $lt: hace20Segundos } },
            { $set: { estado: 'No Reporta' } }
        );
    } catch (error) {
        console.error('❌ [WATCHDOG] Error:', error.message);
    }
}, 10000);

// 2. LOG PERSISTENTE: Escribe nodos caídos en archivo cada 15s
setInterval(async () => {
    try {
        const nodosCaidos = await Reporte.aggregate([
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$id_regional", ultimo: { $first: "$$ROOT" } }},
            { $match: { "ultimo.estado": "No Reporta" } }
        ]);

        const fechaLog = new Date().toLocaleString();
        let contenidoLog = `--- REPORTE DE NODOS CAÍDOS (${fechaLog}) ---\n`;

        if (nodosCaidos.length === 0) {
            contenidoLog += "Cluster Saludable: Todos los nodos reportando.\n";
        } else {
            nodosCaidos.forEach(n => {
                contenidoLog += `ID: ${n._id} | Último Reporte: ${n.ultimo.timestamp.toLocaleString()}\n`;
            });
        }

        fs.writeFileSync('nodos_caidos.log', contenidoLog);
    } catch (error) {
        console.error('❌ Error generando log:', error.message);
    }
}, 15000);