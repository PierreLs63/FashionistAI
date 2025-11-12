import React from 'react';
import './MeasurementsDisplay.css';

interface MeasurementsData {
    shoulder_width: string;
    estimated_chest_circumference: string;
    estimated_waist_circumference: string;
    arm_length: string;
    leg_length: string;
}

interface SilhouetteWithArrowsProps {
    measurements: MeasurementsData | null;
}

// SVG pour une silhouette plus réaliste avec des flèches de mesure
const SilhouetteWithArrows: React.FC<SilhouetteWithArrowsProps> = ({ measurements }) => (
    <svg viewBox="0 0 250 450" className="silhouette-svg">
        <defs>
            <marker id="arrowhead" markerWidth="5" markerHeight="3.5" refX="0" refY="1.75" orient="auto">
                <polygon points="0 0, 5 1.75, 0 3.5" fill="#555" />
            </marker>
        </defs>
        
        {/* Silhouette */}
        <g stroke="#a0a0a0" strokeWidth="2" fill="#e9e9e9" transform="translate(25, 0)">
            {/* Tête */}
            <circle cx="100" cy="45" r="30" />
            {/* Cou et Torse */}
            <path d="M100,75 C90,85 90,95 90,105 L70,110 C60,112 55,140 65,180 L80,240 C80,240 120,240 120,240 L135,180 C145,140 140,112 130,110 L110,105 C110,95 110,85 100,75 Z" />
            {/* Jambes */}
            <path d="M80,240 C75,300 70,380 75,440 L95,440 C95,380 95,300 100,240 Z" />
            <path d="M120,240 C125,300 130,380 125,440 L105,440 C105,380 105,300 100,240 Z" />
        </g>

        {/* Flèches (visibles seulement si les mesures existent) */}
        {measurements && (
            <g stroke="#333" strokeWidth="1.5">
                {/* Largeur Epaules -> Flèche et ligne vers la droite */}
                <line x1="80" y1="115" x2="195" y2="115" />
                <line x1="137.5" y1="115" x2="220" y2="90" markerEnd="url(#arrowhead)" />
                {/* Tour de Poitrine -> Flèche et ligne vers la droite */}
                <line x1="90" y1="160" x2="185" y2="160" />
                <line x1="137.5" y1="160" x2="220" y2="140" markerEnd="url(#arrowhead)" />
                {/* Tour de Taille -> Flèche et ligne vers la droite */}
                <line x1="105" y1="230" x2="170" y2="230" />
                <line x1="137.5" y1="230" x2="220" y2="210" markerEnd="url(#arrowhead)" />
                {/* Longueur Bras -> Flèche et ligne vers la gauche */}
                <line y1="115" x1="80" y2="210" x2="80" />
                <line y1="162.5" x1="80" x2="20" y2="180" markerEnd="url(#arrowhead)" />
                {/* Longueur Jambe -> Flèche et ligne vers la gauche */}
                <line y1="245" x1="103" y2="430" x2="103" />
                <line y1="337.5" x1="103" x2="20" y2="330" markerEnd="url(#arrowhead)" />
            </g>
        )}
    </svg>
);

interface MeasurementsDisplayProps {
    measurements: MeasurementsData | null;
    onReset: () => void;
}

const MeasurementsDisplay: React.FC<MeasurementsDisplayProps> = ({ measurements, onReset }) => {
    
    if (!measurements) {
        return (
            <div className="display-container placeholder">
                <h2>Vos Résultats Apparaîtront Ici</h2>
                <div className="silhouette-container">
                     <SilhouetteWithArrows measurements={null}/>
                </div>
                <p>En attente de l'analyse de la photo...</p>
            </div>
        );
    }

    return (
        <div className="display-container">
            <h2>Vos Mensurations Estimées</h2>
            <div className="silhouette-container">
                <SilhouetteWithArrows measurements={measurements}/>
                
                <div className="measurement-item" style={{ top: '80px', left: '100%' }}>
                    <label>Largeur Épaules</label>
                    <input type="text" value={`${measurements.shoulder_width} cm`} readOnly />
                </div>
                <div className="measurement-item" style={{ top: '130px', left: '100%' }}>
                    <label>Tour de Poitrine</label>
                    <input type="text" value={`${measurements.estimated_chest_circumference} cm`} readOnly />
                </div>
                <div className="measurement-item" style={{ top: '200px', left: '100%' }}>
                    <label>Tour de Taille</label>
                    <input type="text" value={`${measurements.estimated_waist_circumference} cm`} readOnly />
                </div>
                <div className="measurement-item" style={{ top: '170px', left: '-70px' }}>
                    <label>Longueur Bras</label>
                    <input type="text" value={`${measurements.arm_length} cm`} readOnly />
                </div>
                <div className="measurement-item" style={{ top: '320px', left: '-70px' }}>
                    <label>Longueur Jambe</label>
                    <input type="text" value={`${measurements.leg_length} cm`} readOnly />
                </div>
            </div>
            <button onClick={onReset} className="reset-btn">Analyser une autre photo</button>
        </div>
    );
};

export default MeasurementsDisplay;