import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AccountsProtectedRouteProps {
  children: React.ReactNode;
}

const AccountsProtectedRoute: React.FC<AccountsProtectedRouteProps> = ({ children }) => {
  const { user, isAccounts, isAdmin, isLoading, hasAnyRole } = useAuth();

  useEffect(() => {
    console.log('AccountsProtectedRoute Debug:', {
      user: user?.id,
      isLoading,
      isAccounts,
      isAdmin
    });
  }, [user, isAccounts, isAdmin, isLoading]);

  // Show loading state while auth is being checked
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    console.log('No user found, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // Check if user has accounts role or admin role (admin override)
  if (!hasAnyRole(['accounts', 'admin'])) {
    console.log('User does not have accounts or admin role');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AccountsProtectedRoute;

