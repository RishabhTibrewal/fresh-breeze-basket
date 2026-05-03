import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Search, Package, Save, ChevronRight,
  ToggleLeft, ToggleRight, Warehouse, Edit2, X, Check,
  Loader2, RefreshCw, AlertCircle, Store, FolderOpen, Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import { posMenusApi, type PosMenu, type UpsertMenuItemInput } from '@/api/posMenus';
import { inventoryService, type PosPoolItem } from '@/api/inventory';
import type { Warehouse as WarehouseType } from '@/api/warehouses';

interface Props {
  warehouses: WarehouseType[];
}

interface FlatVariant {
  id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  display_name: string;
  sku: string;
  image_url: string | null;
  category_id: string;
  default_price: number;
  tax_rate: number;
}

interface MenuItemDraft {
  is_visible: boolean;
  pos_price: string; // empty string = use default
}

// Map keyed by variant_id
type DraftMap = Record<string, MenuItemDraft>;

export default function MenuManagement({ warehouses }: Props) {
  const queryClient = useQueryClient();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [inventoryWarehouseId, setInventoryWarehouseId] = useState<string>('');
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});

  // draft: which variants are in the menu and their settings
  const [draft, setDraft] = useState<DraftMap>({});
  const [draftDirty, setDraftDirty] = useState(false);

  // display filters: which categories/collections are shown on POS sale page
  const [displayCategoryIds, setDisplayCategoryIds] = useState<string[]>([]);
  const [displayCollectionIds, setDisplayCollectionIds] = useState<string[]>([]);
  const [displayFiltersDirty, setDisplayFiltersDirty] = useState(false);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ['pos-menus'],
    queryFn: posMenusApi.list,
  });

  const { data: menuDetail, isLoading: menuDetailLoading } = useQuery({
    queryKey: ['pos-menu', selectedMenuId],
    queryFn: () => posMenusApi.get(selectedMenuId!),
    enabled: !!selectedMenuId,
  });

  const { data: allVariants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ['pos-all-variants'],
    queryFn: async () => {
      const res = await apiClient.get('/products', { params: { limit: 500, page: 1, include: true } });
      const products = res.data?.success && Array.isArray(res.data.data)
        ? res.data.data
        : Array.isArray(res.data) ? res.data : [];
      const flat: FlatVariant[] = [];
      for (const product of products) {
        if (product.is_active === false) continue;
        for (const v of (product.variants ?? [])) {
          if (v.is_active === false) continue;
          flat.push({
            id: v.id,
            product_id: product.id,
            variant_id: v.id,
            product_name: product.name,
            variant_name: v.name || product.name,
            display_name: v.name && v.name !== product.name
              ? `${product.name} — ${v.name}` : product.name,
            sku: v.sku || '',
            image_url: v.image_url || product.image_url || null,
            category_id: product.category_id || '',
            default_price: v.price?.sale_price ?? 0,
            tax_rate: v.tax?.rate ?? 0,
          });
        }
      }
      return flat;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['pos-categories'],
    queryFn: async () => {
      const res = await apiClient.get('/categories');
      return res.data?.data || res.data || [];
    },
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['pos-collections'],
    queryFn: async () => {
      const res = await apiClient.get('/collections');
      return (res.data?.data || res.data || []).filter((c: any) => c.is_active !== false);
    },
  });

  // Global warehouse inventory for selected outlet
  const { data: warehouseStock = [], refetch: refetchStock } = useQuery({
    queryKey: ['pos-menu-inventory', inventoryWarehouseId],
    queryFn: async () => {
      if (!inventoryWarehouseId) return [];
      const res = await apiClient.get(`/inventory`, {
        params: { warehouse_id: inventoryWarehouseId, limit: 1000 },
      });
      return res.data?.data || res.data || [];
    },
    enabled: !!inventoryWarehouseId,
  });

  // POS pool inventory for selected outlet
  const { data: posPoolStock = [], refetch: refetchPosPool } = useQuery({
    queryKey: ['pos-outlet-inventory', inventoryWarehouseId],
    queryFn: () => inventoryService.getPosPool(inventoryWarehouseId),
    enabled: !!inventoryWarehouseId,
  });

  // Lookups: variant_id -> stock_count (global) and variant_id -> qty (POS pool)
  const stockMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of warehouseStock as any[]) {
      if (row.variant_id) map[row.variant_id] = row.stock_count ?? 0;
    }
    return map;
  }, [warehouseStock]);

  const posPoolMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of posPoolStock as PosPoolItem[]) {
      if (row.variant_id) map[row.variant_id] = row.qty ?? 0;
    }
    return map;
  }, [posPoolStock]);

  // ── Sync draft when menu detail loads ─────────────────────────────────────
  useEffect(() => {
    if (!menuDetail) return;
    const newDraft: DraftMap = {};
    for (const item of menuDetail.items ?? []) {
      newDraft[item.variant_id] = {
        is_visible: item.is_visible,
        pos_price: item.pos_price !== null && item.pos_price !== undefined
          ? String(item.pos_price) : '',
      };
    }
    setDraft(newDraft);
    setDraftDirty(false);
    setEditName(menuDetail.name);
    setEditDesc(menuDetail.description ?? '');
    // Sync display filters
    setDisplayCategoryIds(menuDetail.pos_display_category_ids ?? []);
    setDisplayCollectionIds(menuDetail.pos_display_collection_ids ?? []);
    setDisplayFiltersDirty(false);
  }, [menuDetail]);

  // ── Set default inventory warehouse when menu changes ─────────────────────
  useEffect(() => {
    if (menuDetail?.outlets?.length) {
      setInventoryWarehouseId(menuDetail.outlets[0].warehouse_id);
    } else {
      setInventoryWarehouseId('');
    }
    setStockInputs({});
  }, [menuDetail?.id]);

  // ── Assigned warehouse IDs for current menu ────────────────────────────────
  const assignedWarehouseIds = useMemo(
    () => new Set((menuDetail?.outlets ?? []).map(o => o.warehouse_id)),
    [menuDetail?.outlets]
  );

  // ── Filtered variants ──────────────────────────────────────────────────────
  const filteredVariants = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return allVariants.filter(v => {
      const matchSearch = !q ||
        v.display_name.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q);
      const matchCat = activeCategory === 'all' || v.category_id === activeCategory;
      return matchSearch && matchCat;
    });
  }, [allVariants, searchQuery, activeCategory]);

  const stockDraftDirty = useMemo(
    () =>
      Object.values(stockInputs).some((value) => {
        const qty = parseFloat(value);
        return !isNaN(qty) && qty > 0;
      }),
    [stockInputs]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMenuMut = useMutation({
    mutationFn: () => posMenusApi.create({ name: createName.trim(), description: createDesc.trim() }),
    onSuccess: (menu) => {
      queryClient.invalidateQueries({ queryKey: ['pos-menus'] });
      setShowCreate(false);
      setCreateName('');
      setCreateDesc('');
      setSelectedMenuId(menu.id);
      toast.success('Menu created');
    },
    onError: () => toast.error('Failed to create menu'),
  });

  const updateMenuMut = useMutation({
    mutationFn: () => posMenusApi.update(selectedMenuId!, { name: editName.trim(), description: editDesc.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-menus'] });
      queryClient.invalidateQueries({ queryKey: ['pos-menu', selectedMenuId] });
      setEditingName(false);
      toast.success('Menu updated');
    },
    onError: () => toast.error('Failed to update menu'),
  });

  const deleteMenuMut = useMutation({
    mutationFn: (id: string) => posMenusApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-menus'] });
      setSelectedMenuId(null);
      toast.success('Menu deleted');
    },
    onError: () => toast.error('Failed to delete menu'),
  });

  const saveItemsMut = useMutation({
    mutationFn: () => {
      const items: UpsertMenuItemInput[] = Object.entries(draft).map(([variant_id, d], idx) => {
        const v = allVariants.find(x => x.variant_id === variant_id);
        return {
          variant_id,
          product_id: v?.product_id ?? '',
          is_visible: d.is_visible,
          pos_price: d.pos_price !== '' ? parseFloat(d.pos_price) : null,
          sort_order: idx,
        };
      });
      return posMenusApi.upsertItems(selectedMenuId!, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-menu', selectedMenuId] });
      // Invalidate active menu cache for all outlets so POS sale view refreshes
      queryClient.invalidateQueries({ queryKey: ['pos-active-menu'] });
      setDraftDirty(false);
      toast.success('Menu items saved');
    },
    onError: () => toast.error('Failed to save menu items'),
  });

  const toggleOutletMut = useMutation({
    mutationFn: ({ warehouseId, assign }: { warehouseId: string; assign: boolean }) =>
      assign
        ? posMenusApi.assignOutlet(selectedMenuId!, warehouseId)
        : posMenusApi.unassignOutlet(selectedMenuId!, warehouseId),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['pos-menus'] });
      queryClient.invalidateQueries({ queryKey: ['pos-menu', selectedMenuId] });
      queryClient.invalidateQueries({ queryKey: ['pos-active-menu'] });
      toast.success(vars.assign ? 'Outlet assigned' : 'Outlet removed');
    },
    onError: (_e, vars) => toast.error(vars.assign ? 'Failed to assign outlet' : 'Failed to remove outlet'),
  });

  const saveDisplayFiltersMut = useMutation({
    mutationFn: () => posMenusApi.updateDisplayFilters(selectedMenuId!, {
      pos_display_category_ids: displayCategoryIds,
      pos_display_collection_ids: displayCollectionIds,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-menu', selectedMenuId] });
      queryClient.invalidateQueries({ queryKey: ['pos-active-menu'] });
      setDisplayFiltersDirty(false);
      toast.success('Display filters saved');
    },
    onError: () => toast.error('Failed to save display filters'),
  });

  const toggleDisplayCategory = (id: string) => {
    setDisplayCategoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setDisplayFiltersDirty(true);
  };

  const toggleDisplayCollection = (id: string) => {
    setDisplayCollectionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setDisplayFiltersDirty(true);
  };

  // Transfer queued qty values from global warehouse_inventory → pos_outlet_inventory
  const transferToPosMut = useMutation({
    mutationFn: async () => {
      if (!inventoryWarehouseId) throw new Error('Select an outlet first');
      const items = Object.entries(stockInputs)
        .map(([variantId, rawQty]) => {
          const qty = parseFloat(rawQty);
          if (isNaN(qty) || qty <= 0) return null;
          const v = allVariants.find(x => x.variant_id === variantId);
          if (!v) return null;
          return { product_id: v.product_id, variant_id: variantId, quantity: qty };
        })
        .filter(Boolean) as Array<{ product_id: string; variant_id: string; quantity: number }>;

      if (items.length === 0) throw new Error('Enter quantity for at least one variant');
      await inventoryService.transferToPosPool({
        warehouse_id: inventoryWarehouseId,
        items,
        notes: 'POS Menu stock top-up',
      });
    },
    onSuccess: () => {
      refetchStock();
      refetchPosPool();
      setStockInputs({});
      toast.success('POS stock changes saved');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to move stock to POS pool'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleVariantInMenu = (v: FlatVariant) => {
    setDraft(prev => {
      const existing = prev[v.variant_id];
      if (existing) {
        // Remove from menu entirely
        const next = { ...prev };
        delete next[v.variant_id];
        return next;
      }
      return { ...prev, [v.variant_id]: { is_visible: true, pos_price: '' } };
    });
    setDraftDirty(true);
  };

  const toggleVisibility = (variantId: string) => {
    setDraft(prev => ({
      ...prev,
      [variantId]: { ...prev[variantId], is_visible: !prev[variantId].is_visible },
    }));
    setDraftDirty(true);
  };

  const setPosPrice = (variantId: string, value: string) => {
    setDraft(prev => ({ ...prev, [variantId]: { ...prev[variantId], pos_price: value } }));
    setDraftDirty(true);
  };

  const selectedMenu = menus.find(m => m.id === selectedMenuId);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-[#0f1117] text-white overflow-hidden">

      {/* ── Left Panel: Menu List ──────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 bg-[#1a1d27] border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-indigo-400" /> Menus
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> New Menu
          </button>
        </div>

        {/* Create inline form */}
        {showCreate && (
          <div className="p-3 border-b border-white/10 bg-indigo-600/10">
            <input
              autoFocus
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="Menu name*"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 mb-2 focus:outline-none focus:border-indigo-500"
            />
            <input
              value={createDesc}
              onChange={e => setCreateDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 mb-2 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => createMenuMut.mutate()}
                disabled={!createName.trim() || createMenuMut.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                {createMenuMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Create
              </button>
              <button onClick={() => setShowCreate(false)} className="px-2 text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Menu list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {menusLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          ) : menus.length === 0 ? (
            <p className="text-center text-gray-500 text-xs py-8">No menus yet</p>
          ) : (
            menus.map((menu: PosMenu) => (
              <button
                key={menu.id}
                onClick={() => setSelectedMenuId(menu.id)}
                className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-start justify-between gap-2
                  ${selectedMenuId === menu.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{menu.name}</p>
                  <p className={`text-[10px] mt-0.5 ${selectedMenuId === menu.id ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {menu.outlets?.length
                      ? `${menu.outlets.length} outlet${menu.outlets.length !== 1 ? 's' : ''}`
                      : 'No outlets'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5 opacity-60" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right Panel: Editor ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!selectedMenuId ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
            <Store className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a menu to edit, or create a new one</p>
          </div>
        ) : menuDetailLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="flex-shrink-0 bg-[#1a1d27] border-b border-white/10 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="space-y-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full bg-white/5 border border-indigo-500 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none"
                      />
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateMenuMut.mutate()}
                          disabled={!editName.trim() || updateMenuMut.isPending}
                          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-3 py-1 text-xs font-medium"
                        >
                          {updateMenuMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Save
                        </button>
                        <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-white text-xs px-2">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">{menuDetail?.name}</h2>
                      <button onClick={() => setEditingName(true)} className="text-gray-500 hover:text-white transition-colors">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {!editingName && menuDetail?.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{menuDetail.description}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${selectedMenu?.name}"? This cannot be undone.`)) {
                      deleteMenuMut.mutate(selectedMenuId);
                    }
                  }}
                  disabled={deleteMenuMut.isPending}
                  className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* ── Outlet Assignment ── */}
              <div className="px-5 py-4 border-b border-white/5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Warehouse className="h-3.5 w-3.5" /> Outlet Assignment
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {warehouses.length === 0 ? (
                    <p className="text-gray-500 text-xs col-span-full">No warehouses configured</p>
                  ) : (
                    warehouses.map(w => {
                      const assigned = assignedWarehouseIds.has(w.id);
                      const toggling = toggleOutletMut.isPending;
                      return (
                        <button
                          key={w.id}
                          onClick={() => toggleOutletMut.mutate({ warehouseId: w.id, assign: !assigned })}
                          disabled={toggling}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all
                            ${assigned
                              ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                        >
                          {assigned
                            ? <ToggleRight className="h-4 w-4 text-emerald-400" />
                            : <ToggleLeft className="h-4 w-4" />}
                          <span className="truncate">{w.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── POS Display Filters ── */}
              <div className="px-5 py-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5" /> POS Display Filters
                  </h3>
                  {displayFiltersDirty && (
                    <button
                      onClick={() => saveDisplayFiltersMut.mutate()}
                      disabled={saveDisplayFiltersMut.isPending}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                      {saveDisplayFiltersMut.isPending
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Save className="h-3 w-3" />}
                      Save Filters
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mb-3">
                  Leave both sections empty to show everything. Selecting items restricts the POS sale page to only those categories / collections.
                </p>

                {/* Categories */}
                <div className="mb-4">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" /> Categories
                    {displayCategoryIds.length > 0 && (
                      <span className="ml-1 bg-indigo-600/30 text-indigo-300 px-1.5 py-0.5 rounded text-[9px]">
                        {displayCategoryIds.length} selected
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(categories as any[]).length === 0 ? (
                      <p className="text-gray-600 text-xs">No categories found</p>
                    ) : (
                      (categories as any[]).map((c: any) => {
                        const active = displayCategoryIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => toggleDisplayCategory(c.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              active
                                ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-300'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {active && <Check className="h-3 w-3 flex-shrink-0" />}
                            {c.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Collections */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Collections
                    {displayCollectionIds.length > 0 && (
                      <span className="ml-1 bg-emerald-600/30 text-emerald-300 px-1.5 py-0.5 rounded text-[9px]">
                        {displayCollectionIds.length} selected
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(collections as any[]).length === 0 ? (
                      <p className="text-gray-600 text-xs">No collections found</p>
                    ) : (
                      (collections as any[]).map((c: any) => {
                        const active = displayCollectionIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => toggleDisplayCollection(c.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              active
                                ? 'bg-emerald-600/25 border-emerald-500/50 text-emerald-300'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {active && <Check className="h-3 w-3 flex-shrink-0" />}
                            {c.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* ── Inventory Warehouse Selector ── */}
              {assignedWarehouseIds.size > 0 && (
                <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center gap-3">
                  <span className="text-xs text-gray-400 whitespace-nowrap">Stock view for:</span>
                  <select
                    value={inventoryWarehouseId}
                    onChange={e => setInventoryWarehouseId(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 min-w-[180px]"
                  >
                    <option value="">— select outlet —</option>
                    {warehouses
                      .filter(w => assignedWarehouseIds.has(w.id))
                      .map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                  </select>
                  {inventoryWarehouseId && (
                    <button
                      onClick={() => { refetchStock(); refetchPosPool(); }}
                      className="text-gray-500 hover:text-white transition-colors"
                      title="Refresh stock"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* ── Product Table ── */}
              <div className="px-5 py-4">
                {/* Search + category filter */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search products / SKU…"
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <select
                    value={activeCategory}
                    onChange={e => setActiveCategory(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Categories</option>
                    {(categories as any[]).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  {draftDirty && (
                    <button
                      onClick={() => saveItemsMut.mutate()}
                      disabled={saveItemsMut.isPending}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors ml-auto"
                    >
                      {saveItemsMut.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Save className="h-4 w-4" />}
                      Save Menu
                    </button>
                  )}
                  {stockDraftDirty && (
                    <button
                      onClick={() => transferToPosMut.mutate()}
                      disabled={transferToPosMut.isPending || !inventoryWarehouseId}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    >
                      {transferToPosMut.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Save className="h-4 w-4" />}
                      Save Stock
                    </button>
                  )}
                </div>

                {/* Table header */}
                {variantsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/5 overflow-hidden">
                    {/* Header row */}
                    <div className="grid grid-cols-[auto_1fr_110px_90px_110px_90px] gap-0 bg-white/[0.03] border-b border-white/5 px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      <div className="w-8">In</div>
                      <div>Product / Variant</div>
                      <div className="text-right">POS Price</div>
                      <div className="text-right">Global</div>
                      <div className="text-right">POS Pool</div>
                      <div className="text-right">Visible</div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-white/5 max-h-[50vh] overflow-y-auto">
                      {filteredVariants.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
                          <Package className="h-8 w-8 opacity-30" />
                          <p className="text-sm">No products found</p>
                        </div>
                      ) : (
                        filteredVariants.map(v => {
                          const inMenu = !!draft[v.variant_id];
                          const d = draft[v.variant_id];
                          const globalStock = stockMap[v.variant_id];
                          const posPool = posPoolMap[v.variant_id];
                          const stockVal = stockInputs[v.variant_id] ?? '';

                          return (
                            <div
                              key={v.variant_id}
                              className={`grid grid-cols-[auto_1fr_110px_90px_110px_90px] gap-0 items-center px-4 py-2.5 transition-colors
                                ${inMenu ? 'bg-indigo-600/5' : 'hover:bg-white/[0.02]'}`}
                            >
                              {/* Toggle in/out of menu */}
                              <div className="w-8">
                                <button
                                  onClick={() => toggleVariantInMenu(v)}
                                  className={`w-5 h-5 rounded flex items-center justify-center border transition-all
                                    ${inMenu
                                      ? 'bg-indigo-600 border-indigo-500 text-white'
                                      : 'border-white/20 hover:border-indigo-500 text-transparent hover:text-gray-400'}`}
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              </div>

                              {/* Product info */}
                              <div className="flex items-center gap-2 min-w-0">
                                {v.image_url ? (
                                  <img src={v.image_url} alt={v.display_name}
                                    className="h-8 w-8 rounded object-cover flex-shrink-0 bg-white/5" />
                                ) : (
                                  <div className="h-8 w-8 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
                                    <Package className="h-4 w-4 text-gray-600" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-white truncate">{v.product_name}</p>
                                  {v.variant_name !== v.product_name && (
                                    <p className="text-[10px] text-indigo-300 truncate">{v.variant_name}</p>
                                  )}
                                  {v.sku && <p className="text-[10px] text-gray-500">{v.sku}</p>}
                                </div>
                              </div>

                              {/* POS Price */}
                              <div className="text-right pr-2">
                                {inMenu ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={d.pos_price}
                                    onChange={e => setPosPrice(v.variant_id, e.target.value)}
                                    placeholder={`₹${v.default_price.toFixed(2)}`}
                                    className="w-full text-right bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                                  />
                                ) : (
                                  <span className="text-xs text-gray-500">₹{v.default_price.toFixed(2)}</span>
                                )}
                              </div>

                              {/* Global stock (read-only) */}
                              <div className="text-right pr-2">
                                {inventoryWarehouseId ? (
                                  <span className={`text-xs font-medium ${
                                    globalStock === undefined ? 'text-gray-600'
                                    : globalStock <= 0 ? 'text-red-400'
                                    : globalStock <= 5 ? 'text-amber-400'
                                    : 'text-emerald-400'
                                  }`}>
                                    {globalStock !== undefined ? globalStock : '—'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-600">—</span>
                                )}
                              </div>

                              {/* POS Pool — transfer qty input */}
                              <div className="text-right pr-2">
                                {inventoryWarehouseId ? (
                                  <div className="flex items-center justify-end gap-1">
                                    {posPool !== undefined && (
                                      <span className={`text-[10px] font-medium mr-1 ${
                                        posPool <= 0 ? 'text-red-400'
                                        : posPool <= 5 ? 'text-amber-400'
                                        : 'text-indigo-300'
                                      }`}>
                                        {posPool}
                                      </span>
                                    )}
                                    <input
                                      type="number"
                                      min="1"
                                      value={stockVal}
                                      placeholder="+qty"
                                      onChange={e => setStockInputs(prev => ({ ...prev, [v.variant_id]: e.target.value }))}
                                      className="w-14 text-right bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-indigo-500"
                                      title="Enter quantity to move, then click Save Stock"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-gray-600">—</span>
                                )}
                              </div>

                              {/* Visibility toggle */}
                              <div className="text-right">
                                {inMenu ? (
                                  <button
                                    onClick={() => toggleVisibility(v.variant_id)}
                                    className={`transition-colors ${d.is_visible ? 'text-emerald-400' : 'text-gray-600'}`}
                                    title={d.is_visible ? 'Visible in POS' : 'Hidden in POS'}
                                  >
                                    {d.is_visible
                                      ? <ToggleRight className="h-5 w-5" />
                                      : <ToggleLeft className="h-5 w-5" />}
                                  </button>
                                ) : (
                                  <span className="text-gray-700"><ToggleLeft className="h-5 w-5 inline" /></span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Save bar */}
                {(draftDirty || stockDraftDirty) && (
                  <div className="flex items-center justify-between bg-indigo-600/10 border border-indigo-500/30 rounded-xl px-4 py-3 mt-4">
                    <div className="flex items-center gap-2 text-sm text-indigo-300">
                      <AlertCircle className="h-4 w-4" />
                      You have unsaved changes
                    </div>
                    <div className="flex items-center gap-2">
                      {stockDraftDirty && (
                        <button
                          onClick={() => transferToPosMut.mutate()}
                          disabled={transferToPosMut.isPending || !inventoryWarehouseId}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                        >
                          {transferToPosMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save Stock Changes
                        </button>
                      )}
                      {draftDirty && (
                        <button
                          onClick={() => saveItemsMut.mutate()}
                          disabled={saveItemsMut.isPending}
                          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                        >
                          {saveItemsMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save Menu Items
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
