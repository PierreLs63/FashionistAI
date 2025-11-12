#!/bin/bash

# ==========================================
# FashionistAI - Setup Script
# ==========================================

set -e  # Exit on error

echo "╔══════════════════════════════════════════════╗"
echo "║     FashionistAI - Installation Setup       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on macOS or Linux
OS_TYPE=$(uname)

# ==========================================
# 1. Check Prerequisites
# ==========================================

echo "🔍 Vérification des prérequis..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    echo "   Installez Node.js depuis https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js${NC} $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé${NC}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm${NC} v$NPM_VERSION"

# Check Python 3.10
if command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
    PYTHON_VERSION=$(python3.10 --version)
    echo -e "${GREEN}✅ Python${NC} $PYTHON_VERSION"
elif command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
    
    if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 10 ] && [ "$MINOR" -le 11 ]; then
        PYTHON_CMD="python3"
        echo -e "${GREEN}✅ Python${NC} $PYTHON_VERSION"
    else
        echo -e "${YELLOW}⚠️  Python 3.10 ou 3.11 recommandé (trouvé: $PYTHON_VERSION)${NC}"
        echo "   PyTorch nécessite Python 3.10 ou 3.11"
        read -p "   Continuer quand même ? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        PYTHON_CMD="python3"
    fi
else
    echo -e "${RED}❌ Python 3 n'est pas installé${NC}"
    echo "   Installez Python 3.10 depuis https://www.python.org/"
    exit 1
fi

echo ""

# ==========================================
# 2. Detect Network IP
# ==========================================

echo "🌐 Détection de l'IP réseau..."

if [ "$OS_TYPE" == "Darwin" ]; then
    # macOS
    NETWORK_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
else
    # Linux
    NETWORK_IP=$(ip addr show | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}' | cut -d/ -f1)
fi

if [ -z "$NETWORK_IP" ]; then
    NETWORK_IP="192.168.1.21"
    echo -e "${YELLOW}⚠️  Impossible de détecter l'IP, utilisation de: ${NETWORK_IP}${NC}"
else
    echo -e "${GREEN}✅ IP réseau détectée: ${NETWORK_IP}${NC}"
fi

echo ""

# ==========================================
# 3. Create .env file
# ==========================================

echo "📝 Configuration de l'environnement..."

if [ ! -f .env ]; then
    cp .env.example .env
    # Update NETWORK_IP in .env
    if [ "$OS_TYPE" == "Darwin" ]; then
        sed -i '' "s/# NETWORK_IP=.*/NETWORK_IP=$NETWORK_IP/" .env
    else
        sed -i "s/# NETWORK_IP=.*/NETWORK_IP=$NETWORK_IP/" .env
    fi
    echo -e "${GREEN}✅ Fichier .env créé${NC}"
else
    echo -e "${YELLOW}⚠️  .env existe déjà, conservation${NC}"
fi

echo ""

# ==========================================
# 4. Install Backend Dependencies
# ==========================================

echo "📦 Installation des dépendances du backend TypeScript..."
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances backend installées${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'installation des dépendances backend${NC}"
    exit 1
fi

echo ""

# ==========================================
# 5. Install Frontend Dependencies
# ==========================================

echo "📦 Installation des dépendances du frontend React..."
cd frontend
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances frontend installées${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'installation des dépendances frontend${NC}"
    exit 1
fi

cd ..
echo ""

# ==========================================
# 6. Setup Python Microservice
# ==========================================

echo "🐍 Configuration du microservice Python..."

cd microservices/python

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "   Création de l'environnement virtuel..."
    $PYTHON_CMD -m venv venv
    echo -e "${GREEN}✅ Environnement virtuel créé${NC}"
else
    echo -e "${YELLOW}⚠️  venv existe déjà${NC}"
fi

# Activate and install dependencies
echo "   Installation des dépendances Python..."
source venv/bin/activate

pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances Python installées${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'installation des dépendances Python${NC}"
    deactivate
    cd ../..
    exit 1
fi

deactivate
cd ../..

echo ""

# ==========================================
# 7. Create necessary directories
# ==========================================

echo "📁 Création des dossiers nécessaires..."

mkdir -p uploads
mkdir -p logs
mkdir -p microservices/python/uploads

echo -e "${GREEN}✅ Dossiers créés${NC}"
echo ""

# ==========================================
# 8. Check YOLO Model
# ==========================================

echo "🤖 Vérification du modèle YOLO..."

if [ -f "microservices/python/yolov8n-pose.pt" ]; then
    MODEL_SIZE=$(du -h microservices/python/yolov8n-pose.pt | awk '{print $1}')
    echo -e "${GREEN}✅ Modèle YOLO trouvé (${MODEL_SIZE})${NC}"
else
    echo -e "${YELLOW}⚠️  Modèle YOLO non trouvé${NC}"
    echo "   Le modèle sera téléchargé automatiquement au premier démarrage"
fi

echo ""

# ==========================================
# Final Instructions
# ==========================================

echo "╔══════════════════════════════════════════════╗"
echo "║         ✅ Installation terminée !           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Pour démarrer l'application :${NC}"
echo "   ./run.sh"
echo ""
echo -e "${GREEN}URLs d'accès :${NC}"
echo "   • Backend  : http://localhost:8000"
echo "   • Frontend : http://localhost:3000"
echo "   • Python   : http://localhost:5001"
echo ""
echo -e "${GREEN}QR Code (mobile) :${NC}"
echo "   • http://$NETWORK_IP:8000"
echo ""
echo -e "${YELLOW}Note :${NC} Si l'IP réseau change, relancez ./setup.sh"
echo ""
