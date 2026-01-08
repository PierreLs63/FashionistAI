#!/usr/bin/env python3
"""
Script d'analyse de précision des mesures corporelles
Utilise le dataset HuggingFace body-measurements-dataset pour comparer
les prédictions du modèle YOLO avec les mesures réelles.

Dataset: https://huggingface.co/datasets/UniqueData/body-measurements-dataset
"""

import os
import json
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from sklearn.metrics import mean_absolute_error, mean_squared_error
import requests
from PIL import Image
from io import BytesIO
import warnings

# Import du modèle et de la fonction de calcul depuis main.py
from main import calculate_measurements, model

warnings.filterwarnings('ignore')

# Configuration
RESULTS_DIR = "accuracy_results"
os.makedirs(RESULTS_DIR, exist_ok=True)
BASE_URL = "https://huggingface.co/datasets/UniqueData/body-measurements-dataset/resolve/main/"


def download_dataset():
    """
    Télécharge le fichier CSV du dataset depuis HuggingFace
    
    Returns:
        pd.DataFrame: DataFrame avec les chemins des fichiers
    """
    print("📥 Téléchargement du dataset depuis HuggingFace...")
    try:
        csv_path = "body.csv"
        if not os.path.exists(csv_path):
            print("   Téléchargement de body.csv...")
            response = requests.get(f"{BASE_URL}body.csv", timeout=30)
            response.raise_for_status()
            with open(csv_path, 'wb') as f:
                f.write(response.content)
        
        df = pd.read_csv(csv_path)
        print(f"✅ Dataset chargé: {len(df)} échantillons")
        return df
    except Exception as e:
        print(f"❌ Erreur lors du téléchargement: {e}")
        raise


def download_file_from_hf(file_path: str) -> Optional[bytes]:
    """
    Télécharge un fichier depuis HuggingFace
    
    Args:
        file_path: Chemin du fichier dans le repo
        
    Returns:
        Contenu du fichier en bytes, ou None si erreur
    """
    try:
        url = f"{BASE_URL}{file_path}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.content
    except Exception as e:
        print(f"⚠️  Erreur téléchargement {file_path}: {e}")
        return None


def parse_measurements_json(json_data: Dict) -> Dict[str, float]:
    """
    Parse les données de mesures depuis un JSON
    
    Args:
        json_data: Dictionnaire des mesures
        
    Returns:
        Dict avec les mesures en cm
    """
    measurements = {}
    
    if isinstance(json_data, dict):
        for key, value in json_data.items():
            # Ne garder que les mesures en cm
            if key.endswith('_cm'):
                try:
                    # Nettoyer la valeur (retirer _tbr, etc.)
                    value_str = str(value).replace('_tbr', '').strip()
                    measurements[key] = float(value_str)
                except (ValueError, TypeError):
                    continue
    
    return measurements


def analyze_image(image_path: str, height_cm: float = 170.0) -> Optional[Dict[str, float]]:
    """
    Analyse une image pour extraire les mesures corporelles
    
    Args:
        image_path: Chemin vers l'image
        height_cm: Taille de référence en cm
        
    Returns:
        Dict des mesures prédites ou None si erreur
    """
    try:
        # Télécharger l'image
        image_data = download_file_from_hf(image_path)
        if image_data is None:
            return None
        
        # Ouvrir l'image avec PIL
        image = Image.open(BytesIO(image_data))
        
        # Convertir en array numpy
        image_array = np.array(image)
        
        # Utiliser YOLO pour détecter les keypoints
        results = model(image_array, verbose=False)
        
        if not results or len(results) == 0:
            print("   ⚠️  Aucune détection YOLO")
            return None
        
        # Extraire les keypoints du premier résultat
        result = results[0]
        if not hasattr(result, 'keypoints') or result.keypoints is None:
            print("   ⚠️  Pas de keypoints détectés")
            return None
        
        keypoints_data = result.keypoints.data
        if len(keypoints_data) == 0:
            print("   ⚠️  Liste de keypoints vide")
            return None
        
        keypoints = keypoints_data[0].cpu().numpy()
        
        # Calculer les mesures avec la fonction du microservice
        measurements = calculate_measurements(keypoints, height_cm)
        
        return measurements
    
    except Exception as e:
        print(f"   ❌ Erreur analyse: {e}")
        return None


def analyze_dataset(df: pd.DataFrame, max_samples: Optional[int] = 50) -> Tuple[List[Dict], List[Dict]]:
    """
    Analyse le dataset et compare avec les mesures réelles
    
    Args:
        df: DataFrame du dataset
        max_samples: Nombre maximum d'échantillons à analyser (None = tous)
        
    Returns:
        Tuple (prédictions, vraies_mesures)
    """
    predictions = []
    ground_truths = []
    
    # Limiter le nombre d'échantillons si demandé
    samples_to_analyze = df.head(max_samples) if max_samples else df
    
    print(f"\n🔍 Analyse de {len(samples_to_analyze)} échantillons...")
    
    for idx, row in samples_to_analyze.iterrows():
        try:
            print(f"\n[{idx + 1}/{len(samples_to_analyze)}] Analyse de l'échantillon {idx}...")
            
            # Télécharger et parser le JSON de mesures
            measurements_path = row['measurements']
            json_data = download_file_from_hf(measurements_path)
            if json_data is None:
                print("   ⚠️  Impossible de télécharger les mesures")
                continue
            
            real_measurements = json.loads(json_data)
            real_measurements_parsed = parse_measurements_json(real_measurements)
            
            if not real_measurements_parsed:
                print("   ⚠️  Mesures réelles vides")
                continue
            
            # Analyser l'image front (la plus appropriée pour les mesures)
            front_image_path = row['front']
            
            # Estimer la taille depuis les mesures réelles si disponible
            height_cm = real_measurements_parsed.get('height', 170.0)
            
            predicted_measurements = analyze_image(front_image_path, height_cm)
            
            if predicted_measurements is None:
                print("   ⚠️  Prédiction échouée")
                continue
            
            # Stocker les résultats
            predictions.append(predicted_measurements)
            ground_truths.append(real_measurements_parsed)
            
            print(f"   ✅ Analyse réussie")
            
        except Exception as e:
            print(f"   ❌ Erreur à l'index {idx}: {e}")
            continue
    
    print(f"\n✅ Analyse terminée: {len(predictions)}/{len(samples_to_analyze)} réussies")
    
    return predictions, ground_truths


def calculate_metrics(predictions: List[Dict], ground_truths: List[Dict]) -> Dict:
    """
    Calcule les métriques de performance
    
    Args:
        predictions: Liste des prédictions
        ground_truths: Liste des mesures réelles
        
    Returns:
        Dict des métriques par mesure
    """
    metrics = {}
    
    # Mapping entre nos clés et celles du dataset
    key_mapping = {
        "shoulder_width": "shoulder_width_cm",
        "waist_width": "waist_circumference_cm",  # On compare la largeur avec la circonférence
        "arm_length": "arm_length_cm",
        "leg_length": "leg_length_cm",
        "estimated_chest_circumference": "chest_circumference_cm",
        "estimated_waist_circumference": "waist_circumference_cm",
    }
    
    for pred_key, gt_key in key_mapping.items():
        pred_values = []
        true_values = []
        
        for pred, gt in zip(predictions, ground_truths):
            if pred_key in pred and gt_key in gt:
                pred_values.append(pred[pred_key])
                true_values.append(gt[gt_key])
        
        if len(pred_values) == 0:
            continue
        
        pred_array = np.array(pred_values)
        true_array = np.array(true_values)
        
        mae = mean_absolute_error(true_array, pred_array)
        rmse = np.sqrt(mean_squared_error(true_array, pred_array))
        percentage_error = np.mean(np.abs((true_array - pred_array) / true_array)) * 100
        
        # Utiliser un nom plus lisible pour l'affichage
        display_name = pred_key.replace("_", " ").replace("estimated ", "").title()
        
        metrics[display_name] = {
            'mae': mae,
            'rmse': rmse,
            'percentage_error': percentage_error,
            'n_samples': len(pred_values),
            'predictions': pred_values,
            'ground_truth': true_values
        }
    
    return metrics


def generate_statistics(metrics: Dict) -> pd.DataFrame:
    """
    Génère un tableau de statistiques
    
    Args:
        metrics: Dictionnaire des métriques
        
    Returns:
        DataFrame des statistiques
    """
    stats = []
    for measurement, data in metrics.items():
        stats.append({
            'Mesure': measurement,
            'MAE (cm)': f"{data['mae']:.2f}",
            'RMSE (cm)': f"{data['rmse']:.2f}",
            'Erreur (%)': f"{data['percentage_error']:.2f}",
            'Échantillons': data['n_samples']
        })
    
    return pd.DataFrame(stats)


def plot_results(metrics: Dict):
    """
    Crée des graphiques de visualisation
    
    Args:
        metrics: Dictionnaire des métriques
    """
    if not metrics:
        print("⚠️  Pas de données à visualiser")
        return
    
    n_measurements = len(metrics)
    if n_measurements == 0:
        return
    
    # Créer une figure avec subplots
    fig, axes = plt.subplots(n_measurements, 2, figsize=(15, 5 * n_measurements))
    if n_measurements == 1:
        axes = axes.reshape(1, -1)
    
    for idx, (measurement, data) in enumerate(metrics.items()):
        pred = np.array(data['predictions'])
        true = np.array(data['ground_truth'])
        
        # Graphique 1: Scatter plot prédictions vs réalité
        axes[idx, 0].scatter(true, pred, alpha=0.6)
        axes[idx, 0].plot([true.min(), true.max()], 
                          [true.min(), true.max()], 
                          'r--', label='Perfect prediction')
        axes[idx, 0].set_xlabel('Mesure réelle (cm)')
        axes[idx, 0].set_ylabel('Prédiction (cm)')
        axes[idx, 0].set_title(f'{measurement} - Prédictions vs Réalité')
        axes[idx, 0].legend()
        axes[idx, 0].grid(True, alpha=0.3)
        
        # Graphique 2: Distribution des erreurs
        errors = pred - true
        axes[idx, 1].hist(errors, bins=20, alpha=0.7, edgecolor='black')
        axes[idx, 1].axvline(0, color='r', linestyle='--', label='Erreur nulle')
        axes[idx, 1].set_xlabel('Erreur (cm)')
        axes[idx, 1].set_ylabel('Fréquence')
        axes[idx, 1].set_title(f'{measurement} - Distribution des erreurs')
        axes[idx, 1].legend()
        axes[idx, 1].grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Sauvegarder
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(RESULTS_DIR, f"accuracy_plots_{timestamp}.png")
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    print(f"📊 Graphiques sauvegardés: {filename}")
    plt.close()


def save_results(metrics: Dict, stats_df: pd.DataFrame):
    """
    Sauvegarde les résultats dans des fichiers
    
    Args:
        metrics: Dictionnaire des métriques
        stats_df: DataFrame des statistiques
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Sauvegarder les stats en CSV
    csv_filename = os.path.join(RESULTS_DIR, f"accuracy_stats_{timestamp}.csv")
    stats_df.to_csv(csv_filename, index=False)
    print(f"💾 Statistiques sauvegardées: {csv_filename}")
    
    # Sauvegarder les métriques détaillées en JSON
    json_data = {}
    for measurement, data in metrics.items():
        json_data[measurement] = {
            'mae': float(data['mae']),
            'rmse': float(data['rmse']),
            'percentage_error': float(data['percentage_error']),
            'n_samples': int(data['n_samples'])
        }
    
    json_filename = os.path.join(RESULTS_DIR, f"accuracy_metrics_{timestamp}.json")
    with open(json_filename, 'w') as f:
        json.dump(json_data, f, indent=2)
    print(f"💾 Métriques sauvegardées: {json_filename}")


def main():
    """Fonction principale"""
    print("=" * 60)
    print("🔬 ANALYSE DE PRÉCISION - MESURES CORPORELLES")
    print("=" * 60)
    
    try:
        # Télécharger le dataset
        df = download_dataset()
        
        # Analyser le dataset (tous les échantillons)
        predictions, ground_truths = analyze_dataset(df, max_samples=None)
        
        if len(predictions) == 0:
            print("\n❌ Aucune prédiction réussie. Impossible de calculer les métriques.")
            return
        
        # Calculer les métriques
        print("\n📊 Calcul des métriques...")
        metrics = calculate_metrics(predictions, ground_truths)
        
        # Générer les statistiques
        stats_df = generate_statistics(metrics)
        print("\n" + "=" * 60)
        print("📈 STATISTIQUES DE PRÉCISION")
        print("=" * 60)
        print(stats_df.to_string(index=False))
        
        # Créer les graphiques
        print("\n📊 Génération des graphiques...")
        plot_results(metrics)
        
        # Sauvegarder les résultats
        print("\n💾 Sauvegarde des résultats...")
        save_results(metrics, stats_df)
        
        print("\n" + "=" * 60)
        print("✅ ANALYSE TERMINÉE")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Erreur fatale: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
