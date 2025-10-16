import React from 'react';
import './MeasurementsDisplay.css'; // Fichier de style à créer

const MeasurementsDisplay = ({ measurements, onReset }) => {
    return (
        <div className="display-container">
            <h2>Vos Mensurations Estimées</h2>
            <div className="silhouette-container">
                {/* Vous pouvez utiliser une image ou un SVG pour une meilleure silhouette */}
                <div className="silhouette-placeholder"></div>

                {/* Positionnement des inputs sur la silhouette */}
                <div className="measurement-item" style={{ top: '25%', left: '50%' }}>
                    <label>Tour de Poitrine</label>
                    <input type="text" value={`${measurements.estimated_chest_circumference} cm`} readOnly />
                </div>
                <div className="measurement-item" style={{ top: '18%', left: '50%' }}>
                    <label>Largeur Épaules</label>
                    <input type="text" value={`${measurements.shoulder_width} cm`} readOnly />
                </div>
                <div className="measurement-item" style={{ top: '45%', left: '50%' }}>
                    <label>Tour de Taille</label>
                    <input type="text" value={`${measurements.estimated_waist_circumference} cm`} readOnly />
                </div>
                <div className="measurement-item" style={{ top: '35%', left: '10%' }}>
                    <label>Longueur Bras</label>
                    <input type="text" value={`${measurements.arm_length} cm`} readOnly />
                </div>
                <div className="measurement-item" style={{ top: '65%', left: '20%' }}>
                    <label>Longueur Jambe</label>
                    <input type="text" value={`${measurements.leg_length} cm`} readOnly />
                </div>

            </div>
            <button onClick={onReset} className="reset-btn">Analyser une autre photo</button>
        </div>
    );
};

export default MeasurementsDisplay;