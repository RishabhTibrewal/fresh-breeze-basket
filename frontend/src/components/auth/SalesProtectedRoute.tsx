import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface SalesProtectedRouteProps {
  children: React.ReactNode;
}

const SalesProtectedRoute: React.FC<SalesProtectedRouteProps> = ({ children }) => {
  const { user, role, isLoading } = useAuth();

  useEffect(() => {
    console.log('SalesProtectedRoute Debug:', {
      user: user?.id,
      isLoading,
      role
    });
  }, [user, role, isLoading]);

  // Show loading state while auth is being checked
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    console.log('No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  if (role !== 'sales') {
    console.log('User role is not sales:', role);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default SalesProtectedRoute; 