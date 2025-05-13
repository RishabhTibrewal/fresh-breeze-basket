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
  }
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  // Function to ensure backend session is in sync with Supabase session
  const syncBackendSession = useCallback(async (currentSession: Session | null) => {
    if (!currentSession || !currentSession.user) {
      console.log('No session to sync with backend');
      return;
    }

    // Check if we already attempted a sync recently to prevent infinite loops
    const lastSyncAttempt = localStorage.getItem('last_backend_sync_attempt');
    const now = Date.now();
    
    if (lastSyncAttempt) {
      const timeSinceLastSync = now - parseInt(lastSyncAttempt);
      // If we attempted a sync in the last 10 seconds, don't try again
      if (timeSinceLastSync < 10000) { // 10 seconds cooldown
        console.log('Skipping backend sync - too soon since last attempt');
        return;
      }
    }
    
    // Record this sync attempt
    localStorage.setItem('last_backend_sync_attempt', now.toString());

    try {
      // Get the user's profile from Supabase first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile during sync:', profileError);
        return;
      }

      // If user has a role, sync with backend
      if (profile?.role) {
        console.log('Syncing backend session for user with role:', profile.role);
        await apiClient.post('/auth/sync-session', {
          userId: currentSession.user.id,
          email: currentSession.user.email,
          role: profile.role
        });
      } else {
        console.log('No role found for user, skipping backend sync');
      }
    } catch (error) {
      console.error('Error syncing backend session:', error);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession?.user?.id);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Store or remove token based on session state
        if (currentSession?.access_token) {
          localStorage.setItem('supabase_token', currentSession.access_token);
          console.log('Token stored in localStorage');
          
          // Set a session refresh interval to prevent automatic logout
          const refreshIntervalId = setInterval(async () => {
            try {
              console.log('Refreshing session...');
              const { data, error } = await supabase.auth.refreshSession();
              
              if (error) {
                console.error('Error refreshing session:', error);
              } else if (data && data.session) {
                console.log('Session refreshed successfully');
              }
            } catch (refreshError) {
              console.error('Error during session refresh:', refreshError);
            }
          }, 10 * 60 * 1000); // Refresh every 10 minutes
          
          // Store the interval ID so we can clear it later
          window._sessionRefreshInterval = refreshIntervalId;
        } else {
          localStorage.removeItem('supabase_token');
          console.log('Token removed from localStorage');
          
          // Clear the refresh interval when logged out
          if (window._sessionRefreshInterval) {
            clearInterval(window._sessionRefreshInterval);
            window._sessionRefreshInterval = null;
          }
        }
        
        // Clear profile state if user is signed out
        if (!currentSession?.user) {
          setProfile(null);
          setIsAdmin(false);
          setIsLoading(false);
        } else {
          // When user logs in, fetch their profile
          setTimeout(() => {
            fetchUserProfile(currentSession.user.id);
          }, 0);
          
          // Sync backend session whenever auth state changes
          syncBackendSession(currentSession);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log('Current session:', currentSession?.user?.id);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      // Store token if session exists
      if (currentSession?.access_token) {
        localStorage.setItem('supabase_token', currentSession.access_token);
        console.log('Existing token stored in localStorage');
      }
      
      // After setting user from session, fetch profile
      if (currentSession?.user) {
        fetchUserProfile(currentSession.user.id);
        
        // Sync backend session on app load if user is already logged in
        syncBackendSession(currentSession);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncBackendSession]);

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
        console.log('Profile data retrieved:', profileData);
        setProfile(profileData);
        
        // Check if user is admin based on profile role
        const userIsAdmin = profileData.role === 'admin';
        console.log('User admin status from profile:', userIsAdmin);
        setIsAdmin(userIsAdmin);
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
        await apiClient.post('/auth/login', { email, password });
        // We don't store the backend token since we're using Supabase's token
      } catch (backendError) {
        // Log backend error but don't throw since Supabase auth succeeded
        console.error('Backend login failed:', backendError);
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
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        phone,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName
          }
        }
      });

      console.log('Registration response:', { data, error });

      if (error) {
        console.error('Supabase registration error:', error);
        toast.error(error.message);
        throw error;
      }
      
      if (data.user) {
        console.log('User created successfully:', data.user.id);
        
        // If Supabase registration successful, also call backend login
        try {
          console.log('Attempting to login with backend after registration');
          await apiClient.post('/auth/login', { email, password });
          console.log('Backend login after registration successful');
        } catch (backendError) {
          // Log backend error but don't throw since Supabase registration succeeded
          console.error('Backend login after registration failed:', backendError);
        }
        
        toast.success('Registration successful! Please check your email for verification.');
      } else {
        console.warn('No user data in response:', data);
        toast.warning('Registration may have been successful, but no user data was returned.');
      }
    } catch (error) {
      console.error('Error signing up:', error);
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
      
      // Then log out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast.error(error.message);
        throw error;
      }
      
      // Explicitly remove all tokens
      localStorage.removeItem('supabase_token');
      localStorage.removeItem('token'); // Remove backend token if exists
      console.log('All tokens removed after sign out');
      
      toast.success('Successfully signed out!');
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    session,
    user,
    profile,
    isAdmin,
    isLoading,
    signIn,
    signUp,
    signOut
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
