import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Intercepteur pour ajouter automatiquement le token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Intercepteur pour gérer les erreurs d'authentification
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.removeToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Gestion du token
  setToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  removeToken(): void {
    localStorage.removeItem('authToken');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Auth endpoints
  async register(pseudo: string, email: string, password: string) {
    const response = await this.api.post('/api/auth/register', {
      pseudo,
      email,
      password
    });
    if (response.data.data.token) {
      this.setToken(response.data.data.token);
    }
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.api.post('/api/auth/login', {
      email,
      password
    });
    if (response.data.data.token) {
      this.setToken(response.data.data.token);
    }
    return response.data;
  }

  logout(): void {
    this.removeToken();
  }

  // User endpoints
  async getProfile() {
    const response = await this.api.get('/api/user/me');
    return response.data;
  }

  async updateProfile(pseudo: string) {
    const response = await this.api.put('/api/user/me', { pseudo });
    return response.data;
  }

  async getMensurations() {
    const response = await this.api.get('/api/user/mensurations');
    return response.data;
  }

  async addMensuration(valeur: number, unite: string) {
    const response = await this.api.post('/api/user/mensurations', {
      valeur,
      unite
    });
    return response.data;
  }
}

export default new ApiService();
