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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
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
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  User,
  Briefcase,
  PhoneCall,
  CalendarClock,
  Trophy,
  MessageSquare,
  Bell,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { format } from 'date-fns';
import { toast } from 'sonner';
import { leadsService, Lead, CreateLeadInput, UpdateLeadInput, LeadStage, LeadPriority, LeadSource } from '@/api/leads';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const leadFormSchema = z.object({
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

const STAGE_COLORS: Record<LeadStage, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-purple-100 text-purple-800',
  qualified: 'bg-yellow-100 text-yellow-800',
  proposal: 'bg-orange-100 text-orange-800',
  negotiation: 'bg-indigo-100 text-indigo-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

const PRIORITY_COLORS: Record<LeadPriority, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const PRIORITY_ICONS: Record<LeadPriority, React.ReactNode> = {
  low: <Clock className="h-3 w-3" />,
  medium: <Target className="h-3 w-3" />,
  high: <AlertCircle className="h-3 w-3" />,
  urgent: <AlertCircle className="h-3 w-3" />,
};

export default function Leads() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLogCallDialogOpen, setIsLogCallDialogOpen] = useState(false);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [quickActionNote, setQuickActionNote] = useState("");
  const [quickActionNextFollowUp, setQuickActionNextFollowUp] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch leads with filters
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', stageFilter, priorityFilter, sourceFilter, searchQuery],
    queryFn: () => leadsService.getLeads({
      ...(stageFilter !== 'all' && { stage: stageFilter }),
      ...(priorityFilter !== 'all' && { priority: priorityFilter }),
      ...(sourceFilter !== 'all' && { source: sourceFilter }),
      ...(searchQuery && { search: searchQuery }),
    }),
  });

  // Fetch lead stats
  const { data: stats } = useQuery({
    queryKey: ['leadStats'],
    queryFn: () => leadsService.getLeadStats(),
  });

  // Fetch follow-up reminders
  const { data: followUpReminders = [] } = useQuery({
    queryKey: ['followUpReminders'],
    queryFn: () => leadsService.getFollowUpReminders(),
  });

  // Fetch aging leads
  const { data: agingLeads = [] } = useQuery({
    queryKey: ['agingLeads'],
    queryFn: () => leadsService.getAgingLeads(7), // 7 days threshold
  });

  // Create form
  const createForm = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      company_name: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      contact_position: '',
      title: '',
      description: '',
      source: 'other',
      estimated_value: 0,
      currency: 'USD',
      stage: 'new',
      priority: 'medium',
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      website: '',
      notes: '',
      expected_close_date: '',
    },
  });

  // Edit form
  const editForm = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateLeadInput) => leadsService.createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leadStats'] });
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
    mutationFn: ({ id, data }: { id: string; data: UpdateLeadInput }) =>
      leadsService.updateLead(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leadStats'] });
      setIsEditDialogOpen(false);
      setSelectedLead(null);
      toast.success('Lead updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update lead');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadsService.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leadStats'] });
      toast.success('Lead deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete lead');
    },
  });

  // Log call mutation
  const logCallMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => leadsService.logCall(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leadStats'] });
      setIsLogCallDialogOpen(false);
      setQuickActionNote('');
      setSelectedLead(null);
      toast.success('Call logged successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to log call');
    },
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: ({ id, next_follow_up }: { id: string; next_follow_up: string }) =>
      leadsService.rescheduleFollowUp(id, next_follow_up),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leadStats'] });
      setIsRescheduleDialogOpen(false);
      setQuickActionNextFollowUp('');
      setSelectedLead(null);
      toast.success('Follow-up rescheduled successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reschedule follow-up');
    },
  });

  // Mark as won mutation
  const markAsWonMutation = useMutation({
    mutationFn: (id: string) => leadsService.markAsWon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leadStats'] });
      toast.success('Lead marked as won!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to mark lead as won');
    },
  });

  const handleCreate = (values: LeadFormValues) => {
    createMutation.mutate({
      contact_name: values.contact_name,
      title: values.title,
      company_name: values.company_name || undefined,
      contact_email: values.contact_email || undefined,
      contact_phone: values.contact_phone || undefined,
      contact_position: values.contact_position || undefined,
      description: values.description || undefined,
      source: values.source,
      estimated_value: values.estimated_value || 0,
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
    });
  };

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    editForm.reset({
      company_name: lead.company_name || '',
      contact_name: lead.contact_name,
      contact_email: lead.contact_email || '',
      contact_phone: lead.contact_phone || '',
      contact_position: lead.contact_position || '',
      title: lead.title,
      description: lead.description || '',
      source: lead.source,
      estimated_value: lead.estimated_value,
      currency: lead.currency,
      stage: lead.stage,
      priority: lead.priority,
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

  const handleUpdate = (values: LeadFormValues) => {
    if (!selectedLead) return;
    updateMutation.mutate({
      id: selectedLead.id,
      data: {
        ...values,
        estimated_value: values.estimated_value || 0,
        contact_email: values.contact_email || undefined,
        website: values.website || undefined,
        last_follow_up: values.last_follow_up || undefined,
        next_follow_up: values.next_follow_up || undefined,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleLogCall = (lead: Lead) => {
    setSelectedLead(lead);
    setQuickActionNote('');
    setIsLogCallDialogOpen(true);
  };

  const handleReschedule = (lead: Lead) => {
    setSelectedLead(lead);
    setQuickActionNextFollowUp(lead.next_follow_up ? new Date(lead.next_follow_up).toISOString().slice(0, 16) : '');
    setIsRescheduleDialogOpen(true);
  };

  const handleMarkAsWon = (lead: Lead) => {
    if (window.confirm(`Mark "${lead.title}" as won?`)) {
      markAsWonMutation.mutate(lead.id);
    }
  };

  const submitLogCall = () => {
    if (!selectedLead) return;
    logCallMutation.mutate({
      id: selectedLead.id,
      note: quickActionNote.trim() || undefined,
    });
  };

  const submitReschedule = () => {
    if (!selectedLead || !quickActionNextFollowUp) {
      toast.error('Please select a follow-up date');
      return;
    }
    rescheduleMutation.mutate({
      id: selectedLead.id,
      next_follow_up: new Date(quickActionNextFollowUp).toISOString(),
    });
  };

  const clearFilters = () => {
    setStageFilter('all');
    setPriorityFilter('all');
    setSourceFilter('all');
    setSearchQuery('');
  };

  const filteredLeads = leads;

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 lg:px-6 py-3 sm:py-6 space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">Lead Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">Manage and track your sales leads</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto text-sm sm:text-base">
          <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
          Create Lead
        </Button>
      </div>

      {/* Alerts and Reminders */}
      {(followUpReminders.length > 0 || agingLeads.length > 0) && (
        <div className="space-y-3 sm:space-y-4">
          {/* Follow-Up Reminders */}
          {followUpReminders.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <Bell className="h-5 w-5" />
                  Follow-Up Reminders ({followUpReminders.length})
                </CardTitle>
                <CardDescription className="text-orange-700">
                  Leads with follow-ups due today or overdue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {followUpReminders.slice(0, 5).map((lead) => {
                    const followUpDate = lead.next_follow_up ? new Date(lead.next_follow_up) : null;
                    const isOverdue = followUpDate && followUpDate < new Date();
                    return (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200 hover:border-orange-300 cursor-pointer"
                        onClick={() => handleEdit(lead)}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{lead.contact_name}</div>
                          <div className="text-sm text-muted-foreground">{lead.title}</div>
                          {followUpDate && (
                            <div className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                              {isOverdue ? 'Overdue: ' : 'Due: '}
                              {format(followUpDate, 'MMM d, yyyy HH:mm')}
                            </div>
                          )}
                        </div>
                        <Badge className={STAGE_COLORS[lead.stage]}>
                          {lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1)}
                        </Badge>
                      </div>
                    );
                  })}
                  {followUpReminders.length > 5 && (
                    <div className="text-sm text-muted-foreground text-center pt-2">
                      +{followUpReminders.length - 5} more leads need follow-up
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lead Aging Alerts */}
          {agingLeads.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  Lead Aging Alerts ({agingLeads.length})
                </CardTitle>
                <CardDescription className="text-red-700">
                  Leads that have been in the same stage for more than 7 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {agingLeads.slice(0, 5).map((lead: Lead & { days_in_stage: number }) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200 hover:border-red-300 cursor-pointer"
                      onClick={() => handleEdit(lead)}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{lead.contact_name}</div>
                        <div className="text-sm text-muted-foreground">{lead.title}</div>
                        <div className="text-xs text-red-600 font-medium mt-1">
                          {lead.days_in_stage} days in {lead.stage} stage
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={STAGE_COLORS[lead.stage]}>
                          {lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1)}
                        </Badge>
                        <Badge variant="outline" className="text-red-600 border-red-300">
                          {lead.days_in_stage}d
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {agingLeads.length > 5 && (
                    <div className="text-sm text-muted-foreground text-center pt-2">
                      +{agingLeads.length - 5} more leads need attention
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Won Value</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${stats.wonValue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.total - (stats.byStage['won'] || 0) - (stats.byStage['lost'] || 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                  Filters
                  {(stageFilter !== 'all' || priorityFilter !== 'all' || sourceFilter !== 'all' || searchQuery) && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isFiltersOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="lg:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search leads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={stageFilter} onValueChange={(value) => setStageFilter(value as LeadStage | "all")}>
                  <SelectTrigger>
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
                <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as LeadPriority | "all")}>
                  <SelectTrigger>
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
                <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as LeadSource | "all")}>
                  <SelectTrigger>
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
                {(stageFilter !== 'all' || priorityFilter !== 'all' || sourceFilter !== 'all' || searchQuery) && (
                  <Button variant="outline" onClick={clearFilters} className="w-full text-sm sm:text-base">
                    <X className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Leads Table */}
      <Card>
        <CardHeader className="px-3 sm:px-6 pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">Leads ({filteredLeads.length})</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Manage your sales pipeline</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          {isLoading ? (
            <div className="text-center py-8">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leads found. Create your first lead to get started.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {filteredLeads.map((lead) => (
                  <Card key={lead.id} className="w-full min-w-0 overflow-hidden">
                    <CardContent className="px-3 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <h3 className="font-medium text-sm break-words">{lead.contact_name}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Mail className="h-3 w-3" />
                            <span className="break-words">{lead.contact_email || 'No email'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <Phone className="h-3 w-3" />
                            <span>{lead.contact_phone || 'No phone'}</span>
                          </div>
                          {lead.company_name && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              <span className="break-words">{lead.company_name}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Badge className={STAGE_COLORS[lead.stage]}>
                            {lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1)}
                          </Badge>
                          <Badge className={PRIORITY_COLORS[lead.priority]} variant="outline">
                            <span className="flex items-center gap-1">
                              {PRIORITY_ICONS[lead.priority]}
                              {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
                            </span>
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Title</p>
                          <p className="font-medium text-sm break-words">{lead.title}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Source</p>
                          <p className="font-medium text-sm capitalize">{lead.source.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Value</p>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-sm">{lead.estimated_value.toLocaleString()}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Expected Close</p>
                          {lead.expected_close_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium text-sm">{format(new Date(lead.expected_close_date), 'MMM d, yyyy')}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>

                      {lead.next_follow_up && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 text-xs">
                            <CalendarClock className={`h-3.5 w-3.5 ${new Date(lead.next_follow_up) < new Date() ? 'text-red-600' : 'text-blue-600'}`} />
                            <span className={`font-medium ${new Date(lead.next_follow_up) < new Date() ? 'text-red-600' : 'text-blue-600'}`}>
                              Follow-up: {format(new Date(lead.next_follow_up), 'MMM d, yyyy HH:mm')}
                              {new Date(lead.next_follow_up) < new Date() && ' (Overdue)'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-1 flex-wrap">
                          {lead.stage !== 'won' && lead.stage !== 'lost' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLogCall(lead)}
                                className="h-7 text-xs"
                                title="Log Call"
                              >
                                <PhoneCall className="h-3 w-3 mr-1" />
                                Call
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReschedule(lead)}
                                className="h-7 text-xs"
                                title="Reschedule"
                              >
                                <CalendarClock className="h-3 w-3 mr-1" />
                                Schedule
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkAsWon(lead)}
                                className="h-7 text-xs text-green-600 hover:text-green-700"
                                title="Mark as Won"
                              >
                                <Trophy className="h-3 w-3 mr-1" />
                                Won
                              </Button>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(lead)}
                            className="h-8 w-8"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(lead.id)}
                            className="h-8 w-8 text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredLeads.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">No leads found</div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-md border w-full min-w-0 overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3 py-3 min-w-[200px]">Contact</TableHead>
                      <TableHead className="px-3 py-3 min-w-[150px]">Company</TableHead>
                      <TableHead className="px-3 py-3 min-w-[180px]">Title</TableHead>
                      <TableHead className="px-3 py-3 w-24">Stage</TableHead>
                      <TableHead className="px-3 py-3 w-24">Priority</TableHead>
                      <TableHead className="px-3 py-3 w-28">Source</TableHead>
                      <TableHead className="px-3 py-3 w-28">Value</TableHead>
                      <TableHead className="px-3 py-3 w-32">Expected Close</TableHead>
                      <TableHead className="px-3 py-3 w-32">Next Follow-up</TableHead>
                      <TableHead className="px-3 py-3 w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="px-3 py-3">
                          <div className="space-y-1">
                            <div className="font-medium flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {lead.contact_name}
                            </div>
                            {lead.contact_email && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {lead.contact_email}
                              </div>
                            )}
                            {lead.contact_phone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {lead.contact_phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          {lead.company_name ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{lead.company_name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="text-sm max-w-[160px] break-words" title={lead.title}>
                            {lead.title}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <Badge className={STAGE_COLORS[lead.stage]}>
                            {lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <Badge className={PRIORITY_COLORS[lead.priority]} variant="outline">
                            <span className="flex items-center gap-1">
                              {PRIORITY_ICONS[lead.priority]}
                              {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <span className="text-sm capitalize">{lead.source.replace('_', ' ')}</span>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="flex items-center gap-1 font-medium text-sm">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            {lead.estimated_value.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          {lead.expected_close_date ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(lead.expected_close_date), 'MMM d, yyyy')}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          {lead.next_follow_up ? (
                            <div className="flex items-center gap-1 text-sm">
                              <CalendarClock className={`h-4 w-4 ${new Date(lead.next_follow_up) < new Date() ? 'text-red-600' : 'text-blue-600'}`} />
                              <span className={new Date(lead.next_follow_up) < new Date() ? 'text-red-600 font-medium' : ''}>
                                {format(new Date(lead.next_follow_up), 'MMM d, yyyy HH:mm')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                          {lead.last_follow_up && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Last: {format(new Date(lead.last_follow_up), 'MMM d, yyyy')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="flex flex-col items-start gap-2">
                            {/* Quick Actions */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {lead.stage !== 'won' && lead.stage !== 'lost' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleLogCall(lead)}
                                    className="h-7 text-xs"
                                    title="Log Call"
                                  >
                                    <PhoneCall className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">Call</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReschedule(lead)}
                                    className="h-7 text-xs"
                                    title="Reschedule"
                                  >
                                    <CalendarClock className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">Schedule</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMarkAsWon(lead)}
                                    className="h-7 text-xs text-green-600 hover:text-green-700"
                                    title="Mark as Won"
                                  >
                                    <Trophy className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">Won</span>
                                  </Button>
                                </>
                              )}
                            </div>
                            {/* Edit/Delete */}
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(lead)}
                                className="h-8 w-8"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(lead.id)}
                                className="h-8 w-8 text-destructive"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Lead Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
            <DialogDescription>Add a new lead to your pipeline</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
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
                        <Input placeholder="Product Inquiry" {...field} />
                      </FormControl>
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
                        <Input placeholder="ABC Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="contact_position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position</FormLabel>
                      <FormControl>
                        <Input placeholder="Manager" {...field} />
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
                        <Input type="email" placeholder="john@example.com" {...field} />
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
                        <Input placeholder="+1234567890" {...field} />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
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
                          placeholder="0.00"
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
                  name="expected_close_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Close Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                        <Input placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Lead description..." {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
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
                        <Input placeholder="City" {...field} />
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
                        <Input placeholder="State" {...field} />
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
                        <Input placeholder="Country" {...field} />
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
                        <Input placeholder="12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                  <FormItem>
                    <FormLabel>Initial Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Initial notes..." {...field} rows={3} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      You can add more notes later using the "Log Call" button
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
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

      {/* Edit Lead Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>Update lead information</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
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
                        <Input placeholder="Product Inquiry" {...field} />
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
                        <Input placeholder="ABC Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="contact_position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position</FormLabel>
                      <FormControl>
                        <Input placeholder="Manager" {...field} />
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
                        <Input type="email" placeholder="john@example.com" {...field} />
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
                        <Input placeholder="+1234567890" {...field} />
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
                            <SelectValue placeholder="Select source" />
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
                            <SelectValue placeholder="Select stage" />
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
                            <SelectValue placeholder="Select priority" />
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
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          value={field.value || ''}
                        />
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
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
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
                      <Textarea placeholder="Lead description..." {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="State" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="last_follow_up"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Follow-up</FormLabel>
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
              {editForm.watch('stage') === 'lost' && (
                <FormField
                  control={editForm.control}
                  name="lost_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lost Reason</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Reason for losing this lead..." {...field} rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Notes (use 'Log Call' button to append timestamped notes)..." 
                        {...field} 
                        rows={5}
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Notes are appended with timestamps. Use "Log Call" button to add new entries.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
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

      {/* Log Call Dialog */}
      <Dialog open={isLogCallDialogOpen} onOpenChange={setIsLogCallDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Log Call
            </DialogTitle>
            <DialogDescription>
              {selectedLead && `Log a call for ${selectedLead.contact_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Call Notes (Optional)</label>
              <Textarea
                placeholder="Enter call notes... (e.g., Customer asked for a 5% discount. Will check with manager.)"
                value={quickActionNote}
                onChange={(e) => setQuickActionNote(e.target.value)}
                rows={4}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This note will be appended with a timestamp
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLogCallDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitLogCall} disabled={logCallMutation.isPending}>
              {logCallMutation.isPending ? 'Logging...' : 'Log Call'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Reschedule Follow-up
            </DialogTitle>
            <DialogDescription>
              {selectedLead && `Set next follow-up date for ${selectedLead.contact_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Next Follow-up Date *</label>
              <Input
                type="datetime-local"
                value={quickActionNextFollowUp}
                onChange={(e) => setQuickActionNextFollowUp(e.target.value)}
                className="mt-2"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReschedule} disabled={rescheduleMutation.isPending}>
              {rescheduleMutation.isPending ? 'Saving...' : 'Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
