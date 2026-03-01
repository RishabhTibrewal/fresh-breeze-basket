import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';

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
  role: string | null; // Backward compatibility - primary role
  roles: string[]; // New: array of roles
  isAdmin: boolean;
  isSales: boolean;
  isAccounts: boolean;
  isWarehouseManager: boolean;
  warehouses: string[]; // Array of warehouse IDs assigned to user
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (roleName: string) => boolean;
  hasAnyRole: (roleNames: string[]) => boolean;
  hasWarehouseAccess: (warehouseId: string) => boolean;
  getUserWarehouses: () => Promise<string[]>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [role, setRole] = useState<string | null>(null); // Backward compatibility
  const [roles, setRoles] = useState<string[]>([]); // New: array of roles
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSales, setIsSales] = useState<boolean>(false);
  const [isAccounts, setIsAccounts] = useState<boolean>(false);
  const [isWarehouseManager, setIsWarehouseManager] = useState<boolean>(false);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    setIsSales(false);
    setIsAccounts(false);
    setIsWarehouseManager(false);
    setWarehouses([]);
    setRole(null);
    setRoles([]);
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

      // Get roles from localStorage or profile
      const storedRolesJson = localStorage.getItem('userRoles');
      const storedRoles = storedRolesJson ? JSON.parse(storedRolesJson) : null;
      const storedRole = localStorage.getItem('userRole');
      // Profile type only has 'role' (singular), not 'roles' (plural)
      const effectiveRoles = storedRoles || (storedRole ? [storedRole] : (profile?.role ? [profile.role] : null));

      // If user has roles, sync with backend
      if (effectiveRoles && effectiveRoles.length > 0) {
        const primaryRole = effectiveRoles[0];
        console.log('Syncing backend session for user with roles:', effectiveRoles);
        await apiClient.post(
          '/auth/sync-session',
          {
            userId: currentSession.user.id,
            email: currentSession.user.email,
            role: primaryRole, // Backward compatibility
            roles: effectiveRoles // New: array of roles
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
      } else {
        console.log('No roles found for user, skipping backend sync');
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
            setIsSales(false);
            setIsAccounts(false);
            setIsWarehouseManager(false);
            setWarehouses([]);
            setRole(null);
            setRoles([]);
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
      
      // Fetch user profile from backend API to get roles array
      try {
        const response = await apiClient.get<{ success: boolean; data: any }>('/auth/me');
        const userData = response.data;
        
        if (!userData?.success) {
          console.error('Error fetching user from backend: Invalid response');
          // Fallback to Supabase profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
          } else if (profileData) {
            // Cast to string to allow all role types (sales, accounts, warehouse_manager, etc.)
            const effectiveRole = (profileData.role as string) || 'user';
            const userRoles = [effectiveRole];
            setProfile({ ...profileData, role: effectiveRole, roles: userRoles });
            setIsAdmin(effectiveRole === 'admin' || effectiveRole === 'accounts');
            setIsSales(effectiveRole === 'sales');
            setIsAccounts(effectiveRole === 'accounts');
            setRole(effectiveRole);
            setRoles(userRoles);
          }
        } else {
          // Use backend data which includes roles array
          const userProfile = userData.data;
          const userRoles = userProfile.roles || (userProfile.role ? [userProfile.role] : ['user']);
          const primaryRole = userRoles.length > 0 ? userRoles[0] : 'user';
          
          console.log('User profile from backend:', userProfile, 'roles:', userRoles);
          setProfile({ ...userProfile, role: primaryRole, roles: userRoles });
          
          setIsAdmin(userRoles.includes('admin') || userRoles.includes('accounts'));
          setIsSales(userRoles.includes('sales'));
          setIsAccounts(userRoles.includes('accounts'));
          setIsWarehouseManager(userRoles.includes('warehouse_manager'));
          setRole(primaryRole);
          setRoles(userRoles);
          
          // Fetch warehouses if user is warehouse manager
          if (userRoles.includes('warehouse_manager') || userRoles.includes('admin')) {
            try {
              const { warehouseManagersService } = await import('@/api/warehouseManagers');
              const warehouseAssignments = await warehouseManagersService.getByUser(userId);
              const warehouseIds = warehouseAssignments
                .map((wm: any) => wm.warehouses?.id || wm.warehouse_id)
                .filter(Boolean);
              setWarehouses(warehouseIds);
            } catch (error) {
              console.error('Error fetching user warehouses:', error);
            }
          } else {
            setWarehouses([]);
          }
          
          // Store roles in localStorage for backward compatibility
          if (primaryRole) {
            localStorage.setItem('userRole', primaryRole);
          }
          localStorage.setItem('userRoles', JSON.stringify(userRoles));
        }
      } catch (error) {
        console.error('Error fetching user from backend, falling back to Supabase:', error);
        // Fallback to Supabase profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
        } else if (profileData) {
          // Cast to string to allow all role types (sales, accounts, warehouse_manager, etc.)
          const effectiveRole = (profileData.role as string) || 'user';
          const userRoles = [effectiveRole];
          setProfile({ ...profileData, role: effectiveRole, roles: userRoles });
          setIsAdmin(effectiveRole === 'admin' || effectiveRole === 'accounts');
          setIsSales(effectiveRole === 'sales');
          setIsAccounts(effectiveRole === 'accounts');
          setIsWarehouseManager(effectiveRole === 'warehouse_manager');
          setWarehouses([]);
          setRole(effectiveRole);
          setRoles(userRoles);
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
      // Call backend login endpoint (which proxies Supabase auth)
      const { data: loginData } = await apiClient.post('/auth/login', { email, password });
      
      if (!loginData?.success || !loginData?.data) {
        throw new Error(loginData?.message || 'Login failed');
      }

      const { access_token, refresh_token, user: userProfile, roles: userRoles } = loginData.data;
      const userId = userProfile?.id;

      if (!access_token || !refresh_token) {
        throw new Error('Missing tokens in login response');
      }

      // Decode JWT to extract user info and expiry — no network call needed
      const decodeJWT = (token: string) => {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
          );
          return JSON.parse(jsonPayload);
        } catch { return null; }
      };

      const jwtPayload = decodeJWT(access_token);
      if (!jwtPayload) throw new Error('Invalid access token received');

      // Construct User and Session objects locally — no network call
      const supabaseUser: User = {
        id: jwtPayload.sub,
        aud: jwtPayload.aud || 'authenticated',
        role: jwtPayload.role || 'authenticated',
        email: jwtPayload.email || userProfile?.email,
        email_confirmed_at: jwtPayload.email_confirmed_at,
        phone: jwtPayload.phone || '',
        confirmed_at: jwtPayload.email_confirmed_at,
        last_sign_in_at: new Date().toISOString(),
        app_metadata: jwtPayload.app_metadata || {},
        user_metadata: jwtPayload.user_metadata || {},
        identities: [],
        created_at: jwtPayload.iat ? new Date(jwtPayload.iat * 1000).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        factors: [],
      };

      const supabaseSession: Session = {
        access_token,
        refresh_token,
        token_type: 'bearer',
        expires_in: (jwtPayload.exp || 0) - (jwtPayload.iat || 0),
        expires_at: jwtPayload.exp,
        user: supabaseUser,
      };

      // Write session directly to Supabase's localStorage key (bypasses network call)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
      localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(supabaseSession));
      localStorage.setItem('supabase_token', access_token);
      localStorage.setItem('supabase_refresh_token', refresh_token);

      // Set state directly from the locally constructed objects
      setUser(supabaseUser);
      setSession(supabaseSession);

      // Handle roles and profile
        if (userProfile) {
        const roles = userRoles || userProfile.roles || (userProfile.role ? [userProfile.role] : ['user']);
        const primaryRole = roles.length > 0 ? roles[0] : 'user';
          localStorage.setItem('userRole', primaryRole);
        localStorage.setItem('userRoles', JSON.stringify(roles));
        setProfile(prev => (prev ? { ...prev, role: primaryRole, roles } : userProfile));
        setIsAdmin(roles.includes('admin') || roles.includes('accounts'));
        setIsSales(roles.includes('sales'));
        setIsAccounts(roles.includes('accounts'));
        setIsWarehouseManager(roles.includes('warehouse_manager'));
          setRole(primaryRole);
        setRoles(roles);
          
          // Fetch warehouses if user is warehouse manager
        if (roles.includes('warehouse_manager') || roles.includes('admin')) {
            if (userId) {
              try {
                const { warehouseManagersService } = await import('@/api/warehouseManagers');
                const warehouseAssignments = await warehouseManagersService.getByUser(userId);
                const warehouseIds = warehouseAssignments
                  .map((wm: any) => wm.warehouses?.id || wm.warehouse_id)
                  .filter(Boolean);
                setWarehouses(warehouseIds);
              } catch (error) {
                console.error('Error fetching user warehouses:', error);
                setWarehouses([]);
              }
            } else {
              console.warn('Cannot fetch warehouses: userId not available');
              setWarehouses([]);
            }
          } else {
            setWarehouses([]);
          }
      }
      
      toast.success('Successfully signed in!');
      // Set flag to show dashboard button on landing page
      sessionStorage.setItem('from_login', 'true');
      
      // Invalidate all React Query caches after login so stale anonymous data
      // (e.g. empty variant lists fetched before auth) is discarded and re-fetched.
      queryClient.invalidateQueries();
      
      navigate('/');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Login failed';
      toast.error(errorMessage);
      await clearLocalSession();
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
        
        // After successful registration, sign in through backend (which proxies Supabase auth)
        try {
          console.log('Signing in through backend after registration');
          const { data: loginData } = await apiClient.post('/auth/login', { email, password });

          if (!loginData?.success || !loginData?.data) {
            throw new Error(loginData?.message || 'Login failed');
          }

          const { access_token, refresh_token, user: userProfile, roles: userRoles } = loginData.data;
          const userId = userProfile?.id;

          if (!access_token || !refresh_token) {
            throw new Error('Missing tokens in login response');
          }

          // Decode JWT locally — no network call
          const decodeJWT = (token: string) => {
            try {
              const base64Url = token.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
              );
              return JSON.parse(jsonPayload);
            } catch { return null; }
          };

          const jwtPayload = decodeJWT(access_token);
          if (!jwtPayload) throw new Error('Invalid access token received');

          const supabaseUser: User = {
            id: jwtPayload.sub,
            aud: jwtPayload.aud || 'authenticated',
            role: jwtPayload.role || 'authenticated',
            email: jwtPayload.email || userProfile?.email,
            email_confirmed_at: jwtPayload.email_confirmed_at,
            phone: jwtPayload.phone || '',
            confirmed_at: jwtPayload.email_confirmed_at,
            last_sign_in_at: new Date().toISOString(),
            app_metadata: jwtPayload.app_metadata || {},
            user_metadata: jwtPayload.user_metadata || {},
            identities: [],
            created_at: jwtPayload.iat ? new Date(jwtPayload.iat * 1000).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString(),
            factors: [],
          };

          const supabaseSession: Session = {
            access_token,
            refresh_token,
            token_type: 'bearer',
            expires_in: (jwtPayload.exp || 0) - (jwtPayload.iat || 0),
            expires_at: jwtPayload.exp,
            user: supabaseUser,
          };

          // Write session directly to Supabase's localStorage key — no network call
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
          localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(supabaseSession));
          localStorage.setItem('supabase_token', access_token);
          localStorage.setItem('supabase_refresh_token', refresh_token);

          // Set state directly
          setUser(supabaseUser);
          setSession(supabaseSession);

          // Handle roles and profile
              if (userProfile) {
            const roles = userRoles || userProfile.roles || (userProfile.role ? [userProfile.role] : ['user']);
            const primaryRole = roles.length > 0 ? roles[0] : 'user';
                localStorage.setItem('userRole', primaryRole);
            localStorage.setItem('userRoles', JSON.stringify(roles));
            setProfile(prev => (prev ? { ...prev, role: primaryRole, roles } : userProfile));
            setIsAdmin(roles.includes('admin') || roles.includes('accounts'));
            setIsSales(roles.includes('sales'));
            setIsAccounts(roles.includes('accounts'));
            setIsWarehouseManager(roles.includes('warehouse_manager'));
                setRole(primaryRole);
            setRoles(roles);
              }
          
          toast.success('Registration successful! You have been signed in.');
        } catch (signInErr: any) {
          console.error('Error during auto sign-in after registration:', signInErr);
          const errorMessage = signInErr?.response?.data?.message || signInErr?.message || 'Sign-in failed';
          toast.warning(`Registration successful, but automatic sign-in failed: ${errorMessage}. Please sign in manually.`);
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
      
      // Then log out from Supabase (handle gracefully if session is already missing)
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          // Don't throw if session is already missing - that's fine, we're logging out anyway
          if (error.message?.includes('Auth session missing') || error.message?.includes('session')) {
            console.log('Supabase session already cleared, continuing with logout');
          } else {
            console.error('Supabase signOut error:', error);
            // Don't throw - continue with cleanup
          }
        }
      } catch (supabaseError: any) {
        // Ignore "Auth session missing" errors - session may already be cleared
        if (supabaseError?.message?.includes('Auth session missing') || supabaseError?.message?.includes('session')) {
          console.log('Supabase session already cleared, continuing with logout');
        } else {
          console.error('Supabase signOut exception:', supabaseError);
        }
        // Don't throw - continue with cleanup
      }
      
      // Explicitly remove all tokens and session data
      localStorage.removeItem('supabase_token');
      localStorage.removeItem('token'); // Remove backend token if exists
      localStorage.removeItem('userRole'); // Remove cached user role
      localStorage.removeItem('currentCustomerId'); // Remove any stored customer ID
      localStorage.removeItem('last_profile_fetch'); // Remove profile fetch cache
      // Clear all Supabase-related localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      console.log('All tokens removed after sign out');
      
      // Reset all state before navigation
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsSales(false);
      setIsAccounts(false);
      setIsWarehouseManager(false);
      setWarehouses([]);
      setRole(null);
      setRoles([]);
      
      toast.success('Successfully signed out!');
      
      // Clear all React Query caches on logout so user-specific data
      // doesn't persist and get served to the next (possibly different) user.
      queryClient.clear();
      
      // Use setTimeout to ensure state updates are complete before navigation
      setTimeout(() => {
        navigate('/auth', { replace: true });
      }, 0);
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if there's an error, clear local state and navigate to ensure logout completes
      try {
        localStorage.clear();
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setIsSales(false);
        setIsAccounts(false);
        setIsWarehouseManager(false);
        setWarehouses([]);
        setRole(null);
        setRoles([]);
        navigate('/auth', { replace: true });
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      // Don't throw - logout should always succeed in clearing local state
    }
  };

  // Function to refresh profile (bypasses cooldown)
  const refreshProfile = async () => {
    if (!user?.id) return;
    // Clear cooldown to allow immediate refetch
    localStorage.removeItem('last_profile_fetch');
    await fetchUserProfile(user.id);
  };

  // Helper function to check if user has a specific role
  const hasRole = (roleName: string): boolean => {
    return roles.includes(roleName) || roles.includes('admin'); // Admin override
  };

  // Helper function to check if user has any of the specified roles
  const hasAnyRole = (roleNames: string[]): boolean => {
    if (roles.includes('admin')) return true; // Admin override
    return roleNames.some(roleName => roles.includes(roleName));
  };

  // Helper function to check if user has access to a specific warehouse
  const hasWarehouseAccess = (warehouseId: string): boolean => {
    if (isAdmin) return true; // Admin has access to all warehouses
    if (!isWarehouseManager) return false;
    return warehouses.includes(warehouseId);
  };

  // Function to get user's assigned warehouses
  const getUserWarehouses = async (): Promise<string[]> => {
    if (!user?.id) return [];
    try {
      const { warehouseManagersService } = await import('@/api/warehouseManagers');
      const warehouseAssignments = await warehouseManagersService.getByUser(user.id);
      const warehouseIds = warehouseAssignments
        .map((wm: any) => wm.warehouses?.id || wm.warehouse_id)
        .filter(Boolean);
      setWarehouses(warehouseIds);
      return warehouseIds;
    } catch (error) {
      console.error('Error fetching user warehouses:', error);
      return [];
    }
  };

  const value = {
    session,
    user,
    profile,
    role, // Backward compatibility
    roles, // New: array of roles
    isAdmin,
    isSales,
    isAccounts,
    isWarehouseManager,
    warehouses,
    isLoading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    hasRole,
    hasAnyRole,
    hasWarehouseAccess,
    getUserWarehouses
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
