import os
import uuid
import numpy as np
import cv2
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

# --- Configuration ---
app = FastAPI()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Charger le modèle YOLOv8-Pose pré-entraîné
# 'yolov8n-pose.pt' sera téléchargé automatiquement à la première exécution
try:
    model = YOLO('yolov8n-pose.pt')
except Exception as e:
    raise RuntimeError(f"Erreur lors du chargement du modèle YOLO : {e}")

# Configuration CORS pour autoriser les requêtes de votre app React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # L'URL de votre frontend React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Fonctions de calcul ---
def get_pixel_distance(p1, p2):
    """Calcule la distance euclidienne entre deux points."""
    return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def calculate_measurements(keypoints_data, user_height_cm):
    """
    Calcule les mensurations à partir des points clés et de la taille de l'utilisateur.
    Keypoints: 0:nez, 1:œilG, 2:œilD, 3:oreilleG, 4:oreilleD, 5:épauleG, 6:épauleD,
    7:coudeG, 8:coudeD, 9:poignetG, 10:poignetD, 11:hancheG, 12:hancheD,
    13:genouG, 14:genouD, 15:chevilleG, 16:chevilleD
    """
    if keypoints_data is None or len(keypoints_data) < 17:
        raise ValueError("Données de points clés invalides ou incomplètes.")

    k = keypoints_data # Raccourci

    # 1. Établir un ratio pixel/cm
    # On utilise la distance verticale entre les épaules et les chevilles comme référence
    # C'est plus stable que la tête qui peut être inclinée
    shoulder_mid_y = (k[5][1] + k[6][1]) / 2
    ankle_mid_y = (k[15][1] + k[16][1]) / 2
    pixel_height = abs(ankle_mid_y - shoulder_mid_y)

    # On estime que cette distance représente environ 80% de la taille totale
    body_height_cm = user_height_cm * 0.80

    if pixel_height == 0:
        raise ValueError("Hauteur en pixels nulle, impossible de calculer le ratio.")
    
    pixel_to_cm_ratio = body_height_cm / pixel_height

    # 2. Calculer les mensurations en pixels puis les convertir en cm
    # Largeur d'épaules
    shoulder_width_px = get_pixel_distance(k[5], k[6])
    shoulder_width_cm = shoulder_width_px * pixel_to_cm_ratio

    # Largeur de la taille (au niveau des hanches détectées)
    waist_width_px = get_pixel_distance(k[11], k[12])
    waist_width_cm = waist_width_px * pixel_to_cm_ratio

    # Longueur de bras (épaule -> coude -> poignet) - On prend la moyenne des deux bras
    left_arm_px = get_pixel_distance(k[5], k[7]) + get_pixel_distance(k[7], k[9])
    right_arm_px = get_pixel_distance(k[6], k[8]) + get_pixel_distance(k[8], k[10])
    arm_length_cm = ((left_arm_px + right_arm_px) / 2) * pixel_to_cm_ratio

    # Longueur de jambe (hanche -> genou -> cheville) - On prend la moyenne
    left_leg_px = get_pixel_distance(k[11], k[13]) + get_pixel_distance(k[13], k[15])
    right_leg_px = get_pixel_distance(k[12], k[14]) + get_pixel_distance(k[14], k[16])
    leg_length_cm = ((left_leg_px + right_leg_px) / 2) * pixel_to_cm_ratio

    # Estimation très approximative des tours (circonférences)
    # Formule: C = π * d. C'est une simplification extrême !
    # Tour de poitrine estimé à partir de la largeur d'épaules
    chest_circumference_cm = shoulder_width_cm * np.pi * 0.9 # facteur de correction
    # Tour de taille
    waist_circumference_cm = waist_width_cm * np.pi

    return {
        "shoulder_width": round(shoulder_width_cm, 1),
        "waist_width": round(waist_width_cm, 1),
        "arm_length": round(arm_length_cm, 1),
        "leg_length": round(leg_length_cm, 1),
        "estimated_chest_circumference": round(chest_circumference_cm, 1),
        "estimated_waist_circumference": round(waist_circumference_cm, 1),
    }

# --- Point d'API ---
@app.post("/analyze-pose")
async def analyze_pose(image: UploadFile = File(...), height: str = Form(...)):
    try:
        user_height = float(height)
    except ValueError:
        raise HTTPException(status_code=400, detail="La taille doit être un nombre.")

    # Sauvegarder l'image
    file_extension = image.filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await image.read())

    # Effectuer la détection de pose
    try:
        results = model(file_path, verbose=False)
        if not results or not results[0].keypoints:
             raise HTTPException(status_code=404, detail="Aucune personne détectée sur l'image.")
        
        # Extraire les coordonnées des points clés (pour la première personne détectée)
        keypoints = results[0].keypoints.xy[0].cpu().numpy()

        if len(keypoints) < 17:
             raise HTTPException(status_code=400, detail="Détection de pose incomplète.")

        # Calculer les mensurations
        measurements = calculate_measurements(keypoints, user_height)

    except (ValueError, IndexError) as e:
        raise HTTPException(status_code=400, detail=f"Erreur lors du calcul : {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur interne du serveur : {e}")
    finally:
        # Optionnel : supprimer l'image après traitement
        if os.path.exists(file_path):
             os.remove(file_path)

    return {"message": "Analyse réussie", "measurements": measurements}

# Commande pour lancer le serveur : uvicorn main:app --reload