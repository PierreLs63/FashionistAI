import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import QRCode from 'qrcode';
import multer from 'multer';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express App
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, config.socketIO);

// Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure Multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = join(__dirname, '..', config.upload.dest);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize }
});

// Session storage
interface Session {
  pcSocketId: string;
  mobileSocketId: string | null;
  status: 'waiting' | 'connected' | 'capturing' | 'analyzing';
  createdAt: number;
}

const sessions = new Map<string, Session>();
const socketToSession = new Map<string, string>();

// ====================
// API ROUTES
// ====================

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'FashionistAI TypeScript Backend',
    pythonService: config.pythonService.url,
    version: '2.0.0'
  });
});

// Generate QR Code
app.get('/api/generate-qr', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || uuidv4();

    console.log(`📱 Generating QR code for session: ${sessionId}`);

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        pcSocketId: sessionId,
        mobileSocketId: null,
        status: 'waiting',
        createdAt: Date.now()
      });
    }

    const mobileUrl = `http://${config.networkIP}:${config.port}/mobile-capture?session=${sessionId}`;

    console.log(`✅ Generated QR code with URL: ${mobileUrl}`);

    const qrCodeDataURL = await QRCode.toDataURL(mobileUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#667eea',
        light: '#ffffff'
      }
    });

    res.json({
      success: true,
      sessionId,
      qrCode: qrCodeDataURL,
      mobileUrl
    });
  } catch (error: any) {
    console.error('❌ Error generating QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR code'
    });
  }
});

// Analyze pose via Python microservice
app.post('/api/analyze-pose', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        detail: 'No image file provided'
      });
    }

    const { height } = req.body;

    if (!height) {
      return res.status(400).json({
        success: false,
        detail: 'Height parameter is required'
      });
    }

    console.log(`🔍 Analyzing pose for height: ${height}cm`);

    // Send to Python microservice
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path), req.file.filename);
    formData.append('height', height);

    const response = await axios.post(
      `${config.pythonService.url}/analyze-pose`,
      formData,
      {
        headers: formData.getHeaders(),
        // Set a reasonable timeout to avoid hanging when Python service is down
        timeout: 5000 // 5 seconds
      }
    );

    // Delete temporary file
    fs.unlinkSync(req.file.path);

    console.log(`✅ Pose analyzed successfully`);
    res.json(response.data);
  } catch (error: any) {
    // Handle axios timeout / connection refused distinctly
    const isAxiosError = error.isAxiosError;
    const errMsg = error.message || 'Error analyzing image';
    console.error('❌ Error analyzing pose:', errMsg);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (isAxiosError && (error.code === 'ECONNABORTED' || errMsg.includes('timeout'))) {
      return res.status(504).json({
        success: false,
        detail: 'Le microservice Python ne répond pas (timeout).'
      });
    }

    if (isAxiosError && error.code === 'ECONNREFUSED') {
      return res.status(502).json({
        success: false,
        detail: 'Connexion refusée vers le microservice Python.'
      });
    }

    res.status(500).json({
      success: false,
      detail: error.response?.data?.detail || errMsg
    });
  }
});

// Mobile capture page
app.get('/mobile-capture', (req: Request, res: Response) => {
  const { session } = req.query;

  if (!session || !sessions.has(session as string)) {
    return res.status(404).send('<h1>Session invalide ou expirée</h1>');
  }

  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>FashionistAI - Capture Mobile</title>
    <script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
        }
        .container {
            width: 100%;
            max-width: 500px;
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #667eea;
            margin-bottom: 20px;
            text-align: center;
            font-size: 24px;
        }
        #videoContainer {
            position: relative;
            width: 100%;
            border-radius: 15px;
            overflow: hidden;
            background: #000;
            margin-bottom: 20px;
        }
        video {
            width: 100%;
            display: block;
        }
        button {
            width: 100%;
            padding: 15px;
            font-size: 18px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: bold;
        }
        #captureBtn {
            background: #667eea;
            color: white;
            margin-bottom: 10px;
        }
        #captureBtn:hover { background: #5568d3; }
        #captureBtn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .status {
            text-align: center;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-weight: 500;
        }
        .status.connected { background: #d4edda; color: #155724; }
        .status.waiting { background: #fff3cd; color: #856404; }
        .status.error { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📸 Capture Photo</h1>
        <div id="status" class="status waiting">Connexion...</div>
        <div id="videoContainer">
            <video id="video" autoplay playsinline></video>
        </div>
        <button id="captureBtn" disabled>Prendre la photo</button>
    </div>

    <script>
        const sessionId = '${session}';
        const socket = io('http://${config.networkIP}:${config.port}');
        const video = document.getElementById('video');
        const captureBtn = document.getElementById('captureBtn');
        const statusDiv = document.getElementById('status');

        // Connect mobile to session
        socket.emit('mobile-join', { sessionId });

        socket.on('session-ready', () => {
            statusDiv.textContent = '✅ Connecté au PC';
            statusDiv.className = 'status connected';
        });

        // Start camera
        async function startCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: 1920, height: 1080 }
                });
                video.srcObject = stream;
                captureBtn.disabled = false;
            } catch (err) {
                statusDiv.textContent = '❌ Erreur caméra: ' + err.message;
                statusDiv.className = 'status error';
            }
        }

        startCamera();

        captureBtn.addEventListener('click', () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            
            canvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    socket.emit('photo-captured', {
                        sessionId,
                        imageData: reader.result
                    });
                    statusDiv.textContent = '📤 Photo envoyée !';
                    statusDiv.className = 'status connected';
                };
                reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.9);
        });
    </script>
</body>
</html>
  `);
});

// ====================
// WEBSOCKET
// ====================

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // PC joins with session ID
  socket.on('pc-join', ({ sessionId }: { sessionId: string }) => {
    console.log(`💻 PC joining with session ID: ${sessionId}`);
    
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        pcSocketId: socket.id,
        mobileSocketId: null,
        status: 'waiting',
        createdAt: Date.now()
      });
      console.log(`✅ Created new session: ${sessionId}`);
    } else {
      const session = sessions.get(sessionId)!;
      session.pcSocketId = socket.id;
      console.log(`✅ PC reconnected to session: ${sessionId}`);
    }

    socketToSession.set(socket.id, sessionId);
    socket.join(sessionId);
    console.log(`💻 PC connected to session: ${sessionId}`);
  });

  // Mobile joins with session ID
  socket.on('mobile-join', ({ sessionId }: { sessionId: string }) => {
    console.log(`📱 Mobile joining session: ${sessionId}`);
    
    const session = sessions.get(sessionId);
    if (!session) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }

    session.mobileSocketId = socket.id;
    session.status = 'connected';
    socketToSession.set(socket.id, sessionId);
    socket.join(sessionId);

    // Notify PC
    io.to(session.pcSocketId).emit('mobile-connected');
    socket.emit('session-ready');
    
    console.log(`✅ Mobile connected to session: ${sessionId}`);
  });

  // Photo captured from mobile
  socket.on('photo-captured', ({ sessionId, imageData }: { sessionId: string; imageData: string }) => {
    console.log(`📸 Photo captured for session: ${sessionId}`);
    
    const session = sessions.get(sessionId);
    if (!session) return;

    // Send to PC
    io.to(session.pcSocketId).emit('photo-received', { imageData });
    console.log(`✅ Photo sent to PC`);
  });

  // Trigger capture from PC
  socket.on('trigger-capture', ({ sessionId }: { sessionId: string }) => {
    console.log(`🎯 Trigger capture for session: ${sessionId}`);
    
    const session = sessions.get(sessionId);
    if (!session || !session.mobileSocketId) {
      socket.emit('error', { message: 'Mobile not connected' });
      return;
    }

    io.to(session.mobileSocketId).emit('capture-requested');
    console.log(`✅ Capture triggered on mobile`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    const sessionId = socketToSession.get(socket.id);
    
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session) {
        if (session.pcSocketId === socket.id) {
          console.log(`💻 PC disconnected from session: ${sessionId}`);
        } else if (session.mobileSocketId === socket.id) {
          console.log(`📱 Mobile disconnected from session: ${sessionId}`);
          session.mobileSocketId = null;
          session.status = 'waiting';
        }
      }
      socketToSession.delete(socket.id);
    }
  });
});

// ====================
// START SERVER
// ====================

httpServer.listen(config.port, config.host, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   FashionistAI TypeScript Backend v2.0       ║
║   🚀 Server running on port ${config.port}            ║
║   🌐 Network IP: http://${config.networkIP}:${config.port}  ║
║   📱 Mobile capture with QR Code enabled     ║
║   🔌 WebSocket ready for real-time comm      ║
║   🐍 Python microservice: ${config.pythonService.url}  ║
╚══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, closing server...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
