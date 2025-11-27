import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import './MobileCapture.css';
import { API_CONFIG } from '../config';

const MobileCapture: React.FC = () => {
  // Récupérer le sessionId depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'capturing'>('connecting');
  const [message, setMessage] = useState('Connexion au PC...');
  const [isButtonDisabled, setIsButtonDisabled] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('Session invalide ou expirée');
      return;
    }

    // Connexion au WebSocket
    const newSocket = io(API_CONFIG.BACKEND_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    // Rejoindre la session
    newSocket.emit('mobile-join', { sessionId });

    // Écouter les événements
    newSocket.on('session-ready', () => {
      setStatus('connected');
      setMessage('✅ Connecté au PC - Prêt à capturer');
      setIsButtonDisabled(false);
    });

    newSocket.on('error', (data: { message: string }) => {
      setStatus('error');
      setMessage('❌ ' + (data.message || 'Erreur de connexion'));
      setIsButtonDisabled(true);
    });

    // Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, [sessionId]);

  const handleCapture = () => {
    if (!socket || !sessionId) return;

    // Envoyer le signal de déclenchement au PC
    socket.emit('trigger-capture', { sessionId });
    
    setStatus('capturing');
    setMessage('📸 Capture en cours...');
    setIsButtonDisabled(true);
    
    // Feedback visuel
    setTimeout(() => {
      setStatus('connected');
      setMessage('✅ Capture déclenchée ! Vous pouvez capturer à nouveau.');
      setIsButtonDisabled(false);
    }, 2000);
  };

  const getStatusClass = () => {
    switch (status) {
      case 'connected':
        return 'status connected';
      case 'connecting':
        return 'status waiting';
      case 'error':
        return 'status error';
      case 'capturing':
        return 'status success';
      default:
        return 'status';
    }
  };

  return (
    <div className="mobile-capture-page">
      <div className="mobile-container">
        <h1>📱 Télécommande Photo</h1>
        <div className={getStatusClass()}>{message}</div>
        <div className="icon">📸</div>
        <div className="instructions">
          Positionnez-vous devant la webcam du PC et appuyez sur le bouton ci-dessous pour déclencher la capture à distance.
        </div>
        <button 
          id="captureBtn" 
          onClick={handleCapture}
          disabled={isButtonDisabled}
        >
          🎯 Déclencher la capture
        </button>
      </div>
    </div>
  );
};

export default MobileCapture;
