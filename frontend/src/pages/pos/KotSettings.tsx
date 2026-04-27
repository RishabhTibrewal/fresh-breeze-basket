import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { warehousesService } from '@/api/warehouses';
import { kotApi, type PosFoodCounter, type PosKotSettings } from '@/api/kot';

export default function KotSettings() {
  const queryClient = useQueryClient();
  const [outletId, setOutletId] = useState<string>('');

  const { data: warehouses = [], isLoading: whLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  useEffect(() => {
    if (!outletId && warehouses.length > 0) {
      setOutletId((warehouses[0] as { id: string }).id);
    }
  }, [warehouses, outletId]);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['kot-settings', outletId],
    queryFn: () => kotApi.getSettings(outletId),
    enabled: !!outletId,
  });

  const { data: counters = [], isLoading: countersLoading } = useQuery({
    queryKey: ['kot-counters', outletId],
    queryFn: () => kotApi.listCounters(outletId),
    enabled: !!outletId,
  });

  const { data: mappings = [], isLoading: mapLoading } = useQuery({
    queryKey: ['kot-mappings', outletId],
    queryFn: () => kotApi.listProductMappings(outletId),
    enabled: !!outletId,
  });

  const [draft, setDraft] = useState<Partial<PosKotSettings>>({});
  useEffect(() => {
    if (settings) {
      setDraft({
        reset_frequency: settings.reset_frequency,
        timezone: settings.timezone,
        number_prefix: settings.number_prefix,
        default_counter_id: settings.default_counter_id,
      });
    } else {
      setDraft({
        reset_frequency: 'daily',
        timezone: 'Asia/Kolkata',
        number_prefix: 'KOT',
        default_counter_id: counters[0]?.id,
      });
    }
  }, [settings, counters]);

  const [newCounter, setNewCounter] = useState({ name: '', code: '' });
  const [productSearch, setProductSearch] = useState('');

  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      kotApi.saveSettings({
        outlet_id: outletId,
        reset_frequency: draft.reset_frequency,
        timezone: draft.timezone,
        number_prefix: draft.number_prefix,
        default_counter_id: draft.default_counter_id || '',
      }),
    onSuccess: () => {
      toast.success('KOT settings saved');
      queryClient.invalidateQueries({ queryKey: ['kot-settings', outletId] });
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e.response?.data?.error?.message || 'Save failed'),
  });

  const createCounterMutation = useMutation({
    mutationFn: () =>
      kotApi.createCounter({
        outlet_id: outletId,
        name: newCounter.name.trim(),
        code: newCounter.code.trim(),
      }),
    onSuccess: () => {
      toast.success('Counter added');
      setNewCounter({ name: '', code: '' });
      queryClient.invalidateQueries({ queryKey: ['kot-counters', outletId] });
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e.response?.data?.error?.message || 'Failed to add counter'),
  });

  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const row of mappings) {
      next[row.product_id] = row.counter_id;
    }
    setMappingDraft(next);
  }, [mappings, outletId]);

  const saveAllMappingsMutation = useMutation({
    mutationFn: async () => {
      const currentByProduct = new Map<string, string>();
      for (const row of mappings) {
        currentByProduct.set(row.product_id, row.counter_id);
      }

      const productIds = new Set<string>([
        ...Object.keys(mappingDraft),
        ...Array.from(currentByProduct.keys()),
      ]);

      const jobs: Promise<void>[] = [];
      for (const productId of productIds) {
        const current = currentByProduct.get(productId) ?? '';
        const next = mappingDraft[productId] ?? '';
        if (next === current) continue;

        if (next === '') {
          if (current) jobs.push(kotApi.clearProductMapping(productId))
        } else {
          jobs.push(kotApi.setProductMapping(productId, next))
        }
      }

      await Promise.all(jobs);
      return jobs.length;
    },
    onSuccess: (changedCount: number) => {
      if (changedCount > 0) {
        toast.success(`Saved ${changedCount} product mapping change${changedCount > 1 ? 's' : ''}`);
      } else {
        toast.info('No mapping changes to save');
      }
      queryClient.invalidateQueries({ queryKey: ['kot-mappings', outletId] });
    },
    onError: (e: { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e.response?.data?.error?.message || 'Failed to save mapping changes'),
  });

  const { data: productList = [] } = useQuery({
    queryKey: ['kot-products-flat'],
    queryFn: async () => {
      const res = await apiClient.get('/products', { params: { limit: 200, page: 1, include: true } });
      const rows = res.data?.data ?? res.data ?? [];
      return Array.isArray(rows) ? rows : [];
    },
  });

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const all = productList as { id: string; name: string }[];
    if (q.length < 1) return all;
    return all.filter((p) => p.name?.toLowerCase().includes(q)).slice(0, 200);
  }, [productList, productSearch]);

  const counterByProductId = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of mappings) {
      m.set(row.product_id, row.counter_id);
    }
    return m;
  }, [mappings]);

  const loading = whLoading || !outletId;

  const unmappedWarning = useMemo(() => {
    return counters.length > 0
      ? 'Products without an explicit counter use the default station. Pick a station per product below, then click Save changes.'
      : 'Add at least one food counter before assigning products.';
  }, [counters.length]);

  const hasPendingMappingChanges = useMemo(() => {
    const currentByProduct = new Map<string, string>();
    for (const row of mappings) {
      currentByProduct.set(row.product_id, row.counter_id);
    }

    const productIds = new Set<string>([
      ...Object.keys(mappingDraft),
      ...Array.from(currentByProduct.keys()),
    ]);

    for (const productId of productIds) {
      const current = currentByProduct.get(productId) ?? '';
      const next = mappingDraft[productId] ?? '';
      if (current !== next) return true;
    }
    return false;
  }, [mappingDraft, mappings]);

  const handleCounterCellChange = (productId: string, newCounterId: string) => {
    setMappingDraft((prev) => ({ ...prev, [productId]: newCounterId }));
  };

  const fieldClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30';
  const selectClass = `${fieldClass} appearance-none cursor-pointer`;
  const optionClass = 'bg-[#1a1d27] text-white';

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0f1117] text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-[#0f1117] text-white font-sans [color-scheme:dark]"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 pb-12">
          <div className="flex items-center gap-4 mb-8">
            <Link
              to="/pos"
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2 text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" /> Back to POS
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">KOT & kitchen stations</h1>
          <p className="text-gray-500 text-sm mb-8">
            Create a food counter, set it as the default for this outlet, then optionally map products to specific stations.
          </p>

          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Outlet</label>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className={`${selectClass} mb-8`}
          >
            {(warehouses as { id: string; name: string }[]).map((w) => (
              <option key={w.id} value={w.id} className={optionClass}>
                {w.name}
              </option>
            ))}
          </select>

          <section className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl mb-6">
            <h2 className="text-lg font-bold mb-4 text-white">Food counters</h2>
            {countersLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            ) : (
              <ul className="space-y-2 mb-4">
                {counters.map((c: PosFoodCounter) => (
                  <li
                    key={c.id}
                    className="flex justify-between items-center text-sm border border-white/10 rounded-xl px-3 py-2.5 bg-white/5"
                  >
                    <span>
                      <span className="font-medium text-white">{c.name}</span>{' '}
                      <span className="text-gray-500">({c.code})</span>
                    </span>
                    {!c.is_active && <span className="text-amber-400 text-xs font-semibold">inactive</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 flex-wrap">
              <input
                placeholder="Name (e.g. Grill)"
                value={newCounter.name}
                onChange={(e) => setNewCounter((s) => ({ ...s, name: e.target.value }))}
                className={`flex-1 min-w-[120px] ${fieldClass}`}
              />
              <input
                placeholder="Code (e.g. GRILL)"
                value={newCounter.code}
                onChange={(e) => setNewCounter((s) => ({ ...s, code: e.target.value }))}
                className={`flex-1 min-w-[100px] ${fieldClass}`}
              />
              <button
                type="button"
                onClick={() => createCounterMutation.mutate()}
                disabled={!newCounter.name.trim() || !newCounter.code.trim()}
                className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </section>

          <section className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl mb-6">
            <h2 className="text-lg font-bold mb-4 text-white">KOT numbering</h2>
            {settingsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Default counter (required for POS)</label>
                  <select
                    value={draft.default_counter_id || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, default_counter_id: e.target.value }))}
                    className={`${selectClass} mt-1.5`}
                  >
                    <option value="" className={optionClass}>
                      — select —
                    </option>
                    {counters.map((c: PosFoodCounter) => (
                      <option key={c.id} value={c.id} className={optionClass}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Reset</label>
                    <select
                      value={draft.reset_frequency || 'daily'}
                      onChange={(e) => setDraft((d) => ({ ...d, reset_frequency: e.target.value }))}
                      className={`${selectClass} mt-1.5`}
                    >
                      {['daily', 'weekly', 'monthly', 'yearly', 'never'].map((f) => (
                        <option key={f} value={f} className={optionClass}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Timezone</label>
                    <input
                      value={draft.timezone || ''}
                      onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}
                      className={`${fieldClass} mt-1.5`}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide">Number prefix</label>
                  <input
                    value={draft.number_prefix || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, number_prefix: e.target.value }))}
                    className={`${fieldClass} mt-1.5`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={!draft.default_counter_id || saveSettingsMutation.isPending}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2.5 rounded-xl text-sm font-semibold mt-1"
                >
                  <Save className="h-4 w-4" /> Save settings
                </button>
              </div>
            )}
          </section>

          <section className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
            <h2 className="text-lg font-bold mb-2 text-white">Product → counter overrides</h2>
            <p className="text-gray-500 text-xs mb-4">{unmappedWarning}</p>

            <input
              placeholder="Filter products by name (empty = show all loaded products)"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className={`${fieldClass} mb-4`}
            />

            {mapLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center border border-dashed border-white/10 rounded-xl">
                No products loaded. Check your catalog or try again.
              </p>
            ) : (
              <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                <div className="max-h-[min(520px,55vh)] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[480px]">
                    <thead className="sticky top-0 z-10 bg-[#14161c] border-b border-white/10">
                      <tr>
                        <th className="text-left font-semibold text-gray-400 uppercase tracking-wide text-[11px] px-4 py-3 w-[55%]">
                          Product
                        </th>
                        <th className="text-left font-semibold text-gray-400 uppercase tracking-wide text-[11px] px-4 py-3 w-[40%]">
                          Counter station
                        </th>
                        <th className="text-center font-semibold text-gray-400 uppercase tracking-wide text-[11px] px-2 py-3 w-[5%]">
                          {/* clear */}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredProducts.map((p) => {
                        const mappedId = counterByProductId.get(p.id) ?? '';
                        return (
                          <tr key={p.id} className="hover:bg-white/[0.03]">
                            <td className="px-4 py-2.5 align-middle">
                              <span className="text-gray-100 font-medium line-clamp-2">{p.name}</span>
                            </td>
                            <td className="px-4 py-2 align-middle">
                              <select
                                value={mappingDraft[p.id] ?? mappedId}
                                onChange={(e) => handleCounterCellChange(p.id, e.target.value)}
                                disabled={counters.length === 0 || saveAllMappingsMutation.isPending}
                                className={`${selectClass} py-2 text-xs sm:text-sm`}
                                aria-label={`Counter for ${p.name}`}
                              >
                                <option value="" className={optionClass}>
                                  Default (no override)
                                </option>
                                {counters.map((c: PosFoodCounter) => (
                                  <option key={c.id} value={c.id} className={optionClass}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2 align-middle text-center">
                              {(mappingDraft[p.id] ?? mappedId) ? (
                                <button
                                  type="button"
                                  onClick={() => handleCounterCellChange(p.id, '')}
                                  disabled={saveAllMappingsMutation.isPending}
                                  className="inline-flex p-2 rounded-lg text-red-400/90 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                                  title="Clear override"
                                  aria-label={`Clear counter override for ${p.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="inline-block w-9" aria-hidden />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-white/5 bg-[#14161c]">
                  <p className="text-[11px] text-gray-600">
                    {productSearch.trim()
                      ? `Showing ${filteredProducts.length} match(es).`
                      : `Showing all ${filteredProducts.length} loaded products (max 200). Filter to narrow down.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => saveAllMappingsMutation.mutate()}
                    disabled={!hasPendingMappingChanges || saveAllMappingsMutation.isPending}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saveAllMappingsMutation.isPending ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <p className="text-center mt-8">
            <Link to="/pos/kds" className="text-indigo-400 text-sm font-medium hover:text-indigo-300 hover:underline">
              Open kitchen display (KDS)
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
