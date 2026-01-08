import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

interface JWTPayload {
  userId: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        success: false, 
        message: 'Token manquant ou format invalide' 
      });
      return;
    }

    const token = authHeader.substring(7); // Enlever "Bearer "

    // Vérifier la présence de la clé secrète
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET non défini dans .env');
      res.status(500).json({ 
        success: false, 
        message: 'Erreur de configuration du serveur' 
      });
      return;
    }

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    // Ajouter l'ID utilisateur à la requête
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false, 
        message: 'Token invalide' 
      });
      return;
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ 
        success: false, 
        message: 'Token expiré' 
      });
      return;
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la vérification du token' 
    });
  }
};
