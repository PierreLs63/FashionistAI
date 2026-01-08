#!/usr/bin/env python3
"""Test rapide pour vérifier l'accès au dataset"""

from datasets import load_dataset

print("🔍 Test de chargement du dataset...")
try:
    dataset = load_dataset("UniqueData/body-measurements-dataset", split="train")
    print(f"✅ Dataset chargé: {len(dataset)} échantillons")
    print(f"\n📊 Structure du premier échantillon:")
    
    sample = dataset[0]
    for key, value in sample.items():
        if key in ['selfie', 'front', 'side']:
            print(f"  {key}: Image PIL ({value.size if hasattr(value, 'size') else 'N/A'})")
        elif key == 'measurements':
            print(f"  {key}: {value[:100]}..." if isinstance(value, str) and len(value) > 100 else f"  {key}: {value}")
        else:
            print(f"  {key}: {value}")
    
    print("\n✅ Test réussi ! Le script analyze_accuracy.py devrait fonctionner.")
    
except Exception as e:
    print(f"❌ Erreur: {e}")
    print("\n💡 Solution:")
    print("   pip install datasets huggingface-hub")
