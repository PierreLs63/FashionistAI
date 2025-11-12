#!/bin/bash

# Simple script to start all services manually
# Uses absolute paths to avoid PATH issues

set -e

ROOT_DIR="/Users/pierre-louis/Documents/cours/SVP/FashionistAI"
cd "$ROOT_DIR"

echo "🚀 Démarrage des services FashionistAI..."
echo ""

# Create logs directory
mkdir -p logs

# Stop existing services
echo "🛑 Arrêt des services existants..."
pkill -f "tsx.*server.ts" 2>/dev/null || true
pkill -f "uvicorn.*main:app" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true
lsof -ti:3000,5001,8000 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

# Start Python microservice
echo "🐍 Démarrage du microservice Python..."
cd "$ROOT_DIR/microservices/python"
./venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 5001 > "$ROOT_DIR/logs/python.log" 2>&1 &
PYTHON_PID=$!
echo "   ✅ Lancé (PID: $PYTHON_PID)"
cd "$ROOT_DIR"
sleep 3

# Start TypeScript backend (using conda's node)
echo "⚙️  Démarrage du backend TypeScript..."
/usr/local/bin/node node_modules/.bin/tsx watch src/server.ts > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "   ✅ Lancé (PID: $BACKEND_PID)"
sleep 3

# Start React frontend
echo "⚛️  Démarrage du frontend React..."
cd "$ROOT_DIR/frontend"
/usr/local/bin/node $HOME/.npm-global/bin/npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   ✅ Lancé (PID: $FRONTEND_PID)"
cd "$ROOT_DIR"

echo ""
echo "⏳ Attente du démarrage (10 secondes)..."
sleep 10

echo ""
echo "🏥 Vérification des services..."

# Test with timeout
if curl --max-time 3 -s http://127.0.0.1:5001/health > /dev/null 2>&1; then
    echo "   ✅ Python microservice: OK"
else
    echo "   ❌ Python microservice: échec"
fi

if curl --max-time 3 -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
    echo "   ✅ TypeScript backend: OK"
else
    echo "   ❌ TypeScript backend: échec"
fi

echo ""
echo "✅ Services démarrés !"
echo ""
echo "📋 Logs:"
echo "   tail -f logs/python.log"
echo "   tail -f logs/backend.log"
echo "   tail -f logs/frontend.log"
echo ""
echo "🛑 Pour arrêter:"
echo "   pkill -f 'tsx|uvicorn|react-scripts'"
