/**
 * Backend API client.
 * 
 * Render'daki backend'e baglaniyor. Token AsyncStorage'da saklaniyor,
 * her istekte Authorization header'a otomatik ekleniyor.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend URL — Render'da deploy edilmis servisin URL'i
export const API_BASE_URL = 'https://saha-satis-planlama-5jdb.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 saniye (Render free tier yavas uyaniyor)
});

// Her istek oncesi token'i ekle
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 alirsak token'i silelim, login'e yonlendirelim (sonra)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;
