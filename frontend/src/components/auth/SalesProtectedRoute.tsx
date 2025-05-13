import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface SalesProtectedRouteProps {
  children: React.ReactNode;
}

const SalesProtectedRoute: React.FC<SalesProtectedRouteProps> = ({ children }) => {
  const { user, profile, isLoading } = useAuth();

  useEffect(() => {
    console.log('SalesProtectedRoute Debug:', {
      user: user?.id,
      profile,
      isLoading,
      role: profile?.role
    });
  }, [user, profile, isLoading]);

  // Show loading state while auth is being checked
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    console.log('No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  if (!profile) {
    console.log('No profile found for user');
    return <div>Error: User profile not found</div>;
  }

  if (profile.role !== 'sales') {
    console.log('User role is not sales:', profile.role);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default SalesProtectedRoute; 