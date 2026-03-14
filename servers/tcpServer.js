const net = require('net');
const Reporte = require('../models/Reporte');

const nodosActivos = {}; 

const iniciarTCPServer = (puerto) => {
    const server = net.createServer((socket) => {
        let regionalID = null;

        socket.on('data', async (data) => {
            try {
                const mensaje = JSON.parse(data.toString());
                regionalID = mensaje.id_regional;
                nodosActivos[regionalID] = socket;

                const fechaReporte = mensaje.timestamp ? new Date(mensaje.timestamp) : new Date();
                
                // --- DETECCIÓN DE INCONSISTENCIA DE TIEMPO ---
                const serverTime = new Date();
                const desfaseMinutos = Math.abs(serverTime - fechaReporte) / (1000 * 60);

                if (desfaseMinutos > 5) {
                    console.log(`⚠️ [TCP] Desfase de ${desfaseMinutos.toFixed(1)} min en ${regionalID}.`);
                    socket.write(JSON.stringify({ 
                        action: "Actualización de configuración", 
                        reason: "Inconsistencia de tiempo detectada",
                        server_timestamp: serverTime 
                    }));
                }

                const capacidad = mensaje.capacidad_total || 0;
                const libre = mensaje.espacio_libre || 0;
                const usado = capacidad - libre;
                const pctUtilizacion = capacidad > 0 ? (usado / capacidad) * 100 : 0;

                await Reporte.create({
                    id_regional: regionalID,
                    nombre_disco: mensaje.nombre_disco || 'Disco_Principal',
                    tipo_disco: mensaje.tipo_disco || 'SSD',
                    capacidad_total: capacidad,
                    espacio_usado: usado,
                    espacio_libre: libre,
                    iops: mensaje.iops || Math.floor(Math.random() * 500),
                    utilizacion: parseFloat(pctUtilizacion.toFixed(2)),
                    timestamp: fechaReporte,
                    estado: 'Activo'
                });

                console.log(`📥 [TCP] Datos guardados de: ${regionalID}`);
                
                socket.write(JSON.stringify({ status: 'ACK', server_time: new Date() }));

            } catch (err) {
                console.error('❌ [TCP] Error procesando paquete:', err.message);
            }
        });

        socket.on('close', () => {
            if (regionalID) {
                console.log(`🔴 [TCP] Conexión cerrada: ${regionalID}`);
                delete nodosActivos[regionalID];
            }
        });
        
        socket.on('error', (err) => console.error('⚠️ Error socket:', err.message));
    });

    server.listen(puerto, () => console.log(`🚀 [TCP] Escuchando en puerto ${puerto}`));
};

module.exports = { iniciarTCPServer, nodosActivos };