import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from 'sonner';
import { companyService, Company } from '@/api/company';
import { Building2, Plus, Trash2, Landmark, Globe, MapPin, Phone, Mail, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { uploadsService } from '@/api/uploads';
import { ImageUpload } from '@/components/ui/image-upload';

const companySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  gstin: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  postal_code: z.string().optional().or(z.literal('')),
  country: z.string().default('India'),
  bank_details: z.array(z.object({
    bank_name: z.string().min(1, 'Bank name is required'),
    account_holder_name: z.string().min(1, 'Account holder name is required'),
    account_number: z.string().min(1, 'Account number is required'),
    ifsc_code: z.string().min(1, 'IFSC code is required'),
  })).default([]),
  logo_url: z.string().optional().or(z.literal('')),
  payment_upi_id: z.string().optional().or(z.literal('')),
  payment_qr_code_url: z.string().optional().or(z.literal('')),
  website_url: z.string().optional().or(z.literal('')),
  website_qr_code_url: z.string().optional().or(z.literal('')),
  invoice_custom_message: z.string().optional().or(z.literal('')),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export default function CompanySettings() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  
    const { data: company, isLoading } = useQuery({
    queryKey: ['company', 'me'],
    queryFn: () => companyService.getMyCompany(),
  });

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      gstin: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India',
      bank_details: [],
      logo_url: '',
      payment_upi_id: '',
      payment_qr_code_url: '',
      website_url: '',
      website_qr_code_url: '',
      invoice_custom_message: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "bank_details",
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name || '',
        email: company.email || '',
        phone: company.phone || '',
        gstin: company.gstin || '',
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        postal_code: company.postal_code || '',
        country: company.country || 'India',
        bank_details: (company.bank_details as any) || [],
        logo_url: company.logo_url || '',
        payment_upi_id: company.payment_upi_id || '',
        payment_qr_code_url: company.payment_qr_code_url || '',
        website_url: company.website_url || '',
        website_qr_code_url: company.website_qr_code_url || '',
        invoice_custom_message: company.invoice_custom_message || '',
      });
    }
  }, [company, form]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Company>) => companyService.updateMyCompany(data),
    onSuccess: () => {
      toast.success('Company profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['company', 'me'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update company profile');
    },
  });

  function onSubmit(values: CompanyFormValues) {
    updateMutation.mutate(values as any);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Company Profile</h2>
          <p className="text-muted-foreground">Manage your company identity and payment details for invoices.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Company Identity
                </CardTitle>
                <CardDescription>Official business details shown on bills.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Register Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Fresh Breeze Basket" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="billing@company.com" className="pl-9" {...field} />
                          </div>
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
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="+91 XXXXX XXXXX" className="pl-9" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN / Tax ID</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="09XXXXX1234X1Z5" className="pl-9" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Registered Address
                </CardTitle>
                <CardDescription>Address used for taxable supply.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Business Park" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Lucknow" {...field} />
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
                        <FormLabel>State / Province</FormLabel>
                        <FormControl>
                          <Input placeholder="Uttar Pradesh" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="226001" {...field} />
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
                          <div className="relative">
                            <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="India" className="pl-9" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bank Accounts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  Bank Accounts
                </CardTitle>
                <CardDescription>Add one or more bank accounts to show on your invoices.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => append({ bank_name: '', account_holder_name: '', account_number: '', ifsc_code: '' })}
              >
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">No bank accounts added yet.</p>
                </div>
              )}
              
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 relative p-4 border rounded-lg bg-card">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      control={form.control}
                      name={`bank_details.${index}.bank_name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <FormControl>
                            <Input placeholder="HDFC Bank" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`bank_details.${index}.account_holder_name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Holder Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Business Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`bank_details.${index}.account_number`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input placeholder="5020XXXXXXXXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`bank_details.${index}.ifsc_code`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFSC Code</FormLabel>
                          <FormControl>
                            <Input placeholder="HDFC000XXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Invoice Customizations & Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Invoice Customizations & Payments
              </CardTitle>
              <CardDescription>Configure company logo, payment options, website links, QR codes, and custom invoice text.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                {/* Company Logo Upload */}
                <div className="space-y-2 flex flex-col items-center border p-4 rounded-lg bg-muted/20">
                  <FormLabel className="text-sm font-semibold self-start mb-2">Company Logo</FormLabel>
                  <FormField
                    control={form.control}
                    name="logo_url"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center w-full">
                        <FormControl>
                          <ImageUpload
                            value={field.value || ''}
                            onChange={(url) => field.onChange(url)}
                            onFileSelect={async (file) => {
                              try {
                                setIsUploading(true);
                                const url = await uploadsService.uploadImage(file, 'company');
                                field.onChange(url);
                                toast.success('Logo uploaded successfully');
                              } catch (error: any) {
                                toast.error(error.message || 'Failed to upload logo');
                              } finally {
                                setIsUploading(false);
                              }
                            }}
                            disabled={isUploading}
                            size="small"
                          />
                        </FormControl>
                        <FormMessage />
                        <span className="text-xs text-muted-foreground text-center mt-2">
                          Logo will be left-aligned in the invoice/quotation header.
                        </span>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Payment Details & QR Code */}
                <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                  <FormField
                    control={form.control}
                    name="payment_upi_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Payment UPI ID (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="yourname@okaxis" {...field} />
                        </FormControl>
                        <FormMessage />
                        <span className="text-xs text-muted-foreground block">
                          If provided, a QR code pre-filled with the invoice amount will be auto-generated.
                        </span>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payment_qr_code_url"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center w-full mt-4">
                        <FormLabel className="text-sm font-semibold self-start mb-2">Custom Payment QR Code</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value || ''}
                            onChange={(url) => field.onChange(url)}
                            onFileSelect={async (file) => {
                              try {
                                setIsUploading(true);
                                const url = await uploadsService.uploadImage(file, 'company');
                                field.onChange(url);
                                toast.success('Payment QR Code uploaded successfully');
                              } catch (error: any) {
                                toast.error(error.message || 'Failed to upload QR code');
                              } finally {
                                setIsUploading(false);
                              }
                            }}
                            disabled={isUploading}
                            size="small"
                          />
                        </FormControl>
                        <FormMessage />
                        <span className="text-xs text-muted-foreground text-center mt-2">
                          Upload a custom QR image instead of auto-generating from UPI ID.
                        </span>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Website Details & QR Code */}
                <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                  <FormField
                    control={form.control}
                    name="website_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Website URL (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                        <span className="text-xs text-muted-foreground block">
                          If provided, a QR code directing to this website will be auto-generated.
                        </span>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website_qr_code_url"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center w-full mt-4">
                        <FormLabel className="text-sm font-semibold self-start mb-2">Custom Website QR Code</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value || ''}
                            onChange={(url) => field.onChange(url)}
                            onFileSelect={async (file) => {
                              try {
                                setIsUploading(true);
                                const url = await uploadsService.uploadImage(file, 'company');
                                field.onChange(url);
                                toast.success('Website QR Code uploaded successfully');
                              } catch (error: any) {
                                toast.error(error.message || 'Failed to upload QR code');
                              } finally {
                                setIsUploading(false);
                              }
                            }}
                            disabled={isUploading}
                            size="small"
                          />
                        </FormControl>
                        <FormMessage />
                        <span className="text-xs text-muted-foreground text-center mt-2">
                          Upload a custom website QR image instead of auto-generating.
                        </span>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Custom Message Field */}
              <FormField
                control={form.control}
                name="invoice_custom_message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Custom Invoice Message (Footer)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Thank you for shopping with us! Visit again." 
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                    <span className="text-xs text-muted-foreground block">
                      This text will be displayed at the very end of your invoices and quotations.
                    </span>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              size="lg" 
              className="bg-orange-600 hover:bg-orange-700 min-w-[150px]"
              disabled={updateMutation.isPending || isUploading}
            >
              {updateMutation.isPending ? 'Saving...' : isUploading ? 'Uploading...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
