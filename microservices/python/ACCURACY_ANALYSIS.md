# Analyse de Précision du Modèle

Ce script analyse la précision du modèle de mesures corporelles en comparant les prédictions YOLO avec le dataset réel de HuggingFace.

## Dataset

Dataset utilisé: [UniqueData/body-measurements-dataset](https://huggingface.co/datasets/UniqueData/body-measurements-dataset)

Le dataset contient **315 échantillons** avec :
- **Images** : selfie, front (face), side (profil)
- **Mesures réelles** : taille, poids, tour de poitrine, tour de taille, hanches, longueur de jambe, etc.
- **Métadonnées** : âge, genre, origine ethnique, profession

## Installation

1. Installer les dépendances supplémentaires :

```bash
cd microservices/python
source venv/bin/activate  # Activer l'environnement virtuel
pip install -r requirements_analysis.txt
```

## Utilisation

### Exécution basique

```bash
python analyze_accuracy.py
```

Le script va :
1. ✅ Télécharger le dataset depuis HuggingFace (auto-conversion en Parquet)
2. 🔍 Analyser les images **front** avec YOLO pour détecter les poses
3. 📏 Calculer les mesures prédites à partir des keypoints
4. 📊 Comparer avec les mesures réelles du dataset
5. 📈 Générer des statistiques et graphiques
6. 💾 Sauvegarder les résultats dans `accuracy_results/`

### Analyser tout le dataset

Par défaut, le script analyse 50 échantillons. Pour analyser les 315 :

Modifiez le fichier `analyze_accuracy.py` ligne ~395 :

```python
max_samples = None  # Au lieu de 50
```

⚠️ **Attention** : L'analyse complète peut prendre 10-15 minutes selon votre machine.

## Résultats

Les résultats sont sauvegardés dans le dossier `accuracy_results/` :

- `accuracy_results.json` : Statistiques détaillées en JSON
- `accuracy_analysis.png` : Graphiques de visualisation

### Métriques calculées

Pour chaque mesure corporelle :

- **Erreur absolue moyenne (MAE)** : Différence moyenne en cm
- **Écart-type** : Variabilité des erreurs
- **Erreur médiane** : Valeur médiane des erreurs
- **Erreur en pourcentage** : Erreur relative en %

### Graphiques générés

1. **Distribution des erreurs** : Histogramme montrant la fréquence des erreurs pour chaque mesure
2. **Prédictions vs Réalité** : Scatter plot comparant prédictions YOLO et valeurs réelles

## Workflow du script

```
1. Téléchargement du dataset HuggingFace
   ↓
2. Pour chaque échantillon :
   ├─ Charger l'image front (pose face caméra)
   ├─ Récupérer les mesures réelles (JSON)
   ├─ Inférence YOLO → détection des 17 keypoints
   ├─ Calcul des mesures prédites (via main.py)
   └─ Comparaison avec les mesures réelles
   ↓
3. Calcul des métriques d'erreur
   ↓
4. Génération des graphiques
   ↓
5. Sauvegarde des résultats
```

## Mesures comparées

| Prédiction YOLO | Mesure réelle (dataset) |
|----------------|------------------------|
| `shoulder_width` | `shoulder_width` |
| `estimated_chest_circumference` | `chest_circumference` |
| `estimated_waist_circumference` | `waist_circumference` |
| `arm_length` | `arm_length` |
| `leg_length` | `leg_length` ou `inseam` |

## Interprétation

### Bonne précision
- Erreur absolue moyenne < 5 cm
- Erreur en pourcentage < 10%
- Points proches de la ligne rouge (prédiction parfaite)

### Précision à améliorer
- Erreur absolue moyenne > 10 cm
- Erreur en pourcentage > 20%
- Points dispersés loin de la ligne de référence

## Limitations

### Limitations du dataset
- 315 échantillons (petit dataset)
- Poses standardisées (peut différer des poses réelles des utilisateurs)
- Qualité d'éclairage contrôlée
- Vêtements ajustés (peut différer de l'usage réel)

### Limitations du modèle
- YOLOv8-Pose détecte 17 keypoints (peut manquer de précision sur certains points)
- Estimation des circonférences basée sur la largeur visible (approximation)
- Sensible à l'angle de la caméra
- Performances variables selon la morphologie

## Pour une analyse réelle avec images

✅ Le script utilise maintenant les **vraies images** du dataset HuggingFace et fait des **prédictions YOLO réelles** !

Plus besoin de simulation, tout le pipeline est fonctionnel :
1. Image réelle → YOLO → Keypoints
2. Keypoints → Calcul mesures → Prédictions
3. Prédictions vs Mesures réelles → Métriques d'erreur

## Personnalisation

### Modifier les formules d'estimation

Dans `analyze_dataset()`, ajustez les coefficients :

```python
if pred_key == 'estimated_chest_circumference':
    predicted_value = height_cm * 0.52  # Ajustez ce coefficient
```

### Ajouter d'autres mesures

1. Ajoutez la mesure dans `measurements_mapping`
2. Ajoutez la formule d'estimation dans la boucle
3. Le reste est automatique

## Exemple de sortie

```
📊 RÉSUMÉ DE L'ANALYSE
================================

📈 Échantillons:
   Total: 100
   Succès: 98
   Échecs: 2

📏 Statistiques par mesure:

   estimated_chest_circumference:
      Échantillons: 98
      Erreur absolue moyenne: 8.45 cm
      Écart-type: 3.21 cm
      Médiane: 7.82 cm
      Erreur % moyenne: 9.34%
```

## Améliorations futures

- [ ] Intégration avec un dataset d'images réelles
- [ ] Analyse par genre (homme/femme)
- [ ] Analyse par tranche de taille
- [ ] Matrice de confusion pour les catégories de tailles
- [ ] Export des résultats en CSV
- [ ] Graphiques interactifs (Plotly)
- [ ] Comparaison avec d'autres modèles
