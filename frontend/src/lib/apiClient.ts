import axios from 'axios';
import { supabase } from '../integrations/supabase/client';

// // const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://rishabh.dtsanskar.tech/api'||'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies/sessions
});

// Keep track of the current refresh promise to prevent multiple refreshes in parallel
let refreshPromise: Promise<any> | null = null;
// Track rate limiting for session refresh
let lastRefreshAttempt = 0;
let refreshBackoffMs = 0;
let isRefreshing = false;

// Add request interceptor for auth token
apiClient.interceptors.request.use(
  async (config) => {
    // Check localStorage first for token (faster than Supabase API call)
    const cachedToken = localStorage.getItem('supabase_token');
    
    if (cachedToken) {
      config.headers.Authorization = `Bearer ${cachedToken}`;
      
      // Check token expiration
      try {
        const tokenData = JSON.parse(atob(cachedToken.split('.')[1]));
        const expiryTime = tokenData.exp * 1000; // Convert to milliseconds
        const currentTime = Date.now();
        
        // Only refresh if token is expired or expiring very soon (within 2 minutes)
        // Check rate limit backoff before attempting refresh
        const now = Date.now();
        const canRefresh = !refreshBackoffMs || 
          (lastRefreshAttempt && (now - lastRefreshAttempt) >= refreshBackoffMs);
        
        if (expiryTime - currentTime < 2 * 60 * 1000 && canRefresh && !isRefreshing) {
          console.log('Token expiring soon, refreshing session...');
          
          // Don't await here to prevent blocking the request
          // Add a small delay to avoid rapid refresh calls
          setTimeout(() => {
            refreshSession();
          }, 100);
        } else if (expiryTime - currentTime < 2 * 60 * 1000 && !canRefresh) {
          console.log('Skipping refresh due to rate limit backoff');
        }
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    } else {
      // If no cached token, get it from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
        // Cache the token
        localStorage.setItem('supabase_token', session.access_token);
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper function to refresh the session with rate limit handling
async function refreshSession() {
  // If already refreshing, return the existing promise
  if (refreshPromise) {
    return refreshPromise;
  }
  
  // Check if we're in a backoff period due to rate limiting
  const now = Date.now();
  if (isRefreshing) {
    console.log('Session refresh already in progress, skipping...');
    return null;
  }
  
  if (lastRefreshAttempt && refreshBackoffMs) {
    const timeSinceLastAttempt = now - lastRefreshAttempt;
    if (timeSinceLastAttempt < refreshBackoffMs) {
      const remainingMs = refreshBackoffMs - timeSinceLastAttempt;
      console.log(`Skipping refresh - in backoff period. Retry in ${Math.ceil(remainingMs / 1000)}s`);
      return null;
    }
  }
  
  isRefreshing = true;
  lastRefreshAttempt = now;
  
  try {
    // Create a new refresh promise
    refreshPromise = supabase.auth.refreshSession();
    const { data, error } = await refreshPromise;
    
    if (error) {
      // Handle rate limit errors gracefully
      if (error.message?.includes('rate limit') || error.status === 429) {
        console.warn('Rate limit hit during session refresh, implementing backoff');
        // Exponential backoff: start with 1 minute, max 10 minutes
        refreshBackoffMs = Math.min(
          (refreshBackoffMs || 60000) * 2,
          10 * 60 * 1000
        );
        // Don't throw error, just return null and let the request proceed with existing token
        return null;
      } else {
        console.error('Error refreshing session:', error);
        // Reset backoff for other errors
        refreshBackoffMs = 0;
        return null;
      }
    }
    
    if (data?.session?.access_token) {
      localStorage.setItem('supabase_token', data.session.access_token);
      console.log('Session refreshed successfully');
      // Reset backoff on successful refresh
      refreshBackoffMs = 0;
      return data.session;
    }
    
    return null;
  } catch (error: any) {
    console.error('Error during session refresh:', error);
    // Handle rate limit in catch block as well
    if (error?.status === 429 || error?.message?.includes('rate limit')) {
      refreshBackoffMs = Math.min(
        (refreshBackoffMs || 60000) * 2,
        10 * 60 * 1000
      );
    } else {
      refreshBackoffMs = 0;
    }
    return null;
  } finally {
    // Clear the promise and refresh flag when done
    refreshPromise = null;
    isRefreshing = false;
  }
}

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
      
      // Mark the request as retried to prevent infinite loop
      originalRequest._retry = true;
      
      try {
        // Explicitly try to refresh the token
        const session = await refreshSession();
        
        if (session?.access_token) {
          console.log('Session refreshed, retrying request');
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('Error refreshing session:', refreshError);
      }
      
      // Check last auth redirect time to prevent loops
      const lastAuthRedirect = localStorage.getItem('last_auth_redirect');
      if (lastAuthRedirect) {
        const timeSinceLastRedirect = Date.now() - parseInt(lastAuthRedirect);
        // If redirected to auth in the last 30 seconds, don't redirect again
        if (timeSinceLastRedirect < 30000) {
          console.log('Auth redirect loop detected, skipping redirect');
          return Promise.reject(error);
        }
      }
      
      // Mark that we're redirecting to prevent multiple redirects
      isRedirectingToAuth = true;
      
      // If we get here, session refresh failed or there was no session
      console.log('Unauthorized access, redirecting to login');
      localStorage.setItem('last_auth_redirect', Date.now().toString());
      
      // Use a timeout to prevent immediate redirect that might cause loops
      setTimeout(() => {
        window.location.href = '/auth';
        isRedirectingToAuth = false;
      }, 300);
    }
    
    // For other errors, just reject the promise
    return Promise.reject(error);
  }
);

export default apiClient; 