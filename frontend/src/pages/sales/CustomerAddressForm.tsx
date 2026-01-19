import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { customerService, CustomerAddress } from '@/api/customer';

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

interface CustomerAddressFormProps {
  customerId: string;
  onClose: () => void;
  onAddressAdded: (address: any) => void;
}

export default function CustomerAddressForm({ customerId, onClose, onAddressAdded }: CustomerAddressFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const onSubmit = async (data: AddressFormType) => {
    if (!customerId) {
      toast.error('Customer ID is required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare data for submission
      const addressData: CustomerAddress = {
        address_type: data.address_type,
        address_line1: data.address_line1,
        address_line2: data.address_line2 || null,
        city: data.city,
        state: data.state || null,
        postal_code: data.postal_code || null,
        country: data.country,
        is_default: data.is_default,
      };
      
      // Use the customer service to add address to the specific customer
      const result = await customerService.addCustomerAddress(customerId, addressData);
      toast.success('Address added to customer account');
      
      // Call the callback with the new address
      onAddressAdded(result);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add address to customer');
      console.error('Error adding customer address:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="space-y-4 sm:space-y-6 w-full min-w-0"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-base sm:text-lg font-medium break-words">Add New Address</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <Form {...form}>
        <div className="space-y-4 sm:space-y-6">
          <FormField
            control={form.control}
            name="address_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs sm:text-sm">Address Type</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="text-sm sm:text-base h-9 sm:h-10">
                      <SelectValue placeholder="Select address type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="shipping" className="text-sm">Shipping</SelectItem>
                    <SelectItem value="billing" className="text-sm">Billing</SelectItem>
                    <SelectItem value="both" className="text-sm">Both (Shipping & Billing)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="address_line1"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs sm:text-sm">Address Line 1</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Street address, P.O. box, company name" 
                    className="text-sm sm:text-base h-9 sm:h-10"
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="address_line2"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs sm:text-sm">Address Line 2 (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Apartment, suite, unit, building, floor, etc." 
                    className="text-sm sm:text-base h-9 sm:h-10"
                    {...field} 
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs sm:text-sm">City</FormLabel>
                  <FormControl>
                    <Input placeholder="City" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs sm:text-sm">State/Province (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="State or province" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <FormField
              control={form.control}
              name="postal_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs sm:text-sm">Postal/ZIP Code (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Postal or ZIP code" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs sm:text-sm">Country</FormLabel>
                  <FormControl>
                    <Input placeholder="Country" className="text-sm sm:text-base h-9 sm:h-10" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="is_default"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-2 sm:space-x-3 space-y-0 py-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-xs sm:text-sm cursor-pointer">
                    Set as default address
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />
          
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto text-sm sm:text-base"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              className="w-full sm:w-auto text-sm sm:text-base"
              onClick={() => form.handleSubmit(onSubmit)()}
            >
              {isSubmitting ? 'Saving...' : 'Save Address'}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
} 