import express, { Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { User } from '../models/User';

const router = express.Router();

// Route protégée pour récupérer le profil de l'utilisateur connecté
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // L'ID utilisateur a été ajouté par le middleware
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          pseudo: user.pseudo,
          email: user.email,
          mensurations: user.mensurations,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error: any) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
      error: error.message
    });
  }
});

// Route protégée pour ajouter une mensuration
router.post('/mensurations', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { valeur, unite } = req.body;

    // Validation
    if (!valeur || !unite) {
      res.status(400).json({
        success: false,
        message: 'Valeur et unité sont requises'
      });
      return;
    }

    if (typeof valeur !== 'number' || valeur <= 0) {
      res.status(400).json({
        success: false,
        message: 'La valeur doit être un nombre positif'
      });
      return;
    }

    // Trouver l'utilisateur et ajouter la mensuration
    const user = await User.findById(req.userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    user.mensurations.push({
      valeur,
      unite,
      timestamp: new Date()
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Mensuration ajoutée avec succès',
      data: {
        mensurations: user.mensurations
      }
    });
  } catch (error: any) {
    console.error('Erreur lors de l\'ajout de la mensuration:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de la mensuration',
      error: error.message
    });
  }
});

// Route protégée pour récupérer toutes les mensurations
router.get('/mensurations', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('mensurations');
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    // Trier les mensurations par timestamp décroissant (plus récent en premier)
    const sortedMensurations = [...user.mensurations].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.status(200).json({
      success: true,
      data: {
        mensurations: sortedMensurations
      }
    });
  } catch (error: any) {
    console.error('Erreur lors de la récupération des mensurations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des mensurations',
      error: error.message
    });
  }
});

// Route protégée pour mettre à jour le profil
router.put('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pseudo } = req.body;

    if (!pseudo || pseudo.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Le pseudo ne peut pas être vide'
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { pseudo: pseudo.trim() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: { user }
    });
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
      error: error.message
    });
  }
});

export default router;
