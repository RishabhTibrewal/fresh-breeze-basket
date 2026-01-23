import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';

// Add a global declaration for the session refresh interval
declare global {
  interface Window {
    _sessionRefreshInterval: NodeJS.Timeout | null;
    _isRefreshingSession: boolean;
    _lastRefreshAttempt: number;
    _refreshBackoffMs: number;
  }
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  role: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const clearLocalSession = useCallback(async () => {
    // Clear any active session refresh interval
    if (window._sessionRefreshInterval) {
      clearInterval(window._sessionRefreshInterval);
      window._sessionRefreshInterval = null;
    }

    // Reset refresh state
    window._isRefreshingSession = false;
    window._lastRefreshAttempt = 0;
    window._refreshBackoffMs = 0;

    // Explicitly remove all tokens
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentCustomerId');

    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setRole(null);
  }, []);

  // Function to ensure backend session is in sync with Supabase session
  const syncBackendSession = useCallback(async (currentSession: Session | null, force = false) => {
    if (!currentSession || !currentSession.user) {
      console.log('No session to sync with backend');
      return true;
    }

    // Check if we already attempted a sync recently to prevent infinite loops
    if (!force) {
      const lastSyncAttempt = localStorage.getItem('last_backend_sync_attempt');
      const now = Date.now();
      
      if (lastSyncAttempt) {
        const timeSinceLastSync = now - parseInt(lastSyncAttempt);
        // If we attempted a sync in the last 10 seconds, don't try again
        if (timeSinceLastSync < 10000) { // 10 seconds cooldown
          console.log('Skipping backend sync - too soon since last attempt');
          return true;
        }
      }
      
      // Record this sync attempt
      localStorage.setItem('last_backend_sync_attempt', now.toString());
    }

    try {
      const accessToken = currentSession.access_token;
      if (!accessToken) {
        console.warn('Missing access token for backend sync');
        return false;
      }

      // Ensure token is available for API client and immediate requests
      localStorage.setItem('supabase_token', accessToken);

      // Get the user's profile from Supabase first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile during sync:', profileError);
        await supabase.auth.signOut();
        await clearLocalSession();
        toast.error('Failed to load your profile. Please sign in again.');
        navigate('/auth', { replace: true });
        return false;
      }

      const storedRole = localStorage.getItem('userRole');
      const effectiveRole = storedRole || profile?.role || null;

      // If user has a role, sync with backend
      if (effectiveRole) {
        console.log('Syncing backend session for user with role:', effectiveRole);
        await apiClient.post(
          '/auth/sync-session',
          {
            userId: currentSession.user.id,
            email: currentSession.user.email,
            role: effectiveRole
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
      } else {
        console.log('No role found for user, skipping backend sync');
        return false;
      }
    } catch (error: any) {
      console.error('Error syncing backend session:', error);
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;

      if (status === 401 || status === 403) {
        console.warn('Backend rejected session, signing out:', message);
        await supabase.auth.signOut();
        await clearLocalSession();
        toast.error(message || 'Session is not valid for this company.');
        navigate('/auth', { replace: true });
        return false;
      }
      return true;
    }
    return true;
  }, [clearLocalSession, navigate]);

  // Session refresh function with rate limit handling
  const refreshSessionSafely = useCallback(async () => {
    // Prevent concurrent refresh attempts
    if (window._isRefreshingSession) {
      console.log('Session refresh already in progress, skipping...');
      return;
    }

    // Check if we're in a backoff period due to rate limiting
    const now = Date.now();
    if (window._lastRefreshAttempt && window._refreshBackoffMs) {
      const timeSinceLastAttempt = now - window._lastRefreshAttempt;
      if (timeSinceLastAttempt < window._refreshBackoffMs) {
        const remainingMs = window._refreshBackoffMs - timeSinceLastAttempt;
        console.log(`Skipping refresh - in backoff period. Retry in ${Math.ceil(remainingMs / 1000)}s`);
        return;
      }
    }

    window._isRefreshingSession = true;
    window._lastRefreshAttempt = now;

    try {
      console.log('Refreshing session...');
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        // Handle rate limit errors gracefully
        if (error.message?.includes('rate limit') || error.status === 429) {
          console.warn('Rate limit hit during session refresh, implementing backoff');
          // Exponential backoff: start with 1 minute, max 10 minutes
          window._refreshBackoffMs = Math.min(
            (window._refreshBackoffMs || 60000) * 2,
            10 * 60 * 1000
          );
          // Don't sign out user, just wait and retry later
          toast.warning('Session refresh rate limited. Will retry shortly.');
        } else {
          console.error('Error refreshing session:', error);
          // For other errors, reset backoff
          window._refreshBackoffMs = 0;
        }
      } else if (data && data.session) {
        console.log('Session refreshed successfully');
        // Reset backoff on successful refresh
        window._refreshBackoffMs = 0;
      }
    } catch (refreshError: any) {
      console.error('Error during session refresh:', refreshError);
      // Handle rate limit in catch block as well
      if (refreshError?.status === 429 || refreshError?.message?.includes('rate limit')) {
        window._refreshBackoffMs = Math.min(
          (window._refreshBackoffMs || 60000) * 2,
          10 * 60 * 1000
        );
        toast.warning('Session refresh rate limited. Will retry shortly.');
      } else {
        window._refreshBackoffMs = 0;
      }
    } finally {
      window._isRefreshingSession = false;
    }
  }, []);

  useEffect(() => {
    // Initialize global variables
    if (typeof window !== 'undefined') {
      window._isRefreshingSession = false;
      window._lastRefreshAttempt = 0;
      window._refreshBackoffMs = 0;
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession?.user?.id);
        void (async () => {
          // Clear any existing refresh interval before creating a new one
          if (window._sessionRefreshInterval) {
            clearInterval(window._sessionRefreshInterval);
            window._sessionRefreshInterval = null;
          }

          // If user is signed out, clear local state immediately
          if (!currentSession?.user) {
            localStorage.removeItem('supabase_token');
            console.log('Token removed from localStorage');

            window._isRefreshingSession = false;
            window._lastRefreshAttempt = 0;
            window._refreshBackoffMs = 0;

            setSession(null);
            setUser(null);
            setProfile(null);
            setIsAdmin(false);
        setRole(null);
            setIsLoading(false);
            return;
          }

          // Verify backend membership before accepting the session
          const isValid = await syncBackendSession(currentSession, true);
          if (!isValid) {
            setIsLoading(false);
            return;
          }

          setSession(currentSession);
          setUser(currentSession.user);

          if (currentSession.access_token) {
            localStorage.setItem('supabase_token', currentSession.access_token);
            console.log('Token stored in localStorage');

            window._refreshBackoffMs = 0;
            const refreshIntervalId = setInterval(() => {
              refreshSessionSafely();
            }, 15 * 60 * 1000);
            window._sessionRefreshInterval = refreshIntervalId;
          }

          // When user logs in, fetch their profile
          setTimeout(() => {
            fetchUserProfile(currentSession.user.id);
          }, 0);
        })();
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log('Current session:', currentSession?.user?.id);

      if (!currentSession?.user) {
        setSession(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Do NOT sync here — onAuthStateChange will handle it

      setSession(currentSession);
      setUser(currentSession.user);

      if (currentSession.access_token) {
        localStorage.setItem('supabase_token', currentSession.access_token);
      }

      fetchUserProfile(currentSession.user.id);

    });

    return () => {
      subscription.unsubscribe();
      // Clear refresh interval on unmount
      if (window._sessionRefreshInterval) {
        clearInterval(window._sessionRefreshInterval);
        window._sessionRefreshInterval = null;
      }
    };
  }, [syncBackendSession, refreshSessionSafely]);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Prevent frequent refetching that could cause loops
      const lastProfileFetch = localStorage.getItem('last_profile_fetch');
      const now = Date.now();
      
      if (lastProfileFetch) {
        const timeSinceLastFetch = now - parseInt(lastProfileFetch);
        // If we fetched the profile in the last 5 seconds, don't try again
        if (timeSinceLastFetch < 5000) { // 5 seconds cooldown
          console.log('Skipping profile fetch - too soon since last attempt');
          setIsLoading(false);
          return;
        }
      }
      
      // Record this fetch attempt
      localStorage.setItem('last_profile_fetch', now.toString());
      
      console.log('Fetching profile for user:', userId);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        // Don't set profile to null if there was an error fetching
        // This prevents UI flickering and potential auth loops
      } else if (profileData) {
        const storedRole = localStorage.getItem('userRole');
        const effectiveRole = storedRole || profileData.role;
        console.log('Profile data retrieved:', profileData, 'effectiveRole:', effectiveRole);
        setProfile({ ...profileData, role: effectiveRole });
        
        const userIsAdmin = effectiveRole === 'admin';
        console.log('User admin status from role:', userIsAdmin);
        setIsAdmin(userIsAdmin);
        setRole(effectiveRole || null);
        
        // Store the effective role in localStorage for API components to access
        if (effectiveRole) {
          localStorage.setItem('userRole', effectiveRole);
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      // Don't reset profile state on error
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // First, sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        toast.error(error.message);
        throw error;
      }

      // If Supabase login successful, also call backend login
      try {
        const { data: loginData } = await apiClient.post('/auth/login', { email, password });
        const roleFromBackend = loginData?.data?.user?.role;
        if (roleFromBackend) {
          localStorage.setItem('userRole', roleFromBackend);
          setProfile(prev => (prev ? { ...prev, role: roleFromBackend } : prev));
          setIsAdmin(roleFromBackend === 'admin');
          setRole(roleFromBackend);
        }
        // We don't store the backend token since we're using Supabase's token
      } catch (backendError: any) {
        const message = backendError?.response?.data?.message || 'Login failed for this company.';
        console.error('Backend login failed:', backendError);
        await supabase.auth.signOut();
        await clearLocalSession();
        toast.error(message);
        throw backendError;
      }

      // Explicitly store the Supabase token
      if (data.session?.access_token) {
        localStorage.setItem('supabase_token', data.session.access_token);
        console.log('Token stored after sign in');
      }
      
      toast.success('Successfully signed in!');
      navigate('/');
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, phone: string) => {
    try {
      console.log('Starting registration process', { email, firstName, lastName, phone });
      
      // Call backend registration endpoint which handles tenant context and company_id
      const response = await apiClient.post('/auth/register', {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined
      });

      console.log('Registration response:', response.data);

      if (response.data.success) {
        console.log('User created successfully:', response.data.data?.id);
        
        // After successful registration, sign in with Supabase to get session
        try {
          console.log('Signing in with Supabase after registration');
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (signInError) {
            console.error('Supabase sign-in error after registration:', signInError);
            toast.warning('Registration successful, but automatic sign-in failed. Please sign in manually.');
          } else if (signInData.user) {
            console.log('Auto sign-in successful after registration');
            // Update user state
            setUser(signInData.user);
            // Cache the token
            if (signInData.session?.access_token) {
              localStorage.setItem('supabase_token', signInData.session.access_token);
            }
            try {
              const { data: loginData } = await apiClient.post('/auth/login', { email, password });
              const roleFromBackend = loginData?.data?.user?.role;
              if (roleFromBackend) {
                localStorage.setItem('userRole', roleFromBackend);
                setProfile(prev => (prev ? { ...prev, role: roleFromBackend } : prev));
                setIsAdmin(roleFromBackend === 'admin');
                setRole(roleFromBackend);
              }
            } catch (backendError: any) {
              const message = backendError?.response?.data?.message || 'Login failed for this company.';
              console.error('Backend login failed after registration:', backendError);
              await supabase.auth.signOut();
              await clearLocalSession();
              toast.error(message);
              return;
            }
            toast.success('Registration successful! You have been signed in.');
          }
        } catch (signInErr) {
          console.error('Error during auto sign-in:', signInErr);
          toast.warning('Registration successful, but automatic sign-in failed. Please sign in manually.');
        }
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Error signing up:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to register';
      toast.error(errorMessage);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // First, log out from the backend API
      try {
        console.log('Logging out from backend API...');
        await apiClient.post('/auth/logout');
        console.log('Backend logout successful');
      } catch (backendError) {
        // Log but continue with Supabase logout
        console.error('Backend logout failed:', backendError);
      }
      
      // Clear any active session refresh interval
      if (window._sessionRefreshInterval) {
        clearInterval(window._sessionRefreshInterval);
        window._sessionRefreshInterval = null;
      }
      
      // Reset refresh state
      window._isRefreshingSession = false;
      window._lastRefreshAttempt = 0;
      window._refreshBackoffMs = 0;
      
      // Then log out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast.error(error.message);
        throw error;
      }
      
      // Explicitly remove all tokens
      localStorage.removeItem('supabase_token');
      localStorage.removeItem('token'); // Remove backend token if exists
      localStorage.removeItem('userRole'); // Remove cached user role
      localStorage.removeItem('currentCustomerId'); // Remove any stored customer ID
      console.log('All tokens removed after sign out');
      
      // Reset all state before navigation
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setRole(null);
      
      toast.success('Successfully signed out!');
      
      // Use setTimeout to ensure state updates are complete before navigation
      setTimeout(() => {
        navigate('/auth', { replace: true });
      }, 0);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Function to refresh profile (bypasses cooldown)
  const refreshProfile = async () => {
    if (!user?.id) return;
    // Clear cooldown to allow immediate refetch
    localStorage.removeItem('last_profile_fetch');
    await fetchUserProfile(user.id);
  };

  const value = {
    session,
    user,
    profile,
    role,
    isAdmin,
    isLoading,
    signIn,
    signUp,
    signOut,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
