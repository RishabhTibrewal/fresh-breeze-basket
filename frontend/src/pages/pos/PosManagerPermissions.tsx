import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Store, 
  Plus, 
  Trash2, 
  Loader2, 
  ChevronLeft, 
  ShieldAlert, 
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { warehousesService } from '@/api/warehouses';
import { adminService } from '@/api/admin';
import { posManagersService } from '@/api/posManagers';

export default function PosManagerPermissions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // State for assignment form
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  // Check roles (Admins and Accounts are allowed to manage assignments)
  const userRoles = profile?.roles || [];
  const hasPermission = userRoles.includes('admin') || profile?.role === 'admin' || userRoles.includes('accounts');

  // --- Data Fetching ---

  // 1. Fetch all assignments
  const { data: assignments = [], isLoading: isAssignmentsLoading } = useQuery({
    queryKey: ['pos-manager-assignments'],
    queryFn: () => posManagersService.getAllPosManagers(),
    enabled: hasPermission
  });

  // 2. Fetch all warehouses (outlets)
  const { data: outlets = [], isLoading: isOutletsLoading } = useQuery({
    queryKey: ['warehouses-active'],
    queryFn: () => warehousesService.getAll(true),
    enabled: hasPermission
  });

  // 3. Fetch all company users to find POS managers
  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: () => adminService.getUsers(1, 200), // Get first 200 users
    enabled: hasPermission
  });

  // Filter users to get only those with the 'pos_manager' role
  const posManagers = (usersData?.data?.users || []).filter(user => 
    (user.roles || []).includes('pos_manager')
  );

  // --- Mutations ---

  // Create Assignment
  const createAssignmentMutation = useMutation({
    mutationFn: () => posManagersService.assignPosManager(selectedUserId, selectedWarehouseId),
    onSuccess: () => {
      toast.success('Outlet assigned to POS Manager successfully');
      setSelectedWarehouseId('');
      queryClient.invalidateQueries({ queryKey: ['pos-manager-assignments'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to assign outlet');
    }
  });

  // Delete Assignment
  const deleteAssignmentMutation = useMutation({
    mutationFn: ({ userId, warehouseId }: { userId: string, warehouseId: string }) => 
      posManagersService.removePosManager(userId, warehouseId),
    onSuccess: () => {
      toast.success('Outlet assignment removed successfully');
      queryClient.invalidateQueries({ queryKey: ['pos-manager-assignments'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to remove assignment');
    }
  });

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Please select a POS Manager');
      return;
    }
    if (!selectedWarehouseId) {
      toast.error('Please select an Outlet');
      return;
    }
    
    // Check if already assigned
    const exists = assignments.some(
      a => a.user_id === selectedUserId && a.warehouse_id === selectedWarehouseId
    );
    if (exists) {
      toast.error('This POS manager is already assigned to this outlet');
      return;
    }

    createAssignmentMutation.mutate();
  };

  const handleRemove = (userId: string, warehouseId: string) => {
    if (window.confirm('Are you sure you want to remove this outlet assignment?')) {
      deleteAssignmentMutation.mutate({ userId, warehouseId });
    }
  };

  // --- Access Denied view ---
  if (!hasPermission) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6 text-white">
        <div className="bg-[#1a1d27] border border-red-500/20 p-8 rounded-3xl max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-red-500/10 p-4 rounded-full border border-red-500/25">
              <ShieldAlert className="h-10 w-10 text-red-500" />
            </div>
          </div>
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-gray-400 text-sm">
            Only administrators or accounts personnel are authorized to configure POS Manager outlet permissions.
          </p>
          <button
            onClick={() => navigate('/pos')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back to POS
          </button>
        </div>
      </div>
    );
  }

  const isLoading = isAssignmentsLoading || isOutletsLoading || isUsersLoading;

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
      {/* HEADER */}
      <header className="border-b border-white/5 bg-[#12151f] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pos')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            title="Back to POS"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-indigo-400" /> POS Manager Outlets
            </h1>
            <p className="text-xs text-gray-500">Configure which outlets each POS manager can access</p>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ASSIGNMENT FORM */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl space-y-5">
            <div className="space-y-1">
              <h2 className="text-md font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-400" /> New Assignment
              </h2>
              <p className="text-xs text-gray-400">Map a POS manager to their allowed outlet</p>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              {/* POS MANAGER SELECT */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  POS Manager
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-[#12151f] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-white"
                  required
                >
                  <option value="">Select POS Manager...</option>
                  {posManagers.map(manager => (
                    <option key={manager.id} value={manager.id}>
                      {manager.first_name ? `${manager.first_name} ${manager.last_name || ''}`.trim() : manager.email}
                    </option>
                  ))}
                </select>
                {posManagers.length === 0 && !isLoading && (
                  <p className="text-[11px] text-amber-400/80">
                    No users with "pos_manager" role found. Configure roles in User Role Management first.
                  </p>
                )}
              </div>

              {/* OUTLET SELECT */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Outlet (Warehouse)
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full bg-[#12151f] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-white"
                  required
                >
                  <option value="">Select Outlet...</option>
                  {outlets.map(outlet => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name} ({outlet.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={createAssignmentMutation.isPending}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {createAssignmentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Assigning...
                  </>
                ) : (
                  <>
                    Assign Permission <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ASSIGNMENT TABLE */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#1a1d27] border border-white/10 rounded-3xl p-6 overflow-hidden">
            <h2 className="text-md font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" /> Active Assignments ({assignments.length})
            </h2>

            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                <span className="text-sm text-gray-400">Loading assignments and catalogs...</span>
              </div>
            ) : assignments.length === 0 ? (
              <div className="border border-dashed border-white/5 rounded-2xl py-16 text-center">
                <Users className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-300">No Assignments</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1">
                  POS managers currently have access to no outlets. Set assignments on the left panel to grant permissions.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="pb-3 pl-2">POS Manager</th>
                      <th className="pb-3">Outlet (Warehouse)</th>
                      <th className="pb-3 text-right pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(assignment => {
                      const managerName = assignment.profiles 
                        ? `${assignment.profiles.first_name || ''} ${assignment.profiles.last_name || ''}`.trim() || assignment.profiles.email
                        : 'Unknown User';
                      const managerEmail = assignment.profiles?.email;
                      const outletName = assignment.warehouses?.name || 'Unknown Outlet';
                      const outletCode = assignment.warehouses?.code;

                      return (
                        <tr 
                          key={assignment.id} 
                          className="border-b border-white/5 last:border-b-0 text-sm hover:bg-white/5 transition-colors"
                        >
                          <td className="py-4 pl-2">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/25">
                                <Users className="h-4 w-4 text-indigo-400" />
                              </div>
                              <div>
                                <span className="font-semibold text-white block">{managerName}</span>
                                {managerEmail && (
                                  <span className="text-[10px] text-gray-500 block">{managerEmail}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <Store className="h-4 w-4 text-gray-400" />
                              <div>
                                <span className="font-medium text-white block">{outletName}</span>
                                {outletCode && (
                                  <span className="text-[10px] text-gray-500 block">Code: {outletCode}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-right pr-2">
                            <button
                              onClick={() => handleRemove(assignment.user_id, assignment.warehouse_id)}
                              disabled={deleteAssignmentMutation.isPending}
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-500 border border-red-500/25 hover:border-red-500/50 transition-all"
                              title="Revoke Permission"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
