
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type ProtectedRouteProps = {
  requireAdmin?: boolean;
  children?: React.ReactNode;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  requireAdmin = false,
  children 
}) => {
  const { user, isAdmin, isAccounts, isLoading, role } = useAuth();
  const location = useLocation();

  // Add additional logging for debugging
  React.useEffect(() => {
    console.log('ProtectedRoute - Auth Status:', { 
      isAuthenticated: !!user,
      isAdmin, 
      requireAdmin,
      role,
      isLoading
    });
  }, [user, isAdmin, requireAdmin, role, isLoading]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!user) {
    console.log('User not authenticated, redirecting to /auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin && !isAccounts) {
    console.log('Access denied: User is not an admin or accounts', { 
      isAdmin, 
      isAccounts,
      role,
      uid: user.id 
    });
    toast.error('You do not have permission to access this page');
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
