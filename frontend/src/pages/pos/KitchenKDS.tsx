import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { warehousesService } from '@/api/warehouses';
import { kotApi, type KotTicketSummary } from '@/api/kot';

type SnapshotLine = {
  quantity: number;
  kitchen_display_name: string;
  modifiers_snapshot?: Array<{ name: string }>;
};

function parseSnapshot(raw: unknown): SnapshotLine[] {
  if (Array.isArray(raw)) return raw as SnapshotLine[];
  return [];
}

export default function KitchenKDS() {
  const { profile } = useAuth();
  const companyId = profile?.company_id as string | undefined;
  const queryClient = useQueryClient();
  const [outletId, setOutletId] = useState('');
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  useEffect(() => {
    if (!outletId && warehouses.length > 0) {
      setOutletId((warehouses[0] as { id: string }).id);
    }
  }, [warehouses, outletId]);

  const hydrateTickets = useCallback(async () => {
    if (!outletId) return [];
    return kotApi.listTickets({ outlet_id: outletId, status: 'active' });
  }, [outletId]);

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ['kot-kds-tickets', outletId],
    queryFn: hydrateTickets,
    enabled: !!outletId,
    refetchInterval: 120_000,
  });

  const debouncedRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      void refetch();
    }, 300);
  }, [refetch]);

  useEffect(() => {
    if (!companyId || !outletId) return;

    const channelName = `pos_kot_tickets-${companyId}-${outletId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pos_kot_tickets',
          filter: `outlet_id=eq.${outletId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['kot-kds-tickets', outletId] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          debouncedRefetch();
        }
      });

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [companyId, outletId, debouncedRefetch, queryClient]);

  const markServed = useMutation({
    mutationFn: (id: string) => kotApi.patchTicketStatus(id, 'served'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kot-kds-tickets', outletId] });
    },
    onError: () => toast.error('Could not update ticket'),
  });

  const sorted = useMemo(
    () =>
      [...tickets].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [tickets]
  );

  if (!companyId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <p className="text-slate-400">Sign in to open the kitchen display.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Monitor className="h-8 w-8 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Kitchen display</h1>
              <p className="text-slate-500 text-sm">Live tickets for this outlet (Realtime + refetch on reconnect)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              {(warehouses as { id: string; name: string }[]).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <Link
              to="/pos/kot-settings"
              className="text-sm text-indigo-400 hover:text-indigo-300 hidden sm:inline"
            >
              KOT setup
            </Link>
            <Link to="/pos" className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> POS
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
          </div>
        )}

        {!isLoading && sorted.length === 0 && (
          <div className="text-center py-24 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
            No open tickets for this outlet.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((t: KotTicketSummary) => {
            const lines = parseSnapshot(t.ticket_items_snapshot);
            return (
              <article
                key={t.id}
                className="rounded-2xl border border-amber-500/30 bg-slate-950/80 p-4 shadow-lg shadow-amber-900/10"
              >
                <header className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">KOT</p>
                    <p className="text-2xl font-black text-white">{t.kot_number_text}</p>
                  </div>
                  <span className="text-xs uppercase px-2 py-1 rounded bg-slate-800 text-slate-300">{t.status}</span>
                </header>
                <ul className="space-y-2 mb-4">
                  {lines.map((line, idx) => (
                    <li key={idx} className="text-lg font-medium border-b border-slate-800/80 pb-2">
                      <span className="text-amber-300 mr-2">{line.quantity}×</span>
                      {line.kitchen_display_name}
                      {(line.modifiers_snapshot ?? []).map((m, i) => (
                        <span key={i} className="block text-sm text-slate-400 font-normal pl-6">
                          + {m.name}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => markServed.mutate(t.id)}
                  disabled={markServed.isPending}
                  className="w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-40"
                >
                  Mark served
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
