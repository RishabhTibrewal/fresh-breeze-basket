import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useStore } from '../store/useStore';

/**
 * Dynamically resolves the API base URL based on runtime platform and environment:
 * - Environment variable EXPO_PUBLIC_API_URL (highest priority)
 * - Auto-detected host machine IP from Expo dev server (for physical devices running Expo Go)
 * - 10.0.2.2 for Android Emulator (maps to host localhost)
 * - localhost for iOS Simulator and Web
 */
export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // When running in a web browser, use the current browser hostname
  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost';
    return `http://${host}:5000/api`;
  }

  // Auto-detect host from Expo development server (useful when testing on physical phone via Expo Go)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000/api`;
    }
  }

  // Android emulator maps 10.0.2.2 to computer's 127.0.0.1
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  // iOS Simulator and local fallback
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const DEFAULT_TENANT_SUBDOMAIN = process.env.EXPO_PUBLIC_TENANT_SUBDOMAIN || 'default';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-Subdomain': DEFAULT_TENANT_SUBDOMAIN,
  },
});

apiClient.interceptors.request.use((config: any) => {
  const token = useStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Ensure tenant subdomain header is always attached for multi-tenant isolation
  if (!config.headers['X-Tenant-Subdomain']) {
    config.headers['X-Tenant-Subdomain'] = DEFAULT_TENANT_SUBDOMAIN;
  }
  return config;
});

// Automatically handle expired or invalid JWT tokens (401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const state = useStore.getState();
      if (state.token) {
        console.log('Session expired or invalid token (401). Resetting session to unauthenticated state.');
        state.logout();
      }
    }
    return Promise.reject(error);
  }
);
