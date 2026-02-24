import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { usePermissions, useCompanyModules } from '@/hooks/usePermissions';
import { useModuleKPIs } from '@/hooks/useModuleKPIs';
import { getAccessibleModules, ModuleConfig } from '@/config/modules.config';
import { useAuth } from '@/contexts/AuthContext';

const ModuleCard: React.FC<{ module: ModuleConfig }> = ({ module }) => {
  const navigate = useNavigate();
  const { data: kpiData, isLoading } = useModuleKPIs(module.key);

  return (
    <Card 
      className={`hover:shadow-lg transition-shadow ${
        module.highlighted ? 'border-pink-500 border-2' : ''
      }`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <module.icon className={`h-8 w-8 ${module.iconColor || 'text-gray-600'}`} />
            <div>
              <CardTitle className="text-xl">{module.label}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </div>
          </div>
          {module.highlighted && (
            <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded">Featured</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* KPIs */}
        <div className="space-y-2 mb-4">
          {module.kpis.map((kpi) => (
            <div key={kpi.key} className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{kpi.label}</span>
              {isLoading ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <span className="font-semibold">
                  {kpi.formatter ? kpi.formatter(kpiData?.[kpi.key] ?? null) : (kpiData?.[kpi.key] ?? '—')}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          {module.ctas.map((cta, index) => (
            <Button
              key={index}
              variant={cta.variant === 'secondary' ? 'outline' : 'default'}
              size="sm"
              onClick={() => navigate(cta.route)}
              className="flex-1"
            >
              {cta.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const HomeDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const { companyModules, loading: modulesLoading } = useCompanyModules();
  const navigate = useNavigate();

  if (permissionsLoading || modulesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const userPermissionCodes = permissions.map(p => p.permission_code);
  const accessibleModules = getAccessibleModules(userPermissionCodes, companyModules);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-gray-600">{user?.email}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/')}>
                E-commerce
              </Button>
              <Button variant="ghost" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Modules</h2>
          <p className="text-gray-600">Select a module to get started</p>
        </div>

        {accessibleModules.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have access to any modules. Please contact your administrator.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accessibleModules.map((module) => (
              <ModuleCard key={module.key} module={module} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HomeDashboard;
