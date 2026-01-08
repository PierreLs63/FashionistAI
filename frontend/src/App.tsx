import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BodyMeasurementApp from './components/PhotoCapture';
import QRCodeDisplay from './components/QRCodeDisplay';
import MobileCapture from './components/MobileCapture';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import apiService from './services/api';
import './index.css';

// Composant de route protégée
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = apiService.isAuthenticated();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

// Composant principal pour la page d'accueil
const MainApp: React.FC = () => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [capturedImageFromMobile, setCapturedImageFromMobile] = useState<string>('');
  const [triggerCapture, setTriggerCapture] = useState<number>(0);

  useEffect(() => {
    // Détection du type d'appareil
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'mobile'];
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword));
      
      // Détection supplémentaire basée sur la taille d'écran
      const isSmallScreen = window.innerWidth <= 768;
      
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const handleImageCaptured = (imageDataUrl: string) => {
    console.log('Image reçue depuis le mobile');
    setCapturedImageFromMobile(imageDataUrl);
  };

  const handleTriggerCapture = () => {
    console.log('🎯 Déclenchement de la capture locale');
    setTriggerCapture(prev => prev + 1);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>FashionistAI - Analyse de Mesures Corporelles</h1>
        <p>Capturez votre photo et obtenez vos mesures estimées</p>
        {!isMobile && <p className="device-indicator">💻 Mode PC - Utilisation à distance disponible</p>}
        {isMobile && <p className="device-indicator">📱 Mode Mobile</p>}
      </header>
      
      <div className="main-container">
        {!isMobile ? (
          <div className="pc-layout">
            <div className="qr-section">
              <QRCodeDisplay 
                onImageCaptured={handleImageCaptured}
                onTriggerCapture={handleTriggerCapture}
              />
            </div>
            <div className="capture-section">
              <BodyMeasurementApp 
                {...{ initialImage: capturedImageFromMobile, triggerCapture } as any}
              />
            </div>
          </div>
        ) : (
          <BodyMeasurementApp />
        )}
      </div>
    </div>
  );
};

// Application principale avec router
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
        <Route path="/mobile-capture" element={<MobileCapture />} />
        <Route path="/" element={<MainApp />} />
      </Routes>
    </Router>
  );
};

export default App;