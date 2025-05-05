import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AddressForm from './AddressForm';
import { Address } from '@/types/database';

export default function AddressPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isAddressLoading, setIsAddressLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Fetch user addresses
  React.useEffect(() => {
    const fetchAddresses = async () => {
      if (!user) return;
      try {
        setIsAddressLoading(true);
        const data = await (await import('@/api/addresses')).addressApi.getAddresses();
        setAddresses(data || []);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load addresses');
      } finally {
        setIsAddressLoading(false);
      }
    };
    fetchAddresses();
  }, [user]);

  const handleAddressAdded = (newAddress: Address) => {
    setAddresses((prev) => {
      const exists = prev.some(addr => addr.id === newAddress.id);
      if (exists) {
        // Replace the old address with the updated one
        return prev.map(addr => addr.id === newAddress.id ? newAddress : addr);
      } else {
        // Add new address
        return [...prev, newAddress];
      }
    });
    setShowAddressForm(false);
  };

  const handleEdit = (addressId: string) => {
    setEditingAddressId(addressId);
    setShowAddressForm(true);
  };

  const handleDelete = async (addressId: string) => {
    try {
      await (await import('@/api/addresses')).addressApi.deleteAddress(addressId);
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
      toast.success('Address deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete address');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Addresses</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => { setShowAddressForm(true); setEditingAddressId(null); }} className="mb-4">
          Add New Address
        </Button>
        {isAddressLoading ? (
          <div>Loading addresses...</div>
        ) : addresses.length === 0 ? (
          <div>No addresses found.</div>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div key={address.id} className="border rounded p-4 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">{address.address_line1}</div>
                  <div>{address.address_line2}</div>
                  <div>{address.city}, {address.state} {address.postal_code}</div>
                  <div>{address.country}</div>
                  <div className="text-xs text-muted-foreground">{address.address_type}</div>
                </div>
                <div className="flex gap-2 mt-2 md:mt-0">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(address.id)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(address.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {showAddressForm && (
          <div 
            className="fixed inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center overflow-auto"
            onClick={() => setShowAddressForm(false)}
          >
            <div 
              className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto m-4"
              onClick={e => e.stopPropagation()}
            >
              <AddressForm
                editId={editingAddressId}
                onAddressAdded={handleAddressAdded}
                onClose={() => setShowAddressForm(false)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 