import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  Edit,
  Trash2,
  Phone,
  Mail,
  Building2,
  DollarSign,
  Calendar,
  MapPin,
  Globe,
  Filter,
  X,
  Clock,
  Target,
  User,
  Eye,
  CalendarClock,
  Plus,
  ChevronDown,
} from "lucide-react";
import { format } from 'date-fns';
import { toast } from 'sonner';
import { adminService, AdminLead, GetLeadsParams, CreateLeadData, UpdateLeadData } from '@/api/admin';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatCurrency } from '@/lib/utils';

const leadFormSchema = z.object({
  sales_executive_id: z.string().min(1, "Sales executive is required"),
  company_name: z.string().optional(),
  contact_name: z.string().min(1, "Contact name is required"),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  contact_position: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  source: z.enum(['website', 'referral', 'cold_call', 'email', 'social_media', 'trade_show', 'other']).default('other'),
  estimated_value: z.number().min(0).optional(),
  currency: z.string().default('USD'),
  stage: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).default('new'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  expected_close_date: z.string().optional(),
  last_follow_up: z.string().optional(),
  next_follow_up: z.string().optional(),
  lost_reason: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-purple-100 text-purple-800',
  qualified: 'bg-yellow-100 text-yellow-800',
  proposal: 'bg-orange-100 text-orange-800',
  negotiation: 'bg-indigo-100 text-indigo-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

export default function AdminLeads() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [salesExecutiveFilter, setSalesExecutiveFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<AdminLead | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch sales executives for filter
  const { data: salesExecutivesData } = useQuery({
    queryKey: ['sales-executives'],
    queryFn: () => adminService.getSalesExecutives(),
  });

  const salesExecutives = salesExecutivesData?.data || [];

  // Fetch leads with filters
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['admin-leads', stageFilter, priorityFilter, sourceFilter, salesExecutiveFilter, searchQuery],
    queryFn: async () => {
      const params: GetLeadsParams = {};
      if (stageFilter !== 'all') params.stage = stageFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (sourceFilter !== 'all') params.source = sourceFilter;
      if (salesExecutiveFilter !== 'all') params.sales_executive_id = salesExecutiveFilter;
      if (searchQuery) params.search = searchQuery;
      
      const response = await adminService.getLeads(params);
      return response.data;
    },
  });

  const leads = leadsData || [];

  const createForm = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      sales_executive_id: '',
      stage: 'new',
      priority: 'medium',
      source: 'other',
      currency: 'USD',
    },
  });

  const editForm = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {},
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateLeadData) => adminService.createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast.success('Lead created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create lead');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeadData }) =>
      adminService.updateLead(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      setIsEditDialogOpen(false);
      setSelectedLead(null);
      editForm.reset();
      toast.success('Lead updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update lead');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast.success('Lead deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete lead');
    },
  });

  const handleCreate = () => {
    setIsCreateDialogOpen(true);
    createForm.reset({
      sales_executive_id: '',
      stage: 'new',
      priority: 'medium',
      source: 'other',
      currency: 'USD',
    });
  };

  const handleEdit = (lead: AdminLead) => {
    setSelectedLead(lead);
    editForm.reset({
      sales_executive_id: lead.sales_executive_id,
      company_name: lead.company_name || '',
      contact_name: lead.contact_name,
      contact_email: lead.contact_email || '',
      contact_phone: lead.contact_phone || '',
      contact_position: lead.contact_position || '',
      title: lead.title,
      description: lead.description || '',
      source: lead.source as any,
      estimated_value: lead.estimated_value,
      currency: lead.currency,
      stage: lead.stage as any,
      priority: lead.priority as any,
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || '',
      country: lead.country || '',
      postal_code: lead.postal_code || '',
      website: lead.website || '',
      notes: lead.notes || '',
      expected_close_date: lead.expected_close_date || '',
      last_follow_up: lead.last_follow_up || '',
      next_follow_up: lead.next_follow_up || '',
      lost_reason: lead.lost_reason || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleView = (lead: AdminLead) => {
    setSelectedLead(lead);
    setIsViewDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      deleteMutation.mutate(id);
    }
  };

  const onCreateSubmit = (values: LeadFormValues) => {
    const createData: CreateLeadData = {
      sales_executive_id: values.sales_executive_id,
      company_name: values.company_name || undefined,
      contact_name: values.contact_name,
      contact_email: values.contact_email || undefined,
      contact_phone: values.contact_phone || undefined,
      contact_position: values.contact_position || undefined,
      title: values.title,
      description: values.description || undefined,
      source: values.source,
      estimated_value: values.estimated_value,
      currency: values.currency,
      stage: values.stage,
      priority: values.priority,
      address: values.address || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      country: values.country || undefined,
      postal_code: values.postal_code || undefined,
      website: values.website || undefined,
      notes: values.notes || undefined,
      expected_close_date: values.expected_close_date || undefined,
      last_follow_up: values.last_follow_up || undefined,
      next_follow_up: values.next_follow_up || undefined,
    };

    createMutation.mutate(createData);
  };

  const onEditSubmit = (values: LeadFormValues) => {
    if (!selectedLead) return;

    const updateData: UpdateLeadData = {
      company_name: values.company_name || undefined,
      contact_name: values.contact_name,
      contact_email: values.contact_email || undefined,
      contact_phone: values.contact_phone || undefined,
      contact_position: values.contact_position || undefined,
      title: values.title,
      description: values.description || undefined,
      source: values.source,
      estimated_value: values.estimated_value,
      currency: values.currency,
      stage: values.stage,
      priority: values.priority,
      address: values.address || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      country: values.country || undefined,
      postal_code: values.postal_code || undefined,
      website: values.website || undefined,
      notes: values.notes || undefined,
      expected_close_date: values.expected_close_date || undefined,
      last_follow_up: values.last_follow_up || undefined,
      next_follow_up: values.next_follow_up || undefined,
      lost_reason: values.lost_reason || undefined,
    };

    updateMutation.mutate({ id: selectedLead.id, data: updateData });
  };

  const clearFilters = () => {
    setStageFilter('all');
    setPriorityFilter('all');
    setSourceFilter('all');
    setSalesExecutiveFilter('all');
    setSearchQuery('');
  };

  const getSalesExecutiveName = (lead: AdminLead) => {
    if (lead.sales_executive) {
      const { first_name, last_name, email } = lead.sales_executive;
      if (first_name || last_name) {
        return `${first_name || ''} ${last_name || ''}`.trim();
      }
      return email;
    }
    return 'Unknown';
  };

  return (
    <div className="space-y-3 sm:space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-3xl font-bold break-words">Leads Management</h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1 sm:mt-2 break-words">
            View and manage all leads across all sales executives
          </p>
        </div>
        <Button onClick={handleCreate} className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0 text-sm sm:text-base">
          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
          Create Lead
        </Button>
      </div>

      {/* Filters */}
      <Card className="w-full overflow-hidden min-w-0">
        {/* Mobile - Collapsible Dropdown Style */}
        <div className="lg:hidden">
          <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full cursor-pointer hover:bg-muted/50 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 rounded-md transition-colors min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Filter className="h-4 w-4 text-sm flex-shrink-0" />
                    <span className="text-sm font-medium">Filters</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${isFiltersOpen ? 'transform rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden">
              <CardContent className="space-y-2.5 w-full overflow-hidden min-w-0 pt-0 px-3 sm:px-6 pb-4">
                <div className="relative w-full min-w-0">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
                  <Input
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full min-w-0 text-sm h-9"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2.5 min-w-0">
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-full min-w-0 text-sm h-9">
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">All Stages</SelectItem>
                      <SelectItem value="new" className="text-sm">New</SelectItem>
                      <SelectItem value="contacted" className="text-sm">Contacted</SelectItem>
                      <SelectItem value="qualified" className="text-sm">Qualified</SelectItem>
                      <SelectItem value="proposal" className="text-sm">Proposal</SelectItem>
                      <SelectItem value="negotiation" className="text-sm">Negotiation</SelectItem>
                      <SelectItem value="won" className="text-sm">Won</SelectItem>
                      <SelectItem value="lost" className="text-sm">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-full min-w-0 text-sm h-9">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">All Priorities</SelectItem>
                      <SelectItem value="low" className="text-sm">Low</SelectItem>
                      <SelectItem value="medium" className="text-sm">Medium</SelectItem>
                      <SelectItem value="high" className="text-sm">High</SelectItem>
                      <SelectItem value="urgent" className="text-sm">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-full min-w-0 text-sm h-9">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">All Sources</SelectItem>
                      <SelectItem value="website" className="text-sm">Website</SelectItem>
                      <SelectItem value="referral" className="text-sm">Referral</SelectItem>
                      <SelectItem value="cold_call" className="text-sm">Cold Call</SelectItem>
                      <SelectItem value="email" className="text-sm">Email</SelectItem>
                      <SelectItem value="social_media" className="text-sm">Social Media</SelectItem>
                      <SelectItem value="trade_show" className="text-sm">Trade Show</SelectItem>
                      <SelectItem value="other" className="text-sm">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={salesExecutiveFilter} onValueChange={setSalesExecutiveFilter}>
                    <SelectTrigger className="w-full min-w-0 text-sm h-9">
                      <SelectValue placeholder="Sales Executive" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">All Sales Executives</SelectItem>
                      {salesExecutives.map((exec) => {
                        const name = exec.first_name || exec.last_name
                          ? `${exec.first_name || ''} ${exec.last_name || ''}`.trim()
                          : exec.email;
                        return (
                          <SelectItem key={exec.id} value={exec.id} className="text-sm">
                            {name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={clearFilters} size="sm" className="w-full text-sm h-9">
                  <X className="h-3.5 w-3.5 mr-2" />
                  Clear Filters
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </div>
        
        {/* Desktop - Always visible */}
        <div className="hidden lg:block">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 w-full overflow-hidden min-w-0">
            <div className="grid grid-cols-5 gap-3 min-w-0">
              <div className="col-span-2 min-w-0">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full min-w-0"
                  />
                </div>
              </div>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="trade_show">Trade Show</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-row items-center gap-2">
              <Select value={salesExecutiveFilter} onValueChange={setSalesExecutiveFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Sales Executive" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales Executives</SelectItem>
                  {salesExecutives.map((exec) => {
                    const name = exec.first_name || exec.last_name
                      ? `${exec.first_name || ''} ${exec.last_name || ''}`.trim()
                      : exec.email;
                    return (
                      <SelectItem key={exec.id} value={exec.id}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={clearFilters} size="sm">
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Leads Table */}
      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-base sm:text-xl">All Leads ({leads.length})</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Manage leads from all sales executives</CardDescription>
        </CardHeader>
        <CardContent className="w-full min-w-0 p-0 overflow-hidden">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground px-3 sm:px-4 text-sm">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground px-3 sm:px-4 text-sm">No leads found</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-2.5 w-full min-w-0 px-3 sm:px-6 pb-4 overflow-hidden">
                {leads.map((lead) => (
                  <Card key={lead.id} className="p-3 w-full min-w-0 overflow-hidden">
                    <div className="space-y-2.5 min-w-0">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm mb-1 break-words">{lead.contact_name}</div>
                          {lead.company_name && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 min-w-0">
                              <Building2 className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{lead.company_name}</span>
                            </div>
                          )}
                          <div className="text-xs font-medium text-muted-foreground mb-2 break-words">{lead.title}</div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(lead)}
                            className="h-7 w-7 p-0"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(lead)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(lead.id)}
                            disabled={deleteMutation.isPending}
                            className="h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className={`${STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-800'} text-xs px-2 py-0.5`}>
                          {lead.stage}
                        </Badge>
                        <Badge className={`${PRIORITY_COLORS[lead.priority] || 'bg-gray-100 text-gray-800'} text-xs px-2 py-0.5`}>
                          {lead.priority}
                        </Badge>
                        {lead.estimated_value > 0 && (
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <DollarSign className="h-3 w-3 text-green-600" />
                            {formatCurrency(lead.estimated_value)}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 text-xs min-w-0">
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          <User className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{getSalesExecutiveName(lead)}</span>
                        </div>
                        {lead.contact_email && (
                          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate min-w-0 text-xs">{lead.contact_email}</span>
                          </div>
                        )}
                        {lead.contact_phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate text-xs">{lead.contact_phone}</span>
                          </div>
                        )}
                        {lead.next_follow_up && (
                          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                            <CalendarClock className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate text-xs">{format(new Date(lead.next_follow_up), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block w-full min-w-0">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2">Contact</TableHead>
                      <TableHead className="px-2">Company</TableHead>
                      <TableHead className="px-2">Title</TableHead>
                      <TableHead className="px-2">Sales Executive</TableHead>
                      <TableHead className="px-2">Stage</TableHead>
                      <TableHead className="px-2">Priority</TableHead>
                      <TableHead className="px-2">Value</TableHead>
                      <TableHead className="px-2">Next Follow-up</TableHead>
                      <TableHead className="text-right px-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="px-2 py-2">
                          <div className="space-y-1">
                            <div className="font-medium text-sm">{lead.contact_name}</div>
                            {lead.contact_email && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate">{lead.contact_email}</span>
                              </div>
                            )}
                            {lead.contact_phone && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span className="truncate">{lead.contact_phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          {lead.company_name ? (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="truncate text-sm">{lead.company_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-2 max-w-[150px]">
                          <div className="truncate text-sm" title={lead.title}>
                            {lead.title}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <div className="flex items-center gap-1 text-sm">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{getSalesExecutiveName(lead)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge className={STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-800'} variant="outline">
                            {lead.stage}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge className={PRIORITY_COLORS[lead.priority] || 'bg-gray-100 text-gray-800'} variant="outline">
                            {lead.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          {lead.estimated_value > 0 ? (
                            <div className="flex items-center gap-1 text-sm">
                              <DollarSign className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span className="truncate">{formatCurrency(lead.estimated_value)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          {lead.next_follow_up ? (
                            <div className="flex items-center gap-1 text-sm">
                              <CalendarClock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <span className="truncate">{format(new Date(lead.next_follow_up), 'MMM d, yyyy')}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right px-2 py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(lead)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(lead)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(lead.id)}
                              disabled={deleteMutation.isPending}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>View complete lead information</DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contact Name</label>
                  <p className="text-sm font-medium">{selectedLead.contact_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Company</label>
                  <p className="text-sm">{selectedLead.company_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{selectedLead.contact_email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-sm">{selectedLead.contact_phone || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sales Executive</label>
                  <p className="text-sm">{getSalesExecutiveName(selectedLead)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Title</label>
                  <p className="text-sm">{selectedLead.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stage</label>
                  <Badge className={STAGE_COLORS[selectedLead.stage] || 'bg-gray-100 text-gray-800'}>
                    {selectedLead.stage}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Priority</label>
                  <Badge className={PRIORITY_COLORS[selectedLead.priority] || 'bg-gray-100 text-gray-800'}>
                    {selectedLead.priority}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Estimated Value</label>
                  <p className="text-sm">{formatCurrency(selectedLead.estimated_value)} {selectedLead.currency}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Source</label>
                  <p className="text-sm capitalize">{selectedLead.source}</p>
                </div>
              </div>
              {selectedLead.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm mt-1">{selectedLead.description}</p>
                </div>
              )}
              {selectedLead.notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <pre className="text-sm whitespace-pre-wrap">{selectedLead.notes}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsViewDialogOpen(false);
              if (selectedLead) handleEdit(selectedLead);
            }}>
              Edit Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Create Lead</DialogTitle>
            <DialogDescription>Create a new lead and assign it to a sales executive</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="sales_executive_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Executive *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sales executive" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {salesExecutives.map((se) => (
                            <SelectItem key={se.id} value={se.id}>
                              {se.first_name || se.last_name
                                ? `${se.first_name || ''} ${se.last_name || ''}`.trim()
                                : se.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="contact_phone"
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
                <FormField
                  control={createForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
                          <SelectItem value="trade_show">Trade Show</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="estimated_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
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
                  control={createForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
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
                <FormField
                  control={createForm.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="expected_close_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Close Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="next_follow_up"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Follow-up</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Lead'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>Update lead information</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="contact_phone"
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
                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
                          <SelectItem value="trade_show">Trade Show</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="estimated_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="expected_close_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Close Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="next_follow_up"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Follow-up</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} placeholder="Add notes about this lead..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {editForm.watch('stage') === 'lost' && (
                <FormField
                  control={editForm.control}
                  name="lost_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lost Reason</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} placeholder="Why was this lead lost?" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedLead(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Lead'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
