import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Package } from 'lucide-react';
import { repackService } from '@/api/repackService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

export default function PackagingRecipes() {
  const navigate = useNavigate();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['repack-templates'],
    queryFn: () => repackService.getRecipeTemplates(),
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">Packaging Recipes</h1>
        </div>
        <Button onClick={() => navigate('/inventory/packaging-recipes/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Recipe
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recipe Templates</CardTitle>
          <p className="text-sm text-muted-foreground">
            Multi-input, multi-output templates for executing repack orders.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No templates. Add one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipe Name</TableHead>
                  <TableHead>Raw Materials (Inputs)</TableHead>
                  <TableHead>Finished Goods (Outputs)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium whitespace-nowrap">{t.name}</TableCell>
                    <TableCell>
                      <ul className="text-sm space-y-1">
                        {t.inputs?.map((i: any) => (
                          <li key={i.id} className="flex items-center gap-2">
                            <span className="font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-xs">
                              {i.quantity_per_batch}
                            </span>
                            {i.product?.name} ({i.variant?.name})
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell>
                      <ul className="text-sm space-y-1">
                        {t.outputs?.map((o: any) => (
                          <li key={o.id} className="flex items-center gap-2">
                            <span className="font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs border border-emerald-100">
                              {o.quantity_per_batch}
                            </span>
                            {o.product?.name} ({o.variant?.name})
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase font-mono text-[10px]">
                        {t.recipe_type?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/inventory/packaging-recipes/${t.id}/edit`)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
