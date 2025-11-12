import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../config';
import './QRCodeDisplay.css';

interface QRCodeDisplayProps {
  onImageCaptured: (imageDataUrl: string) => void;
  onTriggerCapture?: () => void;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ onImageCaptured, onTriggerCapture }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [socketInstance] = useState<Socket>(() => {
    console.log('🔌 Création du socket vers:', API_CONFIG.BACKEND_URL);
    return io(API_CONFIG.BACKEND_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [mobileConnected, setMobileConnected] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    const socket = socketInstance;

    // Fonction pour générer le QR (définie ici pour éviter les problèmes de dépendances)
    const handleConnect = () => {
      console.log('✅ PC Connecté au serveur WebSocket, ID:', socket.id);
      setIsConnected(true);
      const newSessionId = socket.id || '';
      setSessionId(newSessionId);
      
      // Envoyer pc-join avec le sessionId
      console.log('📤 Envoi pc-join avec ID:', newSessionId);
      socket.emit('pc-join', newSessionId);
      
      // Générer le QR code après connexion
      console.log('🔍 Lancement génération QR code...');
      generateQRCode(newSessionId);
    };

    const handleDisconnect = () => {
      console.log('❌ Déconnecté du serveur WebSocket');
      setIsConnected(false);
      setMobileConnected(false);
    };

    const handleMobileConnected = () => {
      console.log('📱 Mobile connecté !');
      setMobileConnected(true);
    };

    const handleMobileDisconnected = () => {
      console.log('📱 Mobile déconnecté');
      setMobileConnected(false);
    };

    const handleCapturePhoto = (data?: { imageDataUrl?: string }) => {
      console.log('📸 Demande de capture photo reçue du mobile', data);
      // Le serveur envoie juste un signal pour déclencher la capture
      // Pas de données d'image - c'est juste un trigger
      // La capture réelle se fait dans PhotoCapture.tsx
      if (data && data.imageDataUrl) {
        // Si des données sont envoyées, les utiliser
        onImageCaptured(data.imageDataUrl);
      } else {
        // Sinon, déclencher la capture locale sur le PC
        console.log('📷 Signal de capture reçu - déclenchement de la webcam du PC');
        if (onTriggerCapture) {
          onTriggerCapture();
        }
      }
    };

    // Événements Socket.io
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('mobile-connected', handleMobileConnected);
    socket.on('mobile-disconnected', handleMobileDisconnected);
    socket.on('capture-photo', handleCapturePhoto);

    // Si déjà connecté, appeler handleConnect immédiatement
    if (socket.connected) {
      handleConnect();
    }

    // Nettoyage - Retirer les listeners mais NE PAS déconnecter le socket
    return () => {
      console.log('🧹 Nettoyage des event listeners');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('mobile-connected', handleMobileConnected);
      socket.off('mobile-disconnected', handleMobileDisconnected);
      socket.off('capture-photo', handleCapturePhoto);
      // NE PAS faire socket.disconnect() ici !
    };
  }, [socketInstance, onImageCaptured, onTriggerCapture]);

  const generateQRCode = async (sessionId: string) => {
    try {
      const url = `${API_CONFIG.BACKEND_URL}/api/generate-qr?sessionId=${sessionId}`;
      console.log('🔍 Génération QR code...', { sessionId, url, backend: API_CONFIG.BACKEND_URL });
      
      const response = await fetch(url);
      console.log('📡 Réponse reçue:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ QR code généré:', { hasQrCode: !!data.qrCode, mobileUrl: data.mobileUrl });
      setQrCodeUrl(data.qrCode);
    } catch (err) {
      console.error('❌ Erreur QR code:', err);
      setError(`Impossible de générer le QR code: ${err}`);
    }
  };

  return (
    <div className="qr-code-container">
      <div className="qr-header">
        <h2>📱 Capture à distance</h2>
        <div className="status-indicators">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          <span>{isConnected ? 'PC Connecté' : 'PC Déconnecté'}</span>
          {mobileConnected && (
            <>
              <div className="status-dot mobile-connected"></div>
              <span>📱 Mobile prêt</span>
            </>
          )}
        </div>
        {sessionId && (
          <div className="session-info">
            <small style={{ opacity: 0.6, fontSize: '0.75rem' }}>
              Session: {sessionId.substring(0, 8)}...
            </small>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {qrCodeUrl && (
        <div className="qr-display">
          <img src={qrCodeUrl} alt="QR Code" className="qr-image" />
          <p className="qr-instruction">
            Scannez ce QR code avec votre téléphone pour prendre une photo à distance
          </p>
        </div>
      )}

      {!qrCodeUrl && !error && (
        <div className="loading-spinner">Génération du QR code...</div>
      )}
    </div>
  );
};

export default QRCodeDisplay;
