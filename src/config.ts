import dotenv from 'dotenv';
import { networkInterfaces } from 'os';

dotenv.config();

// Détection automatique de l'IP réseau
function getNetworkIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo) continue;
    
    for (const net of netInfo) {
      // Skip IPv6 et loopback
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '192.168.1.21'; // Fallback
}

export const config = {
  // Serveur principal
  port: parseInt(process.env.PORT || '8000', 10),
  host: '0.0.0.0',
  
  // Microservice Python
  pythonService: {
    url: process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5001',
    host: '127.0.0.1',
    port: 5001
  },
  
  // Réseau
  networkIP: process.env.NETWORK_IP || getNetworkIP(),
  
  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // CORS
  cors: {
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*']
  },
  
  // WebSocket
  socketIO: {
    maxHttpBufferSize: 10e6, // 10MB pour les images
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: false
    }
  },
  
  // Upload
  upload: {
    dest: 'uploads/',
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg']
  },
  
  // Environnement
  isDevelopment: process.env.NODE_ENV !== 'production',
  nodeEnv: process.env.NODE_ENV || 'development'
};

export default config;
