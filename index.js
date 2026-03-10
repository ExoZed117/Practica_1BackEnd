require('dotenv').config();
const conectarDB = require('./config/db');
const { iniciarTCPServer } = require('./servers/tcpServer');
const app = require('./servers/httpServer');
const Reporte = require('./models/Reporte');

// 1. Conectar a la base de datos
conectarDB();

// 2. Arrancar Servidor TCP (Para las Regionales)
iniciarTCPServer(process.env.PORT_TCP || 5000);

// 3. Arrancar API HTTP (Para React/Erika)
const PORT = process.env.PORT_API || 3000;
app.listen(PORT, () => {
    console.log(`🌐 [HTTP] API corriendo en http://localhost:${PORT}`);
});

// 4. El Vigilante (Watchdog) - Cada 10 segundos
setInterval(async () => {
    try {
        // Tolerancia: Si un nodo no reporta en los últimos 20 segundos, se marca como caído.
        const hace20Segundos = new Date(Date.now() - 20000); 
        const resultado = await Reporte.updateMany(
            { estado: 'Activo', timestamp: { $lt: hace20Segundos } },
            { $set: { estado: 'No Reporta' } }
        );
        
        if (resultado.modifiedCount > 0) {
            console.log(`⚠️ [WATCHDOG] Alerta: ${resultado.modifiedCount} nodos pasaron a "No Reporta".`);
        }
    } catch (error) {
        console.error('❌ [WATCHDOG] Error:', error.message);
    }
}, 10000);