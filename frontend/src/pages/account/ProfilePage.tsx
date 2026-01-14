import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/api/auth';
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

const profileSchema = z.object({
  firstName: z.string().min(2, { message: 'First name must be at least 2 characters' }),
  lastName: z.string().min(2, { message: 'Last name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }).optional(),
  phone: z.string().optional(),
});

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    console.log('=== PROFILE PAGE FORM SUBMISSION STARTED ===');
    console.log('Profile form submitted with values:', values);
    setIsSubmitting(true);
    try {
      console.log('Calling authService.updateProfile from ProfilePage...');
      // Use backend API endpoint to update profile
      const result = await authService.updateProfile({
        first_name: values.firstName,
        last_name: values.lastName,
        phone: values.phone,
      });
      console.log('Profile update successful, result:', result);

      // Refresh profile in AuthContext to update the UI
      await refreshProfile();

      toast.success('Profile updated successfully!');
      console.log('=== PROFILE PAGE FORM SUBMISSION COMPLETED SUCCESSFULLY ===');
    } catch (error: any) {
      console.error('=== PROFILE PAGE FORM SUBMISSION ERROR ===');
      console.error('Error updating profile:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || error.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal information below.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
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
                  <FormDescription>Your email cannot be changed.</FormDescription>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
} 