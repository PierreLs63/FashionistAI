import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import './PhotoCapture.css';
import MeasurementsDisplay from './MeasurementsDisplay';

const PhotoCapture = () => {
    const webcamRef = useRef(null);
    const [imgSrc, setImgSrc] = useState(null);
    const [height, setHeight] = useState('');
    const [measurements, setMeasurements] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const videoConstraints = {
        width: 720,
        height: 1280,
        facingMode: "user"
    };

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setImgSrc(imageSrc);
    }, [webcamRef]);

    const retakePhoto = () => {
        setImgSrc(null);
        setMeasurements(null);
        setError('');
    };

    // --- MODIFICATION ICI : Utilisation de fetch ---
    const handleSubmit = async () => {
        if (!imgSrc || !height) {
            setError('Veuillez prendre une photo et entrer votre taille.');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            // Convertir l'image base64 en Blob
            const response = await fetch(imgSrc);
            const blob = await response.blob();
            const file = new File([blob], "capture.jpeg", { type: "image/jpeg" });

            const formData = new FormData();
            formData.append('image', file);
            formData.append('height', height);

            const requestOptions = {
                method: 'POST',
                body: formData,
                // Note: Ne pas mettre 'Content-Type' manuellement,
                // le navigateur le fera correctement avec la bonne délimitation (boundary) pour multipart/form-data.
            };

            const apiResponse = await fetch('http://127.0.0.1:8000/analyze-pose', requestOptions);

            if (!apiResponse.ok) {
                // Si le statut HTTP n'est pas 2xx, on gère l'erreur
                const errorData = await apiResponse.json();
                throw new Error(errorData.detail || `Erreur HTTP: ${apiResponse.status}`);
            }

            const result = await apiResponse.json();
            setMeasurements(result.measurements);

        } catch (err) {
            console.error(err);
            setError(err.message || 'Une erreur est survenue. Veuillez réessayer.');
        } finally {
            setIsLoading(false);
        }
    };

    if (measurements) {
        return <MeasurementsDisplay measurements={measurements} onReset={retakePhoto} />;
    }

    return (
        <div className="photo-capture-container">
            {!imgSrc ? (
                <>
                    <h2>Prenez-vous en photo</h2>
                    <p>Centrez-vous avec la silhouette et gardez vos bras légèrement écartés du corps.</p>
                    <div className="webcam-container">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            mirrored={true}
                        />
                        <div className="silhouette-overlay"></div>
                    </div>
                    <button onClick={capture} className="capture-btn">Capturer</button>
                </>
            ) : (
                <div className="preview-container">
                    <h2>Aperçu & Confirmation</h2>
                    <img src={imgSrc} alt="capture" />
                    <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        placeholder="Entrez votre taille en cm (ex: 175)"
                        className="height-input"
                    />
                    <div className="button-group">
                        <button onClick={retakePhoto} className="retake-btn">Reprendre</button>
                        <button onClick={handleSubmit} disabled={isLoading} className="submit-btn">
                            {isLoading ? 'Analyse en cours...' : 'Calculer mes mensurations'}
                        </button>
                    </div>
                    {error && <p className="error-message">{error}</p>}
                </div>
            )}
        </div>
    );
};

export default PhotoCapture;