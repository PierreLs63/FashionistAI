# 👗 FashionistAI

**Application de prise de mesures corporelles avec détection de pose IA (YOLO v8)**

FashionistAI utilise la détection de pose par intelligence artificielle pour calculer automatiquement les mensurations corporelles à partir d'une simple photo.

## 🎯 Fonctionnalités

- 📸 **Capture photo** : PC (webcam) ou Mobile (via QR Code)
- 🤖 **Détection de pose IA** : YOLOv8-Pose (17 points clés du corps)
- 📏 **Calcul automatique** : Mensurations réelles basées sur la taille
- �� **Architecture moderne** : TypeScript + Python + React
- 🔄 **Temps réel** : WebSocket (Socket.IO)

## 🚀 Installation

### Prérequis

- Node.js 18+ 
- Python 3.10 ou 3.11
- npm
- PyTorch < 2.6

### Installation

```bash
./setup.sh
```

## 🎮 Utilisation

```bash
./run.sh
```

**Accès :** http://localhost:3000

## 📊 Logs

```bash
tail -f logs/backend.log
tail -f logs/python.log  
tail -f logs/frontend.log
```

## 🛠️ Développement

```bash
npm run dev           # Backend (watch mode)
cd frontend && npm start  # Frontend
```

## 📄 Licence

MIT
