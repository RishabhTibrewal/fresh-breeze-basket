import axios from 'axios';
import { supabase } from '../integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies/sessions
});

// Add request interceptor for auth token
apiClient.interceptors.request.use(
  async (config) => {
    // Always get the current Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track auth redirection to prevent loops
let isRedirectingToAuth = false;
// Track API request failures to prevent excessive retries
const failedRequests = new Map();

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    // On successful response, clear any failure tracking for this URL
    if (response.config.url) {
      failedRequests.delete(response.config.url);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Check if we should attempt a retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Prevent redirect loops by checking if we're already redirecting
      if (isRedirectingToAuth) {
        console.log('Already redirecting to auth page, skipping duplicate redirect');
        return Promise.reject(error);
      }
      
      // Check if this URL has failed too many times recently
      const requestKey = originalRequest.url;
      if (requestKey) {
        const now = Date.now();
        const failRecord = failedRequests.get(requestKey);
        
        if (failRecord) {
          const { count, timestamp } = failRecord;
          const timeSinceLastFail = now - timestamp;
          
          // If we've had multiple failures recently, don't retry
          if (count >= 3 && timeSinceLastFail < 60000) { // 1 minute cooldown after 3 failures
            console.log(`Request to ${requestKey} has failed ${count} times in the last minute, not retrying`);
            return Promise.reject(error);
          }
          
          // Update the failure count
          failedRequests.set(requestKey, { count: count + 1, timestamp: now });
        } else {
          // First failure for this URL
          failedRequests.set(requestKey, { count: 1, timestamp: now });
        }
      }
      
      // Check last auth redirect time to prevent loops
      const lastAuthRedirect = localStorage.getItem('last_auth_redirect');
      if (lastAuthRedirect) {
        const timeSinceLastRedirect = Date.now() - parseInt(lastAuthRedirect);
        // If redirected to auth in the last 5 seconds, don't redirect again
        if (timeSinceLastRedirect < 5000) {
          console.log('Auth redirect loop detected, skipping redirect');
          return Promise.reject(error);
        }
      }
      
      // Mark that we're redirecting to prevent multiple redirects
      isRedirectingToAuth = true;
      
      try {
        // Mark the request as retried to prevent infinite loop
        originalRequest._retry = true;
        
        // Try to refresh the session with Supabase
        const { data } = await supabase.auth.refreshSession();
        const session = data?.session;
        
        if (session?.access_token) {
          console.log('Session refreshed, retrying request');
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('Error refreshing session:', refreshError);
      }
      
      // If we get here, session refresh failed or there was no session
      console.log('Unauthorized access, redirecting to login');
      localStorage.removeItem('supabase_token');
      localStorage.setItem('last_auth_redirect', Date.now().toString());
      
      // Use a timeout to prevent immediate redirect that might cause loops
      setTimeout(() => {
        window.location.href = '/auth';
        isRedirectingToAuth = false;
      }, 100);
    }
    
    // For other errors, just reject the promise
    return Promise.reject(error);
  }
);

export default apiClient; 