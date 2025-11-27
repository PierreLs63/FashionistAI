// Configuration de l'application FashionistAI

// 🔧 CONFIGURATION POUR LE RÉSEAU LOCAL
// Pour tester avec votre téléphone sur le même réseau WiFi,
// modifiez le fichier .env à la racine du frontend

// Obtenir l'IP avec : ifconfig | grep "inet " | grep -v 127.0.0.1

// Détection automatique : localhost sur PC, IP réseau dans le QR code
const isLocalAccess = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const NETWORK_IP = '10.56.68.144';

export const API_CONFIG = {
  // URL du backend : localhost sur PC (pour la webcam), IP réseau pour le QR code mobile
  BACKEND_URL: isLocalAccess 
    ? 'http://localhost:8000' 
    : `http://${NETWORK_IP}:8000`,
  
  // IP réseau (utilisée pour le QR code même si on accède via localhost)
  NETWORK_IP: NETWORK_IP,
};

// Utilisation dans les composants :
// import { API_CONFIG } from './config';
// const socket = io(API_CONFIG.BACKEND_URL);
