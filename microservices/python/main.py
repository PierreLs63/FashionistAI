import os
import uuid
import numpy as np
import json
import cv2
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
from typing import Dict, Any, List, Optional

# --- Configuration ---
app = FastAPI(title="FashionistAI Python Microservice")
UPLOAD_DIR = "uploads"
SIZE_CHARTS_DIR = "size_charts"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Charger le modèle YOLOv8-Pose pré-entraîné
# 'yolov8n-pose.pt' sera téléchargé automatiquement à la première exécution
try:
    model = YOLO('yolov8n-pose.pt')
except Exception as e:
    raise RuntimeError(f"Erreur lors du chargement du modèle YOLO : {e}")

# Configuration CORS pour autoriser les requêtes du serveur Express
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],  # Serveur Express
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

# Route de santé pour vérifier que le microservice fonctionne
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "FashionistAI Python Microservice"}

@app.get("/brands")
async def get_brands():
    """
    Retourne la liste des marques supportées (noms des fichiers dans size_charts sans l'extension).
    """
    try:
        if not os.path.exists(SIZE_CHARTS_DIR):
            raise HTTPException(status_code=404, detail="Répertoire size_charts introuvable")
        
        brands = []
        for filename in os.listdir(SIZE_CHARTS_DIR):
            if filename.endswith('.json'):
                brand_name = filename[:-5]  # Enlever l'extension .json
                brands.append(brand_name)
        
        return {"brands": sorted(brands)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération des marques: {str(e)}")

class SizeRecommendationRequest(BaseModel):
    measurements: Dict[str, float]
    brand_name: str
    category: str

@app.post("/recommend-size")
async def recommend_size(request: SizeRecommendationRequest):
    """
    Recommande une taille en fonction des mensurations, de la marque et de la catégorie.
    
    Args:
        request: Objet contenant:
            - measurements: Dict avec les mensurations (ex: {"estimated_chest_circumference": 95, "estimated_waist_circumference": 80})
            - brand_name: Nom de la marque (ex: "Zara")
            - category: Catégorie de vêtement (ex: "tops", "pants")
    
    Returns:
        Dict avec les tailles recommandées pour homme et femme
    """
    try:
        # Charger le fichier JSON de la marque
        json_file_path = os.path.join(SIZE_CHARTS_DIR, f"{request.brand_name}.json")
        
        if not os.path.exists(json_file_path):
            raise HTTPException(
                status_code=404, 
                detail=f"Marque '{request.brand_name}' non trouvée. Utilisez /brands pour voir les marques disponibles."
            )
        
        with open(json_file_path, 'r', encoding='utf-8') as f:
            size_data = json.load(f)
        
        # Extraire les catégories
        categories_data = size_data.get("categories", {})
        results = {}
        
        # Rechercher la taille pour les hommes
        male_category_data = categories_data.get("male", {})
        if request.category in male_category_data:
            size_chart = male_category_data[request.category]
            results["male_size"] = get_best_fit_size(request.measurements, size_chart)
        else:
            results["male_size"] = None
            results["male_error"] = f"Catégorie '{request.category}' non disponible pour homme"
        
        # Rechercher la taille pour les femmes
        female_category_data = categories_data.get("female", {})
        if request.category in female_category_data:
            size_chart = female_category_data[request.category]
            results["female_size"] = get_best_fit_size(request.measurements, size_chart)
        else:
            results["female_size"] = None
            results["female_error"] = f"Catégorie '{request.category}' non disponible pour femme"
        
        return {
            "brand": request.brand_name,
            "category": request.category,
            "recommendations": results
        }
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la lecture du fichier JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la recommandation: {str(e)}")

def get_best_fit_size(measurements: Dict[str, float], size_chart: List[Dict[str, Any]]) -> Optional[str]:
    """
    Détermine la meilleure taille de vêtement pour une catégorie et un genre donnés.
    Elle trouve la première taille dont les mensurations correspondent ou sont proches.
    """
    for size_info in size_chart:
        is_fit = True
        
        # Parcourir chaque critère de mensuration disponible pour cette taille
        for criteria, range_values in size_info.items():
            if criteria in ["label", "unit"]:
                continue # Ignorer le label de taille
            
            # Déterminer la mensuration calculée correspondante
            measurement_key = None
            if criteria == "chest":
                measurement_key = "estimated_chest_circumference"
            elif criteria == "waist":
                measurement_key = "estimated_waist_circumference"
            # Note: Les autres mensurations (neck, hips, inseam) ne sont pas calculées
            # par la fonction calculate_measurements actuelle, donc elles ne seront pas vérifiées.
            # Vous devrez étendre 'calculate_measurements' pour les inclure si nécessaire.

            if measurement_key and measurement_key in measurements:
                user_measure = measurements[measurement_key]
                min_val, max_val = range_values
                
                # Vérifier si la mensuration de l'utilisateur est dans la plage de la taille
                if not (min_val <= user_measure <= max_val):
                    is_fit = False
                    break # Passer à la taille suivante

        if is_fit:
            # Retourner le label de la première taille qui correspond à tous les critères vérifiés
            return size_info["label"]
            
    return None # Aucune taille trouvée

def measurement_to_size(
    measurements: Dict[str, float], 
    brand_name: str, 
    category: str
) -> Dict[str, Optional[str]]:
    """
    Trouve les tailles de vêtements suggérées (homme/femme) pour une catégorie et une marque.

    Args:
        measurements: Les mensurations calculées.
        brand_name: Le nom de la marque (ex: 'Zara').
        category: Le type de vêtement (ex: 'tops', 'pantalons').

    Returns:
        Un dictionnaire avec les tailles suggérées pour 'male' et 'female'.
    """
    # 1. Charger le fichier JSON de la marque
    json_file_path = os.path.join(SIZE_CHARTS_DIR, f"{brand_name}.json")
    if not os.path.exists(json_file_path):
        return {"error": f"Fichier de tailles pour la marque '{brand_name}' introuvable."}

    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            size_data = json.load(f)
    except Exception as e:
        return {"error": f"Erreur lors du chargement ou de l'analyse du JSON : {e}"}

    # 2. Extraire la table des tailles
    categories_data = size_data.get("categories", {})
    results = {}

    # 3. Rechercher la taille pour les hommes
    male_category_data = categories_data.get("male", {})
    if category in male_category_data:
        size_chart = male_category_data[category]
        results["male_size"] = get_best_fit_size(measurements, size_chart)
    else:
        results["male_size"] = f"Catégorie '{category}' non trouvée dans les tailles hommes."

    # 4. Rechercher la taille pour les femmes
    female_category_data = categories_data.get("female", {})
    if category in female_category_data:
        size_chart = female_category_data[category]
        results["female_size"] = get_best_fit_size(measurements, size_chart)
    else:
        results["female_size"] = f"Catégorie '{category}' non trouvée dans les tailles femmes."

    return results
# Lancement du serveur sur le port 5000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)