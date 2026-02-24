import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ContextualSidebar from '@/components/ContextualSidebar';

const ModuleLayout: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      <ContextualSidebar onToggle={(open) => setSidebarOpen(open)} />

      {/* Main Content Area */}
      <div className={`min-h-screen transition-all duration-200 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'}`}>
        {/* Top Header */}
        <header className="bg-white border-b px-4 h-16 flex items-center justify-between sticky top-0 z-40">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-red-600"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ModuleLayout;
