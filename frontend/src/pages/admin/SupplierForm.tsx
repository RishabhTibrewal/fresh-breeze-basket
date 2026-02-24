import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { suppliersService, CreateSupplierData } from '@/api/suppliers';

export default function SupplierForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<CreateSupplierData>({
    name: '',
    supplier_code: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    gst_no: '',
    payment_terms: '',
    notes: '',
    opening_balance: 0,
    closing_balance: 0,
    vendor_name: '',
    trade_name: '',
    legal_name: '',
    udyam_registration_number: '',
    pan_number: '',
    bank_accounts: [],
  });

  const [bankAccounts, setBankAccounts] = useState<Array<{
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    account_holder_name: string;
    bank_address: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
    is_primary: boolean;
  }>>([]);

  // Fetch supplier if editing
  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => suppliersService.getById(id!),
    enabled: isEditMode && !!id,
  });

  // Populate form when supplier is loaded
  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name,
        supplier_code: supplier.supplier_code || '',
        contact_name: supplier.contact_name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        city: supplier.city || '',
        state: supplier.state || '',
        country: supplier.country || '',
        postal_code: supplier.postal_code || '',
        gst_no: supplier.gst_no || '',
        payment_terms: supplier.payment_terms || '',
        notes: supplier.notes || '',
        opening_balance: supplier.opening_balance || 0,
        closing_balance: supplier.closing_balance || 0,
        vendor_name: supplier.vendor_name || '',
        trade_name: supplier.trade_name || '',
        legal_name: supplier.legal_name || '',
        udyam_registration_number: supplier.udyam_registration_number || '',
        pan_number: supplier.pan_number || '',
        is_active: supplier.is_active,
        bank_accounts: [],
      });
      if (supplier.supplier_bank_accounts) {
        setBankAccounts(supplier.supplier_bank_accounts.map((acc: any) => ({
          bank_name: acc.bank_name || '',
          account_number: acc.account_number || '',
          ifsc_code: acc.ifsc_code || '',
          account_holder_name: acc.account_holder_name || '',
          bank_address: acc.bank_address || '',
          city: acc.city || '',
          state: acc.state || '',
          country: acc.country || '',
          postal_code: acc.postal_code || '',
          is_primary: acc.is_primary || false,
        })));
      }
    }
  }, [supplier]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: (data: CreateSupplierData) => {
      if (isEditMode) {
        return suppliersService.update(id!, data);
      }
      return suppliersService.create(data);
    },
    onSuccess: () => {
      toast.success(`Supplier ${isEditMode ? 'updated' : 'created'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      navigate('/admin/suppliers');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} supplier`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Supplier name is required');
      return;
    }

    saveMutation.mutate({
      ...formData,
      bank_accounts: bankAccounts,
    });
  };

  const addBankAccount = () => {
    setBankAccounts([...bankAccounts, {
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      account_holder_name: '',
      bank_address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      is_primary: false,
    }]);
  };

  const removeBankAccount = (index: number) => {
    setBankAccounts(bankAccounts.filter((_, i) => i !== index));
  };

  const updateBankAccount = (index: number, field: string, value: any) => {
    const updated = [...bankAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setBankAccounts(updated);
  };

  if (isEditMode && isLoading) {
    return <div className="text-center py-8">Loading supplier...</div>;
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/admin/suppliers')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
            {isEditMode ? 'Edit Supplier' : 'Create Supplier'}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isEditMode ? 'Update supplier information' : 'Add a new supplier'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Legal Name</Label>
                <Input
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Trade Name</Label>
                <Input
                  value={formData.trade_name}
                  onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Vendor Name</Label>
                <Input
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Supplier Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Supplier Code</Label>
                <Input
                  value={formData.supplier_code}
                  onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })}
                  placeholder="SUP-001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Contact Name</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle>Address Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Address</Label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>City</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Country</Label>
                  <Input
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Postal Code</Label>
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              
            </CardContent>
          </Card>

          {/* Financial Information */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Closing Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.closing_balance}
                  onChange={(e) => setFormData({ ...formData, closing_balance: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Legal & Tax Information */}
          <Card>
            <CardHeader>
              <CardTitle>Legal & Tax Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>PAN Number</Label>
                <Input
                  value={formData.pan_number}
                  onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>GST Number</Label>
                <Input
                  value={formData.gst_no}
                  onChange={(e) => setFormData({ ...formData, gst_no: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Udyam Registration Number (URN)</Label>
                <Input
                  value={formData.udyam_registration_number}
                  onChange={(e) => setFormData({ ...formData, udyam_registration_number: e.target.value })}
                  placeholder="UDYAM-XX-XX-XXXXXX"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  MSME Udyam Registration Number
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Payment Terms</Label>
                <Textarea
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  placeholder="e.g., Net 30, Net 60"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active !== false}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Bank Accounts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Bank Accounts</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addBankAccount}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {bankAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bank accounts added</p>
              ) : (
                bankAccounts.map((account, index) => (
                  <Card key={index}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Account {index + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBankAccount(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <Label>Bank Name</Label>
                        <Input
                          value={account.bank_name}
                          onChange={(e) => updateBankAccount(index, 'bank_name', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Account Number</Label>
                        <Input
                          value={account.account_number}
                          onChange={(e) => updateBankAccount(index, 'account_number', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>IFSC Code</Label>
                        <Input
                          value={account.ifsc_code}
                          onChange={(e) => updateBankAccount(index, 'ifsc_code', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Account Holder Name</Label>
                        <Input
                          value={account.account_holder_name}
                          onChange={(e) => updateBankAccount(index, 'account_holder_name', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Bank Address</Label>
                        <Textarea
                          value={account.bank_address}
                          onChange={(e) => updateBankAccount(index, 'bank_address', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>City</Label>
                        <Input
                          value={account.city}
                          onChange={(e) => updateBankAccount(index, 'city', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>State</Label>
                        <Input
                          value={account.state}
                          onChange={(e) => updateBankAccount(index, 'state', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Country</Label>
                        <Input
                          value={account.country}
                          onChange={(e) => updateBankAccount(index, 'country', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Postal Code</Label>
                        <Input
                          value={account.postal_code}
                          onChange={(e) => updateBankAccount(index, 'postal_code', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`primary-${index}`}
                          checked={account.is_primary}
                          onChange={(e) => updateBankAccount(index, 'is_primary', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`primary-${index}`} className="cursor-pointer">
                          Primary Account
                        </Label>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/suppliers')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : isEditMode ? 'Update Supplier' : 'Create Supplier'}
          </Button>
        </div>
      </form>
    </div>
  );
}
