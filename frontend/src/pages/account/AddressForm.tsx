import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { addressApi } from '@/api/addresses';
import { Address } from '@/types/database';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from 'lucide-react';

const addressSchema = z.object({
  address_type: z.enum(['shipping', 'billing', 'both'], {
    required_error: "Please select an address type",
  }),
  address_line1: z.string().min(5, { message: "Address line 1 is required" }),
  address_line2: z.string().optional(),
  city: z.string().min(2, { message: "City is required" }),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(2, { message: "Country is required" }),
  is_default: z.boolean().default(false),
});

type AddressFormType = z.infer<typeof addressSchema>;

interface AddressFormProps {
  editId: string | null;
  onClose: () => void;
  onAddressAdded: (address: Address) => void;
}

const AddressForm = ({ editId, onClose, onAddressAdded }: AddressFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const form = useForm<AddressFormType>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      address_type: 'shipping',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      is_default: false,
    },
  });

  // Fetch address data if editing
  useEffect(() => {
    const fetchAddress = async () => {
      if (!editId) return;
      
      try {
        setIsLoading(true);
        // Get all addresses and find the one with matching ID
        const addresses = await addressApi.getAddresses();
        const addressData = addresses.find(addr => addr.id === editId);
        
        if (addressData) {
          form.reset({
            address_type: addressData.address_type as 'shipping' | 'billing' | 'both',
            address_line1: addressData.address_line1,
            address_line2: addressData.address_line2 || '',
            city: addressData.city,
            state: addressData.state || '',
            postal_code: addressData.postal_code || '',
            country: addressData.country,
            is_default: addressData.is_default,
          });
        } else {
          toast.error('Address not found');
          onClose();
        }
      } catch (error: any) {
        console.error('Error fetching address:', error);
        toast.error(error.message || 'Failed to load address details');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAddress();
  }, [editId, form, onClose]);

  const onSubmit = async (data: AddressFormType) => {
    setIsSubmitting(true);
    
    try {
      // Prepare data for submission
      const addressData = {
        address_type: data.address_type,
        address_line1: data.address_line1,
        address_line2: data.address_line2 || null,
        city: data.city,
        state: data.state || null,
        postal_code: data.postal_code || null,
        country: data.country,
        is_default: data.is_default,
      };
      
      let result;
      
      if (editId) {
        // Update existing address
        result = await addressApi.updateAddress(editId, addressData);
        toast.success('Address updated successfully!');
      } else {
        // Add new address
        result = await addressApi.addAddress(addressData);
        toast.success('Address added successfully!');
      }
      
      // Call the callback with the new/updated address
      onAddressAdded(result);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${editId ? 'update' : 'add'} address`);
      console.error(`Error ${editId ? 'updating' : 'adding'} address:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{editId ? 'Edit Address' : 'Add New Address'}</CardTitle>
            <CardDescription>
              {editId ? 'Update your address information' : 'Add a new shipping or billing address'}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex justify-center items-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading address information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{editId ? 'Edit Address' : 'Add New Address'}</CardTitle>
          <CardDescription>
            {editId ? 'Update your address information' : 'Add a new shipping or billing address'}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="address_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select address type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="shipping">Shipping</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="both">Both (Shipping & Billing)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="address_line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input placeholder="Street address, P.O. box, company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="address_line2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2 (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Apartment, suite, unit, building, floor, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Province (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Set as default address</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            
            <CardFooter className="flex justify-between px-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editId ? 'Update Address' : 'Add Address'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default AddressForm; 