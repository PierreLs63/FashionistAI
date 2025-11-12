#!/bin/bash

# ==========================================
# FashionistAI - Run Script
# ==========================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"
ROOT_DIR="$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       🚀 FashionistAI - Démarrage           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ==========================================
# Stop existing services
# ==========================================

echo -e "${YELLOW}🛑 Arrêt des services existants...${NC}"
pkill -f "tsx.*server.ts" 2>/dev/null || true
pkill -f "node.*dist/server.js" 2>/dev/null || true
pkill -f "uvicorn.*main:app" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true
lsof -ti:3000,5001,8000 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
echo -e "${GREEN}✅ Services arrêtés${NC}"
echo ""

# ==========================================
# Create log directory
# ==========================================

mkdir -p logs

# ==========================================
# Start Python Microservice
# ==========================================

echo -e "${BLUE}🐍 Démarrage du microservice Python (YOLO)...${NC}"
cd microservices/python

if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Environnement virtuel Python non trouvé${NC}"
    echo "   Exécutez d'abord: ./setup.sh"
    exit 1
fi

# Start Python service using the venv's python directly
nohup ./venv/bin/python -m uvicorn main:app \
    --host 0.0.0.0 \
    --port 5001 \
    --log-level info \
    > "$ROOT_DIR/logs/python.log" 2>&1 &

PYTHON_PID=$!
sleep 2

# Check if Python service started
if ps -p $PYTHON_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Lancé (PID: $PYTHON_PID) sur http://localhost:5001${NC}"
else
    echo -e "${RED}   ❌ Échec du démarrage du microservice Python${NC}"
    echo "   Consultez les logs: logs/python.log"
    exit 1
fi

cd ../..
echo ""

# ==========================================
# Start TypeScript Backend
# ==========================================

echo -e "${BLUE}⚙️  Démarrage du backend TypeScript...${NC}"

# Try to find node in common locations
NODE_BIN=""
if [ -f "/usr/local/bin/node" ]; then
    NODE_BIN="/usr/local/bin/node"
elif [ -f "$HOME/.nvm/current/bin/node" ]; then
    NODE_BIN="$HOME/.nvm/current/bin/node"
elif [ -f "/opt/homebrew/bin/node" ]; then
    NODE_BIN="/opt/homebrew/bin/node"
else
    # Try to use node from PATH if available
    NODE_BIN=$(command -v node 2>/dev/null || echo "")
fi

if [ -z "$NODE_BIN" ]; then
    echo -e "${RED}   ❌ Node.js introuvable${NC}"
    echo "   Installez Node.js ou utilisez start-services.sh"
    kill $PYTHON_PID 2>/dev/null
    exit 1
fi

# Check if we should use dev mode or production
if [ "$1" == "prod" ]; then
    # Production mode
    if [ ! -d "dist" ]; then
        echo "   Compilation TypeScript..."
        $NODE_BIN node_modules/.bin/tsc
    fi
    nohup $NODE_BIN dist/server.js > logs/backend.log 2>&1 &
else
    # Development mode with watch
    nohup $NODE_BIN node_modules/.bin/tsx watch src/server.ts > logs/backend.log 2>&1 &
fi

BACKEND_PID=$!
sleep 3

# Check if backend started
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}   ✅ Lancé (PID: $BACKEND_PID) sur http://localhost:8000${NC}"
else
    echo -e "${RED}   ❌ Échec du démarrage du backend${NC}"
    echo "   Consultez les logs: logs/backend.log"
    kill $PYTHON_PID 2>/dev/null
    exit 1
fi

echo ""

# ==========================================
# Start React Frontend
# ==========================================

echo -e "${BLUE}⚛️  Démarrage du frontend React...${NC}"
cd frontend

# Try to find node in common locations (same as backend)
NODE_BIN=""
if [ -f "/usr/local/bin/node" ]; then
    NODE_BIN="/usr/local/bin/node"
elif [ -f "$HOME/.nvm/current/bin/node" ]; then
    NODE_BIN="$HOME/.nvm/current/bin/node"
elif [ -f "/opt/homebrew/bin/node" ]; then
    NODE_BIN="/opt/homebrew/bin/node"
else
    NODE_BIN=$(command -v node 2>/dev/null || echo "")
fi

if [ -z "$NODE_BIN" ]; then
    echo -e "${RED}   ❌ Node.js introuvable pour le frontend${NC}"
    kill $PYTHON_PID $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start React with npm start via node
nohup $NODE_BIN node_modules/.bin/react-scripts start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

echo -e "${GREEN}   ✅ Lancé (PID: $FRONTEND_PID) sur http://localhost:3000${NC}"

cd ..
echo ""

# ==========================================
# Wait for services to be ready
# ==========================================

echo -e "${YELLOW}⏳ Attente du démarrage complet...${NC}"
sleep 5

# ==========================================
# Health checks (with timeout & retries)
# ==========================================

echo ""
echo -e "${BLUE}🏥 Vérification de l'état des services...${NC}"

# Helper: check a URL with curl using a per-request timeout and limited retries
check_health() {
    local url="$1"
    local name="$2"
    local max_attempts=${3:-5}
    local timeout_secs=${4:-5}

    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl --silent --show-error --fail --max-time "$timeout_secs" "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}   ✅ $name: OK${NC}"
            return 0
        else
            echo -e "${YELLOW}   ⚠️  $name: tentative $attempt/$max_attempts échouée (timeout=${timeout_secs}s)${NC}"
            attempt=$((attempt + 1))
            sleep 1
        fi
    done

    echo -e "${RED}   ❌ $name: NON DISPONIBLE après $max_attempts tentatives${NC}"
    return 1
}

# Check Python (short timeout)
if ! check_health "http://127.0.0.1:5001/health" "Python microservice" 5 4; then
    echo "      Logs: tail -f $ROOT_DIR/logs/python.log"
fi

# Check Backend (short timeout)
if ! check_health "http://127.0.0.1:8000/health" "TypeScript backend" 5 4; then
    echo "      Logs: tail -f $ROOT_DIR/logs/backend.log"
fi

# Frontend check (longer startup time allowed)
if ! check_health "http://127.0.0.1:3000" "React frontend" 6 8; then
    echo -e "${YELLOW}   ⏳ React frontend: EN COURS DE DÉMARRAGE...${NC}"
    echo "      Logs: tail -f $ROOT_DIR/logs/frontend.log"
fi

echo ""

# ==========================================
# Get Network IP
# ==========================================

OS_TYPE=$(uname)
if [ "$OS_TYPE" == "Darwin" ]; then
    NETWORK_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
else
    NETWORK_IP=$(ip addr show | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}' | cut -d/ -f1)
fi

if [ -z "$NETWORK_IP" ]; then
    NETWORK_IP=$(grep "^NETWORK_IP=" .env 2>/dev/null | cut -d= -f2)
fi

# ==========================================
# Summary
# ==========================================

echo "╔══════════════════════════════════════════════╗"
echo "║         ✅ FashionistAI Démarré !            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}📱 Accès PC :${NC}"
echo "   http://localhost:3000"
echo ""
echo -e "${GREEN}📱 Accès Mobile (QR Code) :${NC}"
echo "   http://$NETWORK_IP:8000"
echo ""
echo -e "${GREEN}🔧 Services :${NC}"
echo "   • Backend TypeScript : http://localhost:8000"
echo "   • Python Microservice: http://localhost:5001"
echo "   • Frontend React     : http://localhost:3000"
echo ""
echo -e "${YELLOW}📋 Logs :${NC}"
echo "   • Backend  : tail -f logs/backend.log"
echo "   • Python   : tail -f logs/python.log"
echo "   • Frontend : tail -f logs/frontend.log"
echo ""
echo -e "${YELLOW}🛑 Pour arrêter :${NC}"
echo "   pkill -f 'tsx|uvicorn|react-scripts'"
echo "   # ou fermez ce terminal"
echo ""
echo -e "${BLUE}🎯 Prêt à capturer des poses avec YOLO !${NC}"
echo ""

# Keep script running to show logs
echo -e "${YELLOW}Appuyez sur Ctrl+C pour arrêter tous les services${NC}"
echo ""

# Trap Ctrl+C
trap 'echo ""; echo "🛑 Arrêt des services..."; kill $PYTHON_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT

# Wait for all background processes
wait
