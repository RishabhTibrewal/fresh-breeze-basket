import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';

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
      console.log('Syncing backend session for user:', currentSession.user.id);
      
      // Try to verify backend session is active
      try {
        // Call an authenticated endpoint to check if backend session is active
        await apiClient.get('/auth/me');
        console.log('Backend session already active');
        
        // Clear any error state since backend is responsive
        localStorage.removeItem('backend_sync_failed');
      } catch (backendError) {
        // Check if we've had multiple failures
        const failCount = parseInt(localStorage.getItem('backend_sync_failed') || '0');
        
        if (failCount >= 3) {
          console.log('Backend sync has failed multiple times, skipping further attempts');
          return;
        }
        
        console.log('Backend session not active, attempting login...');
        
        // If backend session is not active but we have a Supabase session,
        // attempt to login with backend using email from Supabase
        const { email } = currentSession.user;
        if (email) {
          try {
            // We don't have password here, so this will only work if your backend 
            // has a special endpoint that can validate the Supabase token directly
            // or has another way to authenticate users from Supabase
            await apiClient.post('/auth/login', { 
              email,
              supabase_token: currentSession.access_token
            });
            console.log('Successfully logged in to backend');
            
            // Reset failure counter on success
            localStorage.removeItem('backend_sync_failed');
          } catch (loginError) {
            console.error('Backend login failed during sync:', loginError);
            
            // Increment failure counter
            localStorage.setItem('backend_sync_failed', (failCount + 1).toString());
          }
        }
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
        } else {
          localStorage.removeItem('supabase_token');
          console.log('Token removed from localStorage');
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
