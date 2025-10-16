import React, { useState } from 'react';
import PhotoCapture from './components/PhotoCapture';
import MeasurementsDisplay from './components/MeasurementsDisplay';
import './index.css';

function App() {
  const [measurements, setMeasurements] = useState(null);
  const [detectedClothes, setDetectedClothes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalysisComplete = (data) => {
    setMeasurements(data.measurements);
    setDetectedClothes(data.detected_clothes);
  };

  const handleAnalysisStart = () => {
    setIsLoading(true);
    setMeasurements(null);
    setDetectedClothes([]);
  };

  const handleAnalysisEnd = () => {
    setIsLoading(false);
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🎭 FashionistAI</h1>
        <p>Analysez vos vêtements et obtenez vos mesures avec l'intelligence artificielle</p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        <PhotoCapture 
          onAnalysisStart={handleAnalysisStart}
          onAnalysisComplete={handleAnalysisComplete}
          onAnalysisEnd={handleAnalysisEnd}
          isLoading={isLoading}
        />
        
        <MeasurementsDisplay 
          measurements={measurements}
          detectedClothes={detectedClothes}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

export default App;