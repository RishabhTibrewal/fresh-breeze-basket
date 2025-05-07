import React, { useEffect, useState } from 'react';
import { authService } from '@/api/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';

const AdminCheck = () => {
  const [adminCheck, setAdminCheck] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, profile, isAdmin } = useAuth();

  const checkAdminStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.checkAdminStatus();
      setAdminCheck(result);
    } catch (err) {
      console.error('Error checking admin status:', err);
      setError('Failed to check admin status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto my-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Admin Status Check</CardTitle>
          <CardDescription>Verify your admin permissions and user details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="font-medium">Frontend AuthContext:</div>
              <div></div>
              
              <div>User ID:</div>
              <div className="font-mono text-sm bg-gray-100 p-1 rounded">{user?.id || 'Not logged in'}</div>
              
              <div>Email:</div>
              <div className="font-mono text-sm bg-gray-100 p-1 rounded">{user?.email || 'N/A'}</div>
              
              <div>Profile Loaded:</div>
              <div className="font-mono text-sm">{profile ? 'Yes' : 'No'}</div>
              
              <div>Profile ID:</div>
              <div className="font-mono text-sm bg-gray-100 p-1 rounded">{profile?.id || 'N/A'}</div>
              
              <div>Profile Role:</div>
              <div className="font-mono text-sm bg-gray-100 p-1 rounded">{profile?.role || 'N/A'}</div>
              
              <div>Is Admin (Context):</div>
              <div className="font-mono text-sm bg-gray-100 p-1 rounded">{isAdmin ? 'Yes' : 'No'}</div>
            </div>
            
            {adminCheck && (
              <div className="mt-8 border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Backend Check Results:</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>User ID (Backend):</div>
                  <div className="font-mono text-sm bg-gray-100 p-1 rounded">{adminCheck.data.userId}</div>
                  
                  <div>Email:</div>
                  <div className="font-mono text-sm bg-gray-100 p-1 rounded">{adminCheck.data.email}</div>
                  
                  <div>Role from Profile:</div>
                  <div className="font-mono text-sm bg-gray-100 p-1 rounded">{adminCheck.data.profileRole}</div>
                  
                  <div>Is Admin (Direct Check):</div>
                  <div className="font-mono text-sm bg-gray-100 p-1 rounded">{adminCheck.data.isAdmin ? 'Yes' : 'No'}</div>
                  
                  <div>Is Admin (RPC):</div>
                  <div className="font-mono text-sm bg-gray-100 p-1 rounded">{adminCheck.data.isAdminRpc ? 'Yes' : 'No'}</div>
                </div>
                
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Full Profile Data:</h4>
                  <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
                    {JSON.stringify(adminCheck.data.profile, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {error && <div className="text-red-500 mt-4">{error}</div>}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={checkAdminStatus} 
            disabled={loading}
            className="mr-2"
          >
            {loading ? 'Checking...' : 'Check Admin Status'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AdminCheck; 