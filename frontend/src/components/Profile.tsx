import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import './Profile.css';

interface Mensuration {
  valeur: number;
  unite: string;
  timestamp: Date;
  _id?: string;
}

interface UserProfile {
  id: string;
  pseudo: string;
  email: string;
  mensurations: Mensuration[];
  createdAt?: Date;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [newPseudo, setNewPseudo] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await apiService.getProfile();
      setProfile(response.data.user);
      setNewPseudo(response.data.user.pseudo);
    } catch (err: any) {
      console.error('Erreur chargement profil:', err);
      setError('Erreur lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    navigate('/login');
  };

  const handleUpdatePseudo = async () => {
    try {
      await apiService.updateProfile(newPseudo);
      setProfile(prev => prev ? { ...prev, pseudo: newPseudo } : null);
      setEditMode(false);
    } catch (err: any) {
      console.error('Erreur mise à jour:', err);
      setError('Erreur lors de la mise à jour');
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading">Chargement...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="error-message">{error || 'Profil non trouvé'}</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <h1>Mon Profil</h1>
          <button onClick={handleLogout} className="logout-btn">
            Déconnexion
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="profile-info">
          <div className="info-group">
            <label>Pseudo</label>
            {editMode ? (
              <div className="edit-group">
                <input
                  type="text"
                  value={newPseudo}
                  onChange={(e) => setNewPseudo(e.target.value)}
                  className="edit-input"
                />
                <button onClick={handleUpdatePseudo} className="save-btn">
                  ✓
                </button>
                <button onClick={() => setEditMode(false)} className="cancel-btn">
                  ✕
                </button>
              </div>
            ) : (
              <div className="info-value">
                {profile.pseudo}
                <button onClick={() => setEditMode(true)} className="edit-btn">
                  ✎
                </button>
              </div>
            )}
          </div>

          <div className="info-group">
            <label>Email</label>
            <div className="info-value">{profile.email}</div>
          </div>

          <div className="info-group">
            <label>Membre depuis</label>
            <div className="info-value">
              {profile.createdAt ? formatDate(profile.createdAt) : 'N/A'}
            </div>
          </div>
        </div>

        <div className="mensurations-section">
          <h2>Mes Mensurations</h2>
          
          {profile.mensurations && profile.mensurations.length > 0 ? (
            <div className="mensurations-list">
              {profile.mensurations
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((mensuration, index) => (
                  <div key={index} className="mensuration-item">
                    <div className="mensuration-value">
                      <span className="value">{mensuration.valeur}</span>
                      <span className="unit">{mensuration.unite}</span>
                    </div>
                    <div className="mensuration-date">
                      {formatDate(mensuration.timestamp)}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="no-mensurations">
              <p>Aucune mensuration enregistrée</p>
              <p className="hint">
                Utilisez la fonction de capture photo pour ajouter vos mensurations
              </p>
            </div>
          )}
        </div>

        <button 
          onClick={() => navigate('/')} 
          className="back-btn"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
};

export default Profile;
