import axios from 'axios';
import { useStore } from '../store/useStore';

// Default to local server port or environment URL
export const API_BASE_URL = 'http://10.0.2.2:5000/api'; // 10.0.2.2 points to host localhost in Android Emulator

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: any) => {
  const token = useStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
