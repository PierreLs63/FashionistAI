#!/bin/bash

# Script d'installation pour l'analyse de précision

echo "╔══════════════════════════════════════════════╗"
echo "║  Installation - Analyse de Précision        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

# Activer l'environnement virtuel
if [ -d "venv" ]; then
    echo "🐍 Activation de l'environnement virtuel..."
    source venv/bin/activate
else
    echo "❌ Environnement virtuel non trouvé. Exécutez ./setup.sh d'abord."
    exit 1
fi

# Installer les dépendances
echo "📦 Installation des dépendances d'analyse..."
pip install -r requirements_analysis.txt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Installation terminée !"
    echo ""
    echo "Pour lancer l'analyse :"
    echo "   python analyze_accuracy.py"
    echo ""
else
    echo "❌ Erreur lors de l'installation"
    exit 1
fi
