import React from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

/**
 * Placeholder page for routes that are not yet implemented
 * This component displays a message indicating the page is coming soon
 */
const PlaceholderPage: React.FC = () => {
  const location = useLocation();
  const pageName = location.pathname.split('/').pop()?.replace(/-/g, ' ') || 'Page';

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle className="capitalize">{pageName}</CardTitle>
              <CardDescription>This page is coming soon</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This feature is currently under development and will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlaceholderPage;
