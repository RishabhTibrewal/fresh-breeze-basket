import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  FileText, Plus, Search, Filter, ArrowRight, Eye, CheckCircle, XCircle 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { quotationsService, Quotation } from '@/api/quotations';
import { useNavigate } from 'react-router-dom';

export default function Quotations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Fetch quotations
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations', searchTerm],
    queryFn: () => quotationsService.getQuotations(searchTerm ? { search: searchTerm } : {})
  });

  // Accept mutation
  const acceptMutation = useMutation({
    mutationFn: (id: string) => quotationsService.acceptQuotation(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast({
        title: 'Quotation Accepted',
        description: `Order ${data.order_id} has been created successfully.`,
      });
      setIsViewModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error formatting order',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      });
    }
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (id: string) => quotationsService.updateQuotationStatus(id, 'rejected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast({
        title: 'Quotation Rejected',
        description: 'The quotation status has been updated to rejected.',
      });
      setIsViewModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating status',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      });
    }
  });

  const getStatusBadgeVariant = (status: string) => {
    switch(status) {
      case 'accepted': return 'success';
      case 'rejected': return 'destructive';
      case 'sent': return 'default';
      case 'expired': return 'secondary';
      default: return 'outline'; // draft
    }
  };

  const handleViewQuotation = async (id: string) => {
    try {
      const data = await quotationsService.getQuotationById(id);
      setSelectedQuotation(data);
      setIsViewModalOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Could not load quotation details',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quotations</h2>
          <p className="text-muted-foreground">Manage sales quotes and proposals</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/sales/quotations/create')}>
            <Plus className="mr-2 h-4 w-4" /> Create Quotation
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>All Quotations</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quotations..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer/Lead</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <div className="animate-spin h-6 w-6 border-b-2 border-primary mx-auto rounded-full"></div>
                    </TableCell>
                  </TableRow>
                ) : quotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No quotations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  quotations.map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">{quotation.quotation_number}</TableCell>
                      <TableCell>{format(new Date(quotation.created_at), 'PPP')}</TableCell>
                      <TableCell>
                        {quotation.customers?.name || quotation.leads?.company_name || quotation.leads?.contact_name || 'N/A'}
                      </TableCell>
                      <TableCell>₹ {quotation.total_amount?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(quotation.status) as any}>
                          {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewQuotation(quotation.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View/Action Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Quotation {selectedQuotation?.quotation_number}</DialogTitle>
            <DialogDescription>
              Created on {selectedQuotation && format(new Date(selectedQuotation.created_at), 'PPP')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedQuotation && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer/Lead</p>
                  <p className="font-medium">
                    {selectedQuotation.customers?.name || selectedQuotation.leads?.company_name || selectedQuotation.leads?.contact_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={getStatusBadgeVariant(selectedQuotation.status) as any}>
                    {selectedQuotation.status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Sales Rep</p>
                  <p className="font-medium">{(selectedQuotation.auth_users?.raw_user_meta_data as any)?.full_name || selectedQuotation.auth_users?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valid Until</p>
                  <p className="font-medium">{selectedQuotation.valid_until ? format(new Date(selectedQuotation.valid_until), 'PPP') : 'N/A'}</p>
                </div>
                {selectedQuotation.notes && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Notes</p>
                    <p className="font-medium whitespace-pre-wrap">{selectedQuotation.notes}</p>
                  </div>
                )}
                {selectedQuotation.terms_and_conditions && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Terms & Conditions</p>
                    <p className="font-medium whitespace-pre-wrap">{selectedQuotation.terms_and_conditions}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Line Items</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Tax %</TableHead>
                        <TableHead className="text-right">Disc %</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuotation.quotation_items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {item.product?.name}
                            {item.variant?.name && <span className="text-muted-foreground text-xs block">{item.variant.name}</span>}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">₹ {item.unit_price?.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{item.tax_percentage || 0}%</TableCell>
                          <TableCell className="text-right">{item.discount_percentage || 0}%</TableCell>
                          <TableCell className="text-right font-medium">
                            ₹ {(item.line_total || ((item.quantity * item.unit_price) + (item.tax_amount || 0) - (item.discount_amount || 0))).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell colSpan={5} className="text-right font-medium">Subtotal (Sum of Items)</TableCell>
                        <TableCell className="text-right font-medium">₹ {(selectedQuotation.subtotal || 0).toFixed(2)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={5} className="text-right text-muted-foreground">Total Item Tax</TableCell>
                        <TableCell className="text-right text-muted-foreground">₹ {(selectedQuotation.total_tax || 0).toFixed(2)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={5} className="text-right text-muted-foreground">Total Discount (Incl. Extra)</TableCell>
                        <TableCell className="text-right text-muted-foreground text-red-500">-₹ {(selectedQuotation.total_discount || 0).toFixed(2)}</TableCell>
                      </TableRow>
                      {(selectedQuotation.extra_discount_percentage > 0 || selectedQuotation.extra_discount_amount > 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-right text-xs text-muted-foreground italic">
                            Extra Discount {selectedQuotation.extra_discount_percentage > 0 ? `(${selectedQuotation.extra_discount_percentage}%)` : ''}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground italic">-₹ {(selectedQuotation.extra_discount_amount || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      )}
                      <TableRow className="font-bold text-lg">
                        <TableCell colSpan={5} className="text-right">Grand Total</TableCell>
                        <TableCell className="text-right text-green-600">₹ {selectedQuotation.total_amount?.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between items-center w-full mt-6">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsViewModalOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="flex gap-2">
              {selectedQuotation?.status === 'draft' || selectedQuotation?.status === 'sent' ? (
                <>
                  <Button 
                    variant="destructive" 
                    onClick={() => rejectMutation.mutate(selectedQuotation.id)}
                    disabled={rejectMutation.isPending || acceptMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                  <Button 
                    variant="default"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                        setIsViewModalOpen(false);
                        navigate(`/sales/orders/create?quotationId=${selectedQuotation.id}`);
                    }}
                    disabled={rejectMutation.isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" /> Accept & Create Order
                  </Button>
                </>
              ) : selectedQuotation?.converted_to_order_id ? (
                <Button variant="outline" onClick={() => navigate(`/sales/orders/${selectedQuotation.converted_to_order_id}`)}>
                  <ArrowRight className="mr-2 h-4 w-4" /> View Order
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
