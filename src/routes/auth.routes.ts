import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const router = express.Router();

// Fonction utilitaire pour générer un token JWT
const generateToken = (userId: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET non défini');
  }
  
  return jwt.sign(
    { userId }, 
    jwtSecret, 
    { expiresIn: '7d' } // Token valide 7 jours
  );
};

// Route d'inscription
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pseudo, email, password } = req.body;

    // Validation des champs
    if (!pseudo || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
      return;
    }

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'Un compte avec cet email existe déjà'
      });
      return;
    }

    // Créer le nouvel utilisateur
    const user = new User({
      pseudo,
      email: email.toLowerCase(),
      password,
      mensurations: []
    });

    await user.save();

    // Générer le token
    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: {
        token,
        user: {
          id: user._id,
          pseudo: user.pseudo,
          email: user.email,
          mensurations: user.mensurations
        }
      }
    });
  } catch (error: any) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription',
      error: error.message
    });
  }
});

// Route de connexion
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation des champs
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
      return;
    }

    // Trouver l'utilisateur
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
      return;
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
      return;
    }

    // Générer le token
    const token = generateToken(user._id.toString());

    res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      data: {
        token,
        user: {
          id: user._id,
          pseudo: user.pseudo,
          email: user.email,
          mensurations: user.mensurations
        }
      }
    });
  } catch (error: any) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: error.message
    });
  }
});

export default router;
