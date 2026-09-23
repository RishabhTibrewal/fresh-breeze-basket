import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

const registerSchema = z.object({
  customerType: z.enum(['individual', 'business']).default('individual'),
  firstName: z.string().min(2, { message: 'First name must be at least 2 characters' }),
  lastName: z.string().min(2, { message: 'Last name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  phone: z.string().optional(),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  confirmPassword: z.string(),
  legalBusinessName: z.string().optional(),
  trnNumber: z.string().optional(),
  taxId: z.string().optional(),
  businessAddress: z.string().optional(),
  businessCity: z.string().optional(),
  businessState: z.string().optional(),
  businessPostalCode: z.string().optional(),
  businessCountry: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const Auth = () => {
  const { user, signIn, signUp } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [authError, setAuthError] = useState<string | null>(null);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      customerType: 'individual',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      legalBusinessName: '',
      trnNumber: '',
      taxId: '',
      businessAddress: '',
      businessCity: '',
      businessState: '',
      businessPostalCode: '',
      businessCountry: 'India',
    },
  });

  const selectedCustomerType = registerForm.watch('customerType');

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await signIn(values.email, values.password);
    } catch (error: any) {
      setAuthError(error.message || 'Failed to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRegisterSubmit = async (values: z.infer<typeof registerSchema>) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await signUp(
        values.email,
        values.password,
        values.firstName,
        values.lastName,
        values.phone || '',
        {
          customer_type: values.customerType,
          legal_business_name: values.legalBusinessName || undefined,
          trn_number: values.trnNumber || undefined,
          tax_id: values.taxId || undefined,
          business_address: values.businessAddress || undefined,
          business_city: values.businessCity || undefined,
          business_state: values.businessState || undefined,
          business_postal_code: values.businessPostalCode || undefined,
          business_country: values.businessCountry || undefined,
        }
      );
      setActiveTab('login');
      registerForm.reset();
    } catch (error: any) {
      setAuthError(error.message || 'Failed to register');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">
            <span className="font-playfair">Fresh</span>
            <span className="text-primary-light">Basket</span>
          </h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
            <TabsTrigger value="company">Register Company</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {authError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{authError}</AlertDescription>
                  </Alert>
                )}
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
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
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? 'Logging in...' : 'Login'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>
                  Select your account type and enter your details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {authError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{authError}</AlertDescription>
                  </Alert>
                )}
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    
                    {/* Account Type Selector */}
                    <FormField
                      control={registerForm.control}
                      name="customerType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold">Account Type</FormLabel>
                          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
                            <button
                              type="button"
                              className={`py-2 px-3 text-xs font-semibold rounded-md transition-all ${
                                field.value === 'individual'
                                  ? 'bg-white shadow-sm text-primary'
                                  : 'text-gray-500 hover:text-gray-900'
                              }`}
                              onClick={() => field.onChange('individual')}
                            >
                              👤 Individual Customer
                            </button>
                            <button
                              type="button"
                              className={`py-2 px-3 text-xs font-semibold rounded-md transition-all ${
                                field.value === 'business'
                                  ? 'bg-white shadow-sm text-primary'
                                  : 'text-gray-500 hover:text-gray-900'
                              }`}
                              onClick={() => field.onChange('business')}
                            >
                              🏢 Business Account
                            </button>
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="you@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number (Optional)</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="+1234567890" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Conditional Business Profile Inputs (Optional) */}
                    {selectedCustomerType === 'business' && (
                      <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-4 space-y-3 mt-2">
                        <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-1">
                          🏢 Business Profile Details (Optional)
                        </div>

                        <FormField
                          control={registerForm.control}
                          name="legalBusinessName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Legal Business Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Acme Enterprises LLC" className="bg-white text-xs h-9" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={registerForm.control}
                            name="trnNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">TRN Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="100XXXXXXXXX" className="bg-white text-xs h-9" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="taxId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">GST / VAT Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="09XXXXX1234X1Z5" className="bg-white text-xs h-9" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={registerForm.control}
                          name="businessAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Business Street Address</FormLabel>
                              <FormControl>
                                <Input placeholder="Suite 404, Tech Park" className="bg-white text-xs h-9" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <FormField
                            control={registerForm.control}
                            name="businessCity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">City</FormLabel>
                                <FormControl>
                                  <Input placeholder="Mumbai" className="bg-white text-xs h-9" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="businessState"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">State / Province</FormLabel>
                                <FormControl>
                                  <Input placeholder="Maharashtra" className="bg-white text-xs h-9" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <FormField
                      control={registerForm.control}
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
                      control={registerForm.control}
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
                      {isSubmitting ? 'Creating account...' : 'Register'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Create a company</CardTitle>
                <CardDescription>
                  Set up a new company and an admin account to manage it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  You will be redirected to a dedicated company registration form.
                </p>
                <Button asChild className="w-full">
                  <Link to="/create-company">Register Company</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;
