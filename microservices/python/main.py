import os
import uuid
import numpy as np
import json
import cv2
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
#from ultralytics import YOLO
from typing import Dict, Any, List, Optional

from hmr2.models import load_hmr2, download_models
from hmr2.utils import recursive_to
from hmr2.datasets.utils import expand_to_aspect_ratio
import hmr2.config
from hmr2.utils.renderer import Renderer, cam_crop_to_full


from measurements import SMPLMeasurer

# --- Configuration ---
app = FastAPI(title="FashionistAI Python Microservice")
UPLOAD_DIR = "uploads"
SIZE_CHARTS_DIR = "size_charts"
os.makedirs(UPLOAD_DIR, exist_ok=True)

'''
# Charger le modèle YOLOv8-Pose pré-entraîné
# 'yolov8n-pose.pt' sera téléchargé automatiquement à la première exécution
try:
    # model = YOLO('yolov8n-pose.pt')
    model = YOLO('yolo11n-pose.pt')
except Exception as e:
    raise RuntimeError(f"Erreur lors du chargement du modèle YOLO : {e}")
'''

print("Loading HMR2 model...")
download_models(mode='inference') 
model, model_cfg = load_hmr2(tag='venus') 
device = torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu')
model = model.to(device)
model.eval()


# Configuration CORS pour autoriser les requêtes du serveur Express
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],  # Serveur Express
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Fonctions de calcul ---
def process_image_hmr(image_path):

    cv_img = cv2.imread(image_path)
    if cv_img is None:
        raise ValueError("Image not found")

    cv_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    
    h, w, _ = cv_img.shape
    center_x, center_y = w // 2, h // 2
    scale = max(h, w) / 200.0 
    
    from hmr2.utils.geometry import rotation_matrix_to_angle_axis
    
    import torchvision.transforms as transforms
    
    # Resize & Normalize
    t = transforms.Compose([
        transforms.ToTensor(),
        transforms.Resize((256, 256), antialias=True),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    batch = t(cv_img).unsqueeze(0).to(device)
    
    with torch.no_grad():
        out = model(batch)
        
    
    pred_cam = out['pred_cam']
    pred_smpl_params = out['pred_smpl_params']
    
 
    batch_size = batch.shape[0]
    # body_pose: (B, 23, 3, 3) -> set to identity
    # global_orient: (B, 1, 3, 3) -> set to identity
    

    zero_body_pose = torch.eye(3).unsqueeze(0).unsqueeze(0).repeat(batch_size, 23, 1, 1).to(device)
    zero_global_orient = torch.eye(3).unsqueeze(0).unsqueeze(0).repeat(batch_size, 1, 1, 1).to(device)
    pred_betas = pred_smpl_params['betas'] 
    
    output_standard = model.smpl(
        body_pose=zero_body_pose,
        global_orient=zero_global_orient,
        betas=pred_betas,
        pose2rot=False
    )
    
    vertices = output_standard.vertices[0].cpu().numpy()
    faces = model.smpl.faces 
    
    return vertices, faces



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
        vertices, faces = process_image_hmr(file_path)
        
        measurements = measurer.measure(vertices, faces, user_height_cm)
        
        return {
            "message": "Analysis successful (HMR2/SMPL)",
            "measurements": measurements
        }

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
