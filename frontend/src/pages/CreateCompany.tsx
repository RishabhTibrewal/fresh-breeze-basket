import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { companiesService, RegisterCompanyResponse } from '@/api/companies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

const companySlugSchema = z
  .string()
  .min(2, { message: 'Slug must be at least 2 characters' })
  .regex(/^[a-z0-9-]+$/, { message: 'Use lowercase letters, numbers, and hyphens only' });

const createCompanySchema = z
  .object({
    companyName: z.string().min(2, { message: 'Company name is required' }),
    companySlug: companySlugSchema.optional().or(z.literal('')),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email({ message: 'Please enter a valid email address' }),
    phone: z.string().optional(),
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type CreateCompanyFormValues = z.infer<typeof createCompanySchema>;

const CreateCompany = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<RegisterCompanyResponse | null>(null);

  const form = useForm<CreateCompanyFormValues>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      companyName: '',
      companySlug: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: CreateCompanyFormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessData(null);

    try {
      const payload = {
        company_name: values.companyName,
        company_slug: values.companySlug?.trim() || undefined,
        email: values.email,
        password: values.password,
        first_name: values.firstName?.trim() || undefined,
        last_name: values.lastName?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
      };
      const data = await companiesService.registerCompany(payload);
      setSuccessData(data);
      form.reset();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to create company';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">
            <span className="font-playfair">Fresh</span>
            <span className="text-primary-light">Basket</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Create a new company to manage your store
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Company</CardTitle>
            <CardDescription>
              This will create a company and an admin user for managing it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {successData && (
              <Alert className="mb-4">
                <AlertDescription>
                  Company created successfully. Login at:{' '}
                  <a
                    href={successData.login_url}
                    className="text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {successData.login_url}
                  </a>
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Foods" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="companySlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Slug (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="acme-foods" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ada" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Lovelace" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@acme.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+1-555-0100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating company...' : 'Create Company'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            After creation, use the provided login URL to access the admin dashboard.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default CreateCompany;
