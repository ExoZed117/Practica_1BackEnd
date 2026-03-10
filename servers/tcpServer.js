const net = require('net');
const Reporte = require('../models/Reporte');

// OBJETO GLOBAL (Mapa de Conexiones Vivas)
const nodosActivos = {}; 

const iniciarTCPServer = (puerto) => {
    const server = net.createServer((socket) => {
        let regionalID = null;
        console.log('🔗 [TCP] Intento de conexión entrante...');

        socket.on('data', async (data) => {
            // Tolerancia a fallos: try/catch para evitar caídas por JSON corrupto
            try {
                const mensaje = JSON.parse(data.toString());
                regionalID = mensaje.id_regional;
                
                // Adición Automática y Mapa de Conexiones
                if (!nodosActivos[regionalID]) {
                    console.log(`🆕 [TCP] Nuevo nodo registrado: ${regionalID}`);
                }
                nodosActivos[regionalID] = socket;

                // Guiño: Usar la hora del cliente si viene, si no, la del server
                const horaReporte = mensaje.timestamp ? new Date(mensaje.timestamp) : new Date();

                // Cálculos
                const espacioUsado = mensaje.capacidad_total - mensaje.espacio_libre;
                const utilizacion = (espacioUsado / mensaje.capacidad_total) * 100;

                // Persistencia en DB
                await Reporte.create({
                    id_regional: regionalID,
                    nombre_disco: mensaje.nombre_disco || 'Disco_Principal',
                    tipo_disco: mensaje.tipo_disco || 'SSD',
                    capacidad_total: mensaje.capacidad_total,
                    espacio_usado: espacioUsado,
                    espacio_libre: mensaje.espacio_libre,
                    iops: mensaje.iops || Math.floor(Math.random() * 500),
                    utilizacion: parseFloat(utilizacion.toFixed(2)),
                    timestamp: horaReporte,
                    estado: 'Activo'
                });

                console.log(`📥 [TCP] Reporte guardado de ${regionalID}`);
                
                // Confirmación al cliente (ACK)
                socket.write(JSON.stringify({ status: 'ACK: Nodo registrado', timestamp: new Date() }));

            } catch (err) {
                console.error('❌ [TCP] Error procesando JSON (Ignorado):', err.message);
            }
        });

        // Gestión de Desconexión
        socket.on('error', (err) => {
            console.error(`⚠️ [TCP] Error en nodo ${regionalID || 'Desconocido'}:`, err.message);
            if (regionalID) delete nodosActivos[regionalID];
        });

        socket.on('close', () => {
            console.log(`🔴 [TCP] Conexión cerrada con ${regionalID || 'Desconocido'}`);
            if (regionalID) delete nodosActivos[regionalID];
        });
    });

    server.listen(puerto, () => {
        console.log(`🚀 Servidor TCP (Sockets) escuchando en puerto ${puerto}`);
    });
};

module.exports = { iniciarTCPServer, nodosActivos };