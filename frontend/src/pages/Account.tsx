import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserNav } from '@/components/user/UserNav';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Home, Building, MapPin, Trash2, Pencil } from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { addressApi } from '@/api/addresses';
import { cn } from '@/lib/utils';
import AddressForm from './account/AddressForm';
import { Address } from '@/types/database';

const profileSchema = z.object({
  firstName: z.string().min(2, { message: 'First name must be at least 2 characters' }),
  lastName: z.string().min(2, { message: 'Last name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }).optional(),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  newPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters' }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const addressSchema = z.object({
  address_type: z.enum(['shipping', 'billing', 'both'], {
    required_error: "Please select an address type",
  }),
  address_line1: z.string().min(5, { message: "Address line 1 is required" }),
  address_line2: z.string().optional(),
  city: z.string().min(2, { message: "City is required" }),
  state: z.string().min(2, { message: "State/Province is required" }),
  postal_code: z.string().min(3, { message: "Postal code is required" }),
  country: z.string().min(2, { message: "Country is required" }),
  is_default: z.boolean().default(false),
});

const Account = () => {
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isAddressLoading, setIsAddressLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const navigate = useNavigate();

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      email: user?.email || '',
      phone: profile?.phone || '',
    },
    values: {
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      email: user?.email || '',
      phone: profile?.phone || '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const addressForm = useForm<z.infer<typeof addressSchema>>({
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

  // Fetch user addresses
  React.useEffect(() => {
    const fetchAddresses = async () => {
      if (!user) return;
      
      try {
        setIsAddressLoading(true);
        console.log('Fetching addresses for user:', user.id);
        
        // Add detailed request debugging
        try {
          const session = await supabase.auth.getSession();
          console.log('Current auth session:', session);
        } catch (e) {
          console.error('Error getting auth session:', e);
        }
        
        // Get fresh auth token before making request
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          console.error('No active session found');
          toast.error('Authentication issue. Please log in again.');
          return;
        }
        
        console.log('Making API request with token:', sessionData.session.access_token.substring(0, 10) + '...');
        
        try {
          // Make a direct fetch request to check exact response
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://rishabh.dtsanskar.tech/api' || 'https://0ea5-2401-4900-8848-d00e-cc78-5131-e91f-1491.ngrok-free.app/api'}/auth/addresses`, {
            headers: {
              'Authorization': `Bearer ${sessionData.session.access_token}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });
          
          console.log('Raw fetch response status:', response.status);
          const responseData = await response.json();
          console.log('Raw fetch response data:', responseData);
          
        } catch (fetchError) {
          console.error('Raw fetch error:', fetchError);
        }
        
        // Continue with normal request via API client
        const data = await addressApi.getAddresses();
        console.log('Fetched addresses via apiClient:', data);
        setAddresses(data || []);
      } catch (error: any) {
        console.error('Error fetching addresses:', error);
        console.error('Error details:', error.response?.data || error.message);
        toast.error(error.message || 'Failed to load addresses');
      } finally {
        setIsAddressLoading(false);
      }
    };
    
    fetchAddresses();
    
    // Add a retry mechanism in case the first attempt fails
    const retryTimer = setTimeout(() => {
      console.log('Retrying address fetch...');
      fetchAddresses();
    }, 2000);
    
    return () => clearTimeout(retryTimer);
  }, [user]);

  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: values.firstName,
          last_name: values.lastName,
          phone: values.phone,
        })
        .eq('id', user?.id);

      if (error) {
        throw error;
      }

      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Error updating profile');
      console.error('Error updating profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (error) {
        throw error;
      }

      toast.success('Password updated successfully!');
      passwordForm.reset();
    } catch (error: any) {
      toast.error(error.message || 'Error updating password');
      console.error('Error updating password:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onAddressSubmit = async (values: z.infer<typeof addressSchema>) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const addressData = {
        address_type: values.address_type,
        address_line1: values.address_line1,
        city: values.city,
        state: values.state || null,
        postal_code: values.postal_code || null,
        country: values.country,
        is_default: values.is_default || false,
        address_line2: values.address_line2 || null
      };
      
      const data = await addressApi.addAddress(addressData);
      
      // Update local state
      setAddresses([data, ...addresses]);
      toast.success('Address added successfully!');
      addressForm.reset();
    } catch (error: any) {
      toast.error(error.message || 'Error adding address');
      console.error('Error adding address:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    
    try {
      await addressApi.deleteAddress(addressId);
      
      // Update local state
      setAddresses(addresses.filter(addr => addr.id !== addressId));
      toast.success('Address deleted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Error deleting address');
      console.error('Error deleting address:', error);
    }
  };

  const setDefaultAddress = async (id: string, addressType: 'shipping' | 'billing' | 'both') => {
    try {
      const updatedAddress = await addressApi.setDefaultAddress(id, addressType);
      
      // Update addresses in state
      setAddresses(addresses.map(addr => {
        // Set the selected address as default
        if (addr.id === id) {
          return updatedAddress;
        }
        // Remove default status from other addresses of the same type
        if (addr.address_type === addressType) {
          return { ...addr, is_default: false };
        }
        return addr;
      }));
      
      toast.success('Default address updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Error setting default address');
      console.error('Error setting default address:', error);
    }
  };

  // Handle address form submission from modal
  const handleAddressAdded = (newAddress: Address) => {
    if (editingAddressId) {
      // Update existing address in the list
      setAddresses(addresses.map(addr => 
        addr.id === editingAddressId ? newAddress : addr
      ));
      setEditingAddressId(null);
    } else {
      // Add new address to the list
      setAddresses([newAddress, ...addresses]);
    }
    setShowAddressForm(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button 
        variant="outline"
        onClick={() => navigate('/')}
        className="mb-4"
      >
        Back to Home
      </Button>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <UserNav />
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your account profile information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} disabled />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="addresses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Address Management</CardTitle>
                <CardDescription>
                  Manage your shipping and billing addresses
                </CardDescription>
              </div>
              <Button 
                className="flex items-center gap-2"
                onClick={() => {
                  setEditingAddressId(null);
                  setShowAddressForm(true);
                }}
              >
                <PlusCircle className="h-4 w-4" />
                Add Address
              </Button>
            </CardHeader>
            <CardContent>
              {isAddressLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading addresses...</p>
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg">
                  <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">You don't have any saved addresses yet.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      setEditingAddressId(null);
                      setShowAddressForm(true);
                    }}
                  >
                    Add your first address
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {addresses.map((address) => (
                    <div 
                      key={address.id} 
                      className={cn(
                        "border rounded-lg p-4 relative",
                        address.is_default && "border-primary"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {address.address_type === 'shipping' ? (
                            <Home className="h-4 w-4 text-primary" />
                          ) : address.address_type === 'billing' ? (
                            <Building className="h-4 w-4 text-primary" />
                          ) : (
                            <MapPin className="h-4 w-4 text-primary" />
                          )}
                          <div>
                            <span className="font-medium capitalize">
                              {address.address_type} Address
                            </span>
                            {address.is_default && (
                              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!address.is_default && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDefaultAddress(address.id, address.address_type)}
                            >
                              Set as Default
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary/90"
                            onClick={() => {
                              setEditingAddressId(address.id);
                              setShowAddressForm(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive/90"
                            onClick={() => deleteAddress(address.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-sm text-muted-foreground space-y-1">
                        <p>{address.address_line1}</p>
                        {address.address_line2 && <p>{address.address_line2}</p>}
                        <p>
                          {address.city}
                          {address.state && `, ${address.state}`}
                          {address.postal_code && ` ${address.postal_code}`}
                        </p>
                        <p>{address.country}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Address Form Modal */}
      {showAddressForm && (
        <div 
          className="fixed inset-0 bg-black/5 backdrop-blur-sm z-50 flex items-center justify-center overflow-auto"
          onClick={() => setShowAddressForm(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <AddressForm 
              editId={editingAddressId} 
              onClose={() => {
                setShowAddressForm(false);
                setEditingAddressId(null);
              }}
              onAddressAdded={handleAddressAdded}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
