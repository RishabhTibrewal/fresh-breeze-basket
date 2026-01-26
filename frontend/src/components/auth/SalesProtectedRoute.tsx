import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface SalesProtectedRouteProps {
  children: React.ReactNode;
}

const SalesProtectedRoute: React.FC<SalesProtectedRouteProps> = ({ children }) => {
  const { user, isSales, isAdmin, isLoading, hasAnyRole } = useAuth();

  useEffect(() => {
    console.log('SalesProtectedRoute Debug:', {
      user: user?.id,
      isLoading,
      isSales,
      isAdmin
    });
  }, [user, isSales, isAdmin, isLoading]);

  // Show loading state while auth is being checked
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    console.log('No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // Check if user has sales role or admin role (admin override)
  if (!hasAnyRole(['sales', 'admin'])) {
    console.log('User does not have sales or admin role');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default SalesProtectedRoute; 