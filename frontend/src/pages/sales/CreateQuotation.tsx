import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { quotationsService, CreateQuotationInput, QuotationItem } from '@/api/quotations';
import { leadsService } from '@/api/leads';
import { productsService } from '@/api/products';
import { ordersService } from '@/api/orders';
import { calculateOrderTotals, ExtraCharge } from '@/lib/orderCalculations';
import apiClient from '@/lib/apiClient';

export default function CreateQuotation() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const queryParams = new URLSearchParams(location.search);
  const initialLeadId = queryParams.get('leadId') || '';

  const [leadId, setLeadId] = useState<string>(initialLeadId);
  const [customerId, setCustomerId] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [terms, setTerms] = useState<string>('');
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  const [extraDiscountPct, setExtraDiscountPct] = useState<number>(0);
  const [salesExecutiveId, setSalesExecutiveId] = useState<string>('');
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);

  const [items, setItems] = useState<(QuotationItem & { ui_id: number; availableVariants: any[] })[]>([]);
  const [nextUiId, setNextUiId] = useState(1);

  // Fetch standard data
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: () => leadsService.getLeads({}) });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: async () => {
    const res = await apiClient.get('/customer');
    return res.data?.data || res.data || [];
  }});
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => productsService.getAll() });
  const { data: salesExecutivesData } = useQuery({
    queryKey: ['sales-executives'],
    queryFn: () => ordersService.getSalesExecutives()
  });
  const salesExecutives = salesExecutivesData?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: CreateQuotationInput) => quotationsService.createQuotation(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'], exact: false });
      toast.success(`Quotation updated/created successfully!`);
      navigate('/sales/quotations');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error.message || 'Failed to create quotation');
    }
  });

  const addItem = () => {
    setItems([
      ...items,
      {
        ui_id: nextUiId,
        product_id: '',
        variant_id: null,
        quantity: 1,
        unit_price: 0,
        tax_percentage: 0,
        discount_percentage: 0,
        availableVariants: [],
      }
    ]);
    setNextUiId(nextUiId + 1);
  };

  const removeItem = (ui_id: number) => {
    setItems(items.filter(item => item.ui_id !== ui_id));
  };

  const updateItem = async (ui_id: number, field: keyof QuotationItem, value: any) => {
    setItems(items.map(item => {
      if (item.ui_id === ui_id) {
        const updated = { ...item, [field]: value };
        // If product changed, update price & variants
        if (field === 'product_id') {
          const product = products.find((p: any) => p.id === value);
          if (product) {
             const defaultVariant = product.variants?.find((v: any) => v.is_default) || product.variants?.[0];
             updated.unit_price = defaultVariant?.price?.sale_price || product.sale_price || product.price || 0;
             updated.availableVariants = product.variants || [];
             updated.variant_id = null; // reset variant
             
             // If variants exist, perhaps auto-select first or keep null
             if (updated.availableVariants.length > 0) {
               // DO nothing, user must select
             }
          }
        }
        // If variant changed, update price
        if (field === 'variant_id' && value) {
           const variant = item.availableVariants.find((v: any) => v.id === value);
           if (variant?.price?.sale_price !== undefined) {
             updated.unit_price = variant.price.sale_price;
           } else if (variant?.price) {
             updated.unit_price = variant.price; // fallback if it's somehow a scalar
           }
           if (variant?.tax?.rate) {
             updated.tax_percentage = variant.tax.rate;
           }
        }
        return updated;
      }
      return item;
    }));
  };

  const baseItemsTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const extraDiscountAmtForCalc = extraDiscountPct > 0 
    ? (baseItemsTotal * extraDiscountPct) / 100 
    : extraDiscount;

  const orderTotals = calculateOrderTotals(
    items.map(i => ({
      id: i.ui_id.toString(),
      unit_price: i.unit_price,
      quantity: i.quantity,
      discount_amount: (i.quantity * i.unit_price * (i.discount_percentage || 0)) / 100,
      tax_percentage: i.tax_percentage || 0
    })),
    extraDiscountAmtForCalc,
    0, // CD not enabled for quotes
    'credit_note', // N/A
    extraCharges
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Please add at least one line item.');
      return;
    }
    for (const item of items) {
      if (!item.product_id) {
        toast.error('Please select a product for all line items.');
        return;
      }
      if (item.availableVariants?.length > 0 && !item.variant_id) {
        toast.error('Please select a variant for product items that require it.');
        return;
      }
      if (item.quantity <= 0) {
        toast.error('Quantities must be greater than 0.');
        return;
      }
    }

    if (!leadId && !customerId) {
       toast.error('Please specify either a Lead or a Customer.');
       return;
    }

    const payload: CreateQuotationInput = {
      lead_id: leadId || undefined,
      customer_id: customerId || undefined,
      sales_executive_id: salesExecutiveId && salesExecutiveId !== 'none' ? salesExecutiveId : undefined,
      valid_until: validUntil || undefined,
      notes,
      terms_and_conditions: terms,
      extra_discount_percentage: extraDiscountPct,
      extra_discount_amount: extraDiscountAmtForCalc,
      extra_charges: extraCharges,
      items: items.map(({ ui_id, availableVariants, ...rest }) => {
        const itemSubtotal = rest.quantity * rest.unit_price;
        const discount_amount = (itemSubtotal * (rest.discount_percentage || 0)) / 100;
        const taxBase = itemSubtotal - discount_amount;
        const tax_amount = (taxBase * (rest.tax_percentage || 0)) / 100;
        return {
          ...rest,
          discount_amount,
          tax_amount,
        };
      })
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Create Quotation</h2>
          <p className="text-muted-foreground">Draft a new sales quote for a lead or customer</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Link to Lead</Label>
                <Select value={leadId || 'none'} onValueChange={(val) => { setLeadId(val === 'none' ? '' : val); setCustomerId(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {leads.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.company_name || l.contact_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Link to Customer (Existing)</Label>
                <Select value={customerId || 'none'} onValueChange={(val) => { setCustomerId(val === 'none' ? '' : val); setLeadId(''); }} disabled={!!leadId && leadId !== 'none'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {customers.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sales Executive (Optional)</Label>
                <Select value={salesExecutiveId} onValueChange={setSalesExecutiveId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Sales Executive" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {salesExecutives.map((se: any) => (
                      <SelectItem key={se.id} value={se.id}>{se.user_metadata?.full_name || se.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Terms & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Notes (Internal or standard)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="E.g., Based on our meeting yesterday..." />
              </div>

              <div className="space-y-2">
                <Label>Terms and Conditions</Label>
                <Textarea value={terms} onChange={e => setTerms(e.target.value)} placeholder="Standard T&Cs..." />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" onClick={addItem} size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price (₹)</TableHead>
                    <TableHead className="text-right">Tax %</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right">Total (₹)</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No items added yet. Click 'Add Item' to begin.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => (
                      <TableRow key={item.ui_id}>
                        <TableCell className="min-w-[200px]">
                          <Select value={item.product_id} onValueChange={(v) => updateItem(item.ui_id, 'product_id', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-[150px]">
                          <Select 
                            value={item.variant_id || "none"} 
                            onValueChange={(v) => updateItem(item.ui_id, 'variant_id', v === "none" ? null : v)}
                            disabled={!item.availableVariants?.length}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={item.availableVariants?.length ? "Select Variant" : "N/A"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-- None --</SelectItem>
                              {item.availableVariants?.map((v: any) => (
                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="w-[120px]">
                          <Input 
                            type="number" 
                            min="1" 
                            value={item.quantity} 
                            onChange={(e) => updateItem(item.ui_id, 'quantity', Number(e.target.value))} 
                          />
                        </TableCell>
                        <TableCell className="w-[140px]">
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            value={item.unit_price} 
                            onChange={(e) => updateItem(item.ui_id, 'unit_price', Number(e.target.value))} 
                          />
                        </TableCell>
                        <TableCell className="w-[100px]">
                          <Input type="number" min="0" value={item.tax_percentage || 0} onChange={(e) => updateItem(item.ui_id, 'tax_percentage', Number(e.target.value))} />
                        </TableCell>
                        <TableCell className="w-[100px]">
                          <Input type="number" min="0" value={item.discount_percentage || 0} onChange={(e) => updateItem(item.ui_id, 'discount_percentage', Number(e.target.value))} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹ {orderTotals.items.find(t => t.id === item.ui_id.toString())?.line_total.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.ui_id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {items.length > 0 && (
                    <>
                      <TableRow className="border-t-2 bg-muted/30">
                        <TableCell colSpan={6} className="text-right font-medium">Subtotal (Without Item Discount)</TableCell>
                        <TableCell colSpan={2} className="text-right font-medium text-muted-foreground">
                          ₹ {orderTotals.subtotal.toFixed(2)}
                        </TableCell>
                      </TableRow>
                      
                      {orderTotals.total_discount > 0 && (
                         <TableRow>
                          <TableCell colSpan={6} className="text-right text-muted-foreground">Total Item Discount</TableCell>
                          <TableCell colSpan={2} className="text-right text-red-500 font-medium">
                            -₹ {orderTotals.total_discount.toFixed(2)}
                          </TableCell>
                         </TableRow>
                      )}

                      <TableRow>
                        <TableCell colSpan={6} className="text-right">
                          Extra Discount (%)
                          {extraDiscountPct > 0 && (
                            <span className="ml-2 text-xs text-red-500 font-normal">
                              (-₹ {orderTotals.extra_discount_amount.toFixed(2)})
                            </span>
                          )}
                        </TableCell>
                        <TableCell colSpan={2} className="text-right">
                          <Input 
                            type="number" 
                            min="0" 
                            max="100"
                            className="w-32 inline-block text-right" 
                            value={extraDiscountPct || ''} 
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : 0;
                              setExtraDiscountPct(val);
                              if (val > 0) setExtraDiscount(0); 
                            }} 
                            placeholder="0"
                          />
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={6} className="text-right text-muted-foreground">Extra Discount (Fixed ₹)</TableCell>
                        <TableCell colSpan={2} className="text-right">
                          <Input 
                            type="number" 
                            min="0" 
                            className="w-32 inline-block text-right" 
                            value={extraDiscount || ''} 
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : 0;
                              setExtraDiscount(val);
                              if (val > 0) setExtraDiscountPct(0);
                            }} 
                            placeholder="0.00"
                          />
                        </TableCell>
                      </TableRow>

                      <TableRow>
                        <TableCell colSpan={6} className="text-right text-muted-foreground">Total Tax</TableCell>
                        <TableCell colSpan={2} className="text-right text-muted-foreground font-medium">
                          ₹ {orderTotals.total_tax.toFixed(2)}
                        </TableCell>
                      </TableRow>

                      {/* EXTRA CHARGES WIDGET */}
                      <TableRow className="bg-muted/30 border-t">
                        <TableCell colSpan={8} className="p-0">
                          <div className="p-4 space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="font-semibold text-sm">Extra Charges</h4>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setExtraCharges([...extraCharges, { name: '', amount: 0, tax_percent: 0 }])}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Charge
                              </Button>
                            </div>
                            
                            {extraCharges.length > 0 && (
                              <div className="space-y-2">
                                {extraCharges.map((charge, idx) => (
                                  <div key={idx} className="flex gap-2 items-center">
                                    <Input 
                                      placeholder="Charge Name (e.g. Shipping)" 
                                      value={charge.name}
                                      onChange={(e) => {
                                        const newArr = [...extraCharges];
                                        newArr[idx].name = e.target.value;
                                        setExtraCharges(newArr);
                                      }}
                                      className="flex-1"
                                    />
                                    <Input 
                                      type="number" 
                                      placeholder="Amount" 
                                      value={charge.amount || ''}
                                      onChange={(e) => {
                                        const newArr = [...extraCharges];
                                        newArr[idx].amount = Number(e.target.value);
                                        setExtraCharges(newArr);
                                      }}
                                      className="w-24 text-right"
                                    />
                                    <Input 
                                      type="number" 
                                      placeholder="Tax %" 
                                      value={charge.tax_percent || ''}
                                      onChange={(e) => {
                                        const newArr = [...extraCharges];
                                        newArr[idx].tax_percent = Number(e.target.value);
                                        setExtraCharges(newArr);
                                      }}
                                      className="w-20 text-right"
                                    />
                                    <div className="w-24 text-right text-sm">
                                      ₹ {(charge.amount + ((charge.amount * (charge.tax_percent || 0)) / 100)).toFixed(2)}
                                    </div>
                                    <Button 
                                      type="button" 
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-destructive h-8 w-8"
                                      onClick={() => {
                                        const newArr = [...extraCharges];
                                        newArr.splice(idx, 1);
                                        setExtraCharges(newArr);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <div className="text-right text-sm font-medium pt-2">
                                  Total Extra Charges: <span className="ml-2">₹ {orderTotals.total_extra_charges.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {orderTotals.round_off_amount !== 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-right text-muted-foreground">Round Off</TableCell>
                          <TableCell colSpan={2} className="text-right text-muted-foreground font-medium">
                            {orderTotals.round_off_amount > 0 ? '+' : ''}{orderTotals.round_off_amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )}

                      <TableRow className="bg-muted/50 border-t-2">
                        <TableCell colSpan={6} className="text-right font-bold text-lg">Grand Total</TableCell>
                        <TableCell colSpan={2} className="text-right font-bold text-xl text-green-600">
                          ₹ {orderTotals.total_amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={createMutation.isPending} className="bg-primary">
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending ? 'Saving...' : 'Create Quotation'}
          </Button>
        </div>
      </form>
    </div>
  );
}
