const net = require('net');
const Reporte = require('../models/Reporte');

// REQUERIMIENTO 7.1: Mapa global para mantener las conexiones vivas
// Esto permite que la API de Erika mande comandos al socket correcto
const nodosActivos = {}; 

const iniciarTCPServer = (puerto) => {
    const server = net.createServer((socket) => {
        let regionalID = null; // Para identificar quién se desconecta después

        console.log('🔗 [TCP] Intento de conexión detectado.');

        socket.on('data', async (data) => {
            // REQUERIMIENTO 5.1: Tolerancia a fallos (Try/Catch)
            // Si un cliente manda basura, el servidor NO se cae
            try {
                const mensaje = JSON.parse(data.toString());
                regionalID = mensaje.id_regional;

                // REQUERIMIENTO 7.2: Adición automática al mapa de conexiones
                nodosActivos[regionalID] = socket;

                // GUIÑO: Usar el timestamp del cliente si existe (Sincronización)
                const fechaReporte = mensaje.timestamp ? new Date(mensaje.timestamp) : new Date();

                // Lógica de cálculos internos para el reporte
                const capacidad = mensaje.capacidad_total || 0;
                const libre = mensaje.espacio_libre || 0;
                const usado = capacidad - libre;
                
                // Cálculo de utilización: 
                // $$Utilización = \frac{Capacidad - Libre}{Capacidad} \times 100$$
                const pctUtilizacion = capacidad > 0 ? (usado / capacidad) * 100 : 0;

                // REQUERIMIENTO 5.2: Persistencia en MongoDB Atlas
                // Creamos un registro nuevo para mantener el historial (Growth Rate)
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

                // REQUERIMIENTO 7.1: Confirmación de recepción (ACK)
                socket.write(JSON.stringify({ 
                    status: 'ACK', 
                    msg: 'Reporte procesado correctamente',
                    server_time: new Date() 
                }));

            } catch (err) {
                console.error('❌ [TCP] Error procesando paquete de datos:', err.message);
                // No cerramos el socket, solo ignoramos el paquete corrupto
            }
        });

        // Gestión de errores de red
        socket.on('error', (err) => {
            console.error(`⚠️ [TCP] Error de red en ${regionalID || 'Cliente'}:`, err.message);
        });

        // Limpieza al cerrar la conexión
        socket.on('close', () => {
            if (regionalID) {
                console.log(`🔴 [TCP] Conexión cerrada con: ${regionalID}`);
                delete nodosActivos[regionalID]; // Lo sacamos del mapa de activos
            }
        });
    });

    server.listen(puerto, () => {
        console.log(`🚀 [TCP] Servidor de Sockets escuchando en puerto ${puerto}`);
    });
};

// Exportamos tanto la función de inicio como el mapa de nodos activos
module.exports = { iniciarTCPServer, nodosActivos };