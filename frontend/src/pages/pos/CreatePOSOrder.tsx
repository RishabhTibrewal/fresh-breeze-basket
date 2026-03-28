import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import {
  Plus, Minus, Trash2, ShoppingCart, Printer,
  X, Search, ChevronLeft, ChevronRight,
  Store, History, Users, UserPlus,
  Settings, LogOut, CreditCard, Smartphone,
  Banknote, Layers, CheckCircle2, Tag,
  MapPin, Package, Pencil, ChevronDown,
  SlidersHorizontal, Receipt, BarChart3, User,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { warehousesService } from '@/api/warehouses';
import { invoicesService } from '@/api/invoices';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Modifier {
  id: string;
  name: string;
  price_adjust: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  min_select: number;
  max_select: number | null;
  modifiers: Modifier[];
}

interface CartItem {
  id: string; // unique cart item id
  product_id: string;
  variant_id?: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  tax_percentage: number;
  subtotal: number;
  image_url?: string;
  warehouse_id?: string;
  selected_modifiers: Modifier[];
  modifier_groups?: ModifierGroup[];
  notes?: string;
}

type PaymentMethod = 'cash' | 'card' | 'upi' | 'split';
type OrderType = 'dine_in' | 'take_away' | 'delivery';

interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
}

interface SplitPayment {
  method: 'cash' | 'card' | 'upi';
  amount: string;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).substring(2, 10);

const formatPrice = (p: number) => `₹${p.toFixed(2)}`;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreatePOSOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);

  // ── sidebar ──
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── products / categories ──
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // ── cart ──
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [discountPct, setDiscountPct] = useState(0);
  const [customDiscount, setCustomDiscount] = useState('');

  // ── order type ──
  const [orderType, setOrderType] = useState<OrderType>('take_away');
  const [tableNumber, setTableNumber] = useState('');

  // ── modals ──
  // ── views ──
  const [activeView, setActiveView] = useState<'sale' | 'history' | 'customers' | 'reports' | 'settings'>('sale');
  const [customPriceModal, setCustomPriceModal] = useState<{ product: any } | null>(null);
  const [customPriceValue, setCustomPriceValue] = useState('');
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    name: '', phone: '', address: '', city: '', notes: ''
  });
  const [modifierModal, setModifierModal] = useState<{ item: CartItem } | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{ orderId: string; receiptNumber: string; change: number } | null>(null);

  // ── outlet ──
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [outletDropdownOpen, setOutletDropdownOpen] = useState(false);

  // ── customer ──
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // ── receipt number (generated per session, changes on new order) ──
  const [receiptNumber, setReceiptNumber] = useState(() => {
    const d = new Date();
    const dateStr = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `POS-${dateStr}${Math.floor(10 + Math.random() * 90)}`;
  });

  // ── payment ──
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [upiRef, setUpiRef] = useState('');
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([
    { method: 'cash', amount: '' },
    { method: 'card', amount: '' },
  ]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const { data: variants = [], isLoading: productsLoading } = useQuery({
    queryKey: ['pos-variants'],
    queryFn: async () => {
      // Fetch all products with variants, then flatten to variant-level catalog items
      const res = await apiClient.get('/products', { params: { limit: 500, page: 1, include: true } });
      const products = res.data?.success && Array.isArray(res.data.data)
        ? res.data.data
        : Array.isArray(res.data) ? res.data : [];
      // Flatten: one card per active variant
      const flat: any[] = [];
      for (const product of products) {
        if (product.is_active === false) continue;
        const productVariants: any[] = product.variants || [];
        for (const v of productVariants) {
          if (v.is_active === false) continue;
          flat.push({
            // Variant-level fields
            id: v.id,                        // variant id (used as cart item id source)
            product_id: product.id,
            variant_id: v.id,
            name: v.name || product.name,    // variant name (e.g. "500g")
            product_name: product.name,      // parent product name
            display_name: v.name && v.name !== product.name
              ? `${product.name} — ${v.name}`
              : product.name,
            sku: v.sku,
            image_url: v.image_url || product.image_url || null,
            badge: v.badge,
            category_id: product.category_id,
            // Price: from nested price object
            sale_price: v.price?.sale_price ?? 0,
            mrp_price: v.price?.mrp_price ?? 0,
            // Tax: from nested tax object (rate = percentage)
            tax_rate: v.tax?.rate ?? 0,
            // Modifier groups linked to this variant
            modifier_groups: v.modifier_groups || [],
            is_bundle: v.is_bundle,
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

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(true),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['pos-customers'],
    queryFn: async () => {
      const res = await apiClient.get('/customers', { params: { limit: 200 } });
      return res.data?.data || res.data || [];
    },
  });

  const { data: modifierGroups = [] } = useQuery<ModifierGroup[]>({
    queryKey: ['modifier-groups-with-modifiers'],
    queryFn: async () => {
      const res = await apiClient.get('/modifiers');
      return res.data?.data || res.data || [];
    },
  });

  // ─── Computed ───────────────────────────────────────────────────────────────

  const filteredProducts = variants.filter((v: any) => {
    const matchSearch = !searchQuery ||
      v.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || v.category_id === activeCategory;
    return matchSearch && matchCat;
  });

  const effectiveDiscount = customDiscount !== '' ? parseFloat(customDiscount) || 0 : discountPct;

  const subtotal = cartItems.reduce((s, item) => {
    const modifierAdj = item.selected_modifiers.reduce((a, m) => a + m.price_adjust, 0);
    return s + (item.unit_price + modifierAdj) * item.quantity;
  }, 0);
  const taxAmount = cartItems.reduce((s, item) => {
    const modifierAdj = item.selected_modifiers.reduce((a, m) => a + m.price_adjust, 0);
    const base = (item.unit_price + modifierAdj) * item.quantity;
    return s + base * (item.tax_percentage / 100);
  }, 0);
  const discountAmount = parseFloat((subtotal * (effectiveDiscount / 100)).toFixed(2));
  const grandTotal = parseFloat((subtotal - discountAmount + taxAmount).toFixed(2));

  const changeDue = paymentMethod === 'cash'
    ? Math.max(0, (parseFloat(cashTendered) || 0) - grandTotal)
    : 0;

  const defaultWarehouseId = selectedOutletId || (warehouses[0] as any)?.id;
  const selectedOutlet = (warehouses as any[]).find(w => w.id === defaultWarehouseId);

  // ─── Cart Actions ───────────────────────────────────────────────────────────

  const addToCart = (variant: any, overridePrice?: number) => {
    const price = overridePrice !== undefined
      ? overridePrice
      : (variant.sale_price ?? 0);

    // If price is 0 and no override, show custom price modal
    if (price === 0 && overridePrice === undefined) {
      setCustomPriceValue('');
      setCustomPriceModal({ product: variant });
      return;
    }

    const taxRate = variant.tax_rate ?? 0;
    // Use modifier groups directly from variant (already linked)
    const variantModifierGroups: ModifierGroup[] = variant.modifier_groups?.length
      ? variant.modifier_groups
      : modifierGroups.filter(g => g.modifiers?.length > 0);

    setCartItems(prev => {
      // Merge if same variant is already in cart with no modifiers
      const existing = prev.find(i => i.variant_id === variant.variant_id && i.selected_modifiers.length === 0);
      if (existing && variantModifierGroups.length === 0) {
        return prev.map(i => i.id === existing.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price }
          : i
        );
      }
      const newItem: CartItem = {
        id: genId(),
        product_id: variant.product_id,
        variant_id: variant.variant_id,
        product_name: variant.display_name,
        sku: variant.sku || undefined,
        quantity: 1,
        unit_price: price,
        tax_percentage: taxRate,
        subtotal: price,
        image_url: variant.image_url || undefined,
        warehouse_id: defaultWarehouseId,
        selected_modifiers: [],
        modifier_groups: variantModifierGroups,
      };
      return [...prev, newItem];
    });

    toast.success(`${variant.display_name} added`, { duration: 1000 });
  };

  const updateQty = (id: string, delta: number) => {
    setCartItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const qty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: qty, subtotal: qty * i.unit_price };
    }));
  };

  const removeItem = (id: string) => {
    setCartItems(prev => prev.filter(i => i.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
    setOrderNotes('');
    setDiscountPct(0);
    setCustomDiscount('');
    setOrderType('take_away');
    setTableNumber('');
    setDeliveryAddress({ name: '', phone: '', address: '', city: '', notes: '' });
  };

  // ─── Modifier modal helpers ─────────────────────────────────────────────────

  const toggleModifier = (itemId: string, modifier: Modifier) => {
    setCartItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const exists = i.selected_modifiers.find(m => m.id === modifier.id);
      const updated = exists
        ? i.selected_modifiers.filter(m => m.id !== modifier.id)
        : [...i.selected_modifiers, modifier];
      return { ...i, selected_modifiers: updated };
    }));
    // Also update modifierModal item reference
    setModifierModal(prev => {
      if (!prev) return prev;
      if (prev.item.id !== itemId) return prev;
      const exists = prev.item.selected_modifiers.find(m => m.id === modifier.id);
      const updated = exists
        ? prev.item.selected_modifiers.filter(m => m.id !== modifier.id)
        : [...prev.item.selected_modifiers, modifier];
      return { item: { ...prev.item, selected_modifiers: updated } };
    });
  };

  // ─── Order Mutation ─────────────────────────────────────────────────────────

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const items = cartItems.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        price: item.unit_price,
        unit_price: item.unit_price,
        warehouse_id: item.warehouse_id,
        tax_percentage: item.tax_percentage,
        selected_modifiers: item.selected_modifiers.map(m => ({
          modifier_id: m.id,
          price_adjust: m.price_adjust,
        })),
      }));

      const payload: any = {
        items,
        payment_method: paymentMethod,
        notes: orderNotes,
        fulfillment_type:
          orderType === 'dine_in' ? 'cash_counter'
            : orderType === 'take_away' ? 'pickup'
              : 'delivery',
        order_type_label: orderType,
        extra_discount_percentage: effectiveDiscount,
        customer_id: selectedCustomer?.id || null,
        outlet_id: defaultWarehouseId || null,
        table_number: orderType === 'dine_in' ? tableNumber : null,
        delivery_address: orderType === 'delivery' ? deliveryAddress : null,
      };

      if (paymentMethod === 'cash') {
        payload.cash_tendered = parseFloat(cashTendered) || grandTotal;
        payload.change_given = changeDue;
      } else if (paymentMethod === 'upi') {
        payload.transaction_id = upiRef;
      } else if (paymentMethod === 'split') {
        payload.split_payments = splitPayments.filter(s => parseFloat(s.amount) > 0);
      }

      const res = await apiClient.post('/pos/orders', payload);
      return res.data;
    },
    onSuccess: (data) => {
      const orderId = data?.data?.id;
      const receiptNo = data?.data?.receipt_number || `RCP-${Date.now().toString().slice(-6)}`;
      setPaymentSuccess({ orderId, receiptNumber: receiptNo, change: changeDue });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create order');
    }
  });

  const handleCharge = () => {
    if (cartItems.length === 0) { toast.error('Cart is empty'); return; }
    if (orderType === 'delivery' && !deliveryAddress.address) {
      toast.error('Please enter a delivery address'); return;
    }
    createOrderMutation.mutate();
  };

  const handlePrint = async () => {
    if (!paymentSuccess?.orderId) return;
    try { await invoicesService.printPOSInvoice(paymentSuccess.orderId); }
    catch { toast.error('Could not open invoice'); }
  };

  const handleNewOrder = () => {
    setPaymentModal(false);
    setPaymentSuccess(null);
    setCashTendered('');
    setUpiRef('');
    setSelectedCustomer(null);
    // Generate a fresh receipt number for the next order
    const d = new Date();
    const dateStr = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
    setReceiptNumber(`POS-${dateStr}${Math.floor(10 + Math.random() * 90)}`);
    clearCart();
  };

  // Auto-open payment modal when mutation is pending
  const handleChargeClick = () => {
    if (cartItems.length === 0) { toast.error('Cart is empty'); return; }
    if (orderType === 'delivery' && !deliveryAddress.address) {
      toast.error('Please enter a delivery address'); return;
    }
    setPaymentModal(true);
  };

  // ─── Sidebar Items ──────────────────────────────────────────────────────────

  const sidebarItems = [
    { id: 'sale', icon: <Store className="h-5 w-5" />, label: 'New Sale', action: () => setActiveView('sale') },
    { id: 'history', icon: <History className="h-5 w-5" />, label: 'Order History', action: () => setActiveView('history') },
    { id: 'customers', icon: <Users className="h-5 w-5" />, label: 'Customers', action: () => setActiveView('customers') },
    { id: 'reports', icon: <BarChart3 className="h-5 w-5" />, label: 'Reports', action: () => setActiveView('reports') },
    { id: 'settings', icon: <Settings className="h-5 w-5" />, label: 'Settings', action: () => setActiveView('settings') },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f1117] text-white font-sans">

      {/* ── POS Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`flex-shrink-0 flex flex-col bg-[#1a1d27] border-r border-white/10 transition-all duration-200 z-50
          ${sidebarOpen ? 'w-52' : 'w-16'}`}
      >
        {/* Toggle + Logo */}
        <div className="flex items-center justify-between h-16 px-3 border-b border-white/10">
          {sidebarOpen && (
            <span className="font-bold text-white tracking-wide text-sm">POS Terminal</span>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="rounded-lg p-2 hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-auto"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {sidebarItems.map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${activeView === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-300 hover:bg-white/10 hover:text-white'}
                ${!sidebarOpen ? 'justify-center' : ''}`}
              title={!sidebarOpen ? item.label : undefined}
            >
              {item.icon}
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-2 border-t border-white/10">
          <div className={`flex items-center gap-3 px-3 py-3 rounded-lg bg-white/5 
            ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <div className="bg-indigo-600/20 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-indigo-400" />
              )}
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : 'User'}
                </p>
                <p className="text-[10px] text-gray-500 truncate capitalize">{profile?.role || 'Staff'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Back to Modules */}
        <div className="p-2 border-t border-white/10">
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors
              ${!sidebarOpen ? 'justify-center' : ''}`}
            title={!sidebarOpen ? 'Exit POS' : undefined}
          >
            <LogOut className="h-5 w-5" />
            {sidebarOpen && <span className="text-sm font-medium">Exit POS</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────── */}
      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        
        {/* SALE VIEW */}
        {activeView === 'sale' && (
          <>
            {/* Center: Product Catalog */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Search + Outlet Header */}
              <div className="flex-shrink-0 h-16 bg-[#1a1d27] border-b border-white/10 flex items-center gap-2 px-4">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search products or scan barcode..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-all"
            />
          </div>

          {/* Outlet Selector */}
          <div className="relative">
            <button
              onClick={() => setOutletDropdownOpen(o => !o)}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white transition-colors whitespace-nowrap"
            >
              <Package className="h-4 w-4 text-indigo-400" />
              <span>{selectedOutlet?.name || 'Select Outlet'}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>
            {outletDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-[#1a1d27] border border-white/10 rounded-xl shadow-2xl z-50 py-1">
                {(warehouses as any[]).map(w => (
                  <button
                    key={w.id}
                    onClick={() => { setSelectedOutletId(w.id); setOutletDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10
                      ${(w.id === defaultWarehouseId) ? 'text-indigo-400 font-medium' : 'text-gray-300'}`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-[#0f1117] border-b border-white/5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-md text-xs font-medium transition-all
              ${activeCategory === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
          >
            All Products
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-md text-xs font-medium transition-all
                ${activeCategory === cat.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white/5 rounded-xl h-36 animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
              <Package className="h-12 w-12 opacity-30" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((variant: any) => {
                const price = variant.sale_price ?? 0;
                const isZeroPrice = price === 0;
                return (
                  <button
                    key={variant.id}
                    onClick={() => addToCart(variant)}
                    className="group relative bg-[#1a1d27] hover:bg-[#22263a] border border-white/5 hover:border-indigo-500/50 rounded-xl p-3 text-left transition-all duration-150 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95"
                  >
                    {/* Badge */}
                    {variant.badge && (
                      <span className="absolute top-2 right-2 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                        {variant.badge}
                      </span>
                    )}
                    {isZeroPrice && (
                      <span className="absolute top-2 right-2 bg-amber-500 text-black text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <Pencil className="h-2.5 w-2.5" /> Price
                      </span>
                    )}

                    {/* Image */}
                    {variant.image_url ? (
                      <img
                        src={variant.image_url}
                        alt={variant.display_name}
                        className="w-full h-20 object-cover rounded-lg mb-2 bg-white/5"
                      />
                    ) : (
                      <div className="w-full h-20 rounded-lg mb-2 bg-white/5 flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-600" />
                      </div>
                    )}

                    <p className="text-xs font-medium text-white line-clamp-2 leading-tight mb-0.5">
                      {variant.product_name}
                    </p>
                    {variant.name !== variant.product_name && (
                      <p className="text-[10px] text-indigo-300 mb-0.5 truncate">{variant.name}</p>
                    )}
                    {variant.sku && (
                      <p className="text-[10px] text-gray-500 mb-1">{variant.sku}</p>
                    )}
                    <div className="flex items-end justify-between gap-1">
                      <p className={`text-sm font-bold ${isZeroPrice ? 'text-amber-400' : 'text-indigo-400'}`}>
                        {isZeroPrice ? 'Custom' : formatPrice(price)}
                      </p>
                      {variant.tax_rate > 0 && (
                        <p className="text-[9px] text-gray-500 leading-none mb-0.5">
                          {variant.tax_rate}% tax
                        </p>
                      )}
                    </div>

                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Cart Panel ─────────────────────────────────────── */}
      <div className="flex-shrink-0 w-80 xl:w-96 bg-[#1a1d27] border-l border-white/10 flex flex-col overflow-hidden">

        {/* Right Panel Header: Receipt + Customer */}
        <div className="flex-shrink-0 bg-[#0f1117] border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-bold text-white tracking-wide">{receiptNumber}</span>
            </div>
            <button
              onClick={() => setCustomerModal(true)}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-indigo-600/30 border border-white/10 hover:border-indigo-500/50 rounded-lg px-2.5 py-1.5 text-xs text-white transition-all"
            >
              <UserPlus className="h-3.5 w-3.5 text-indigo-400" />
              {selectedCustomer ? (
                <span className="text-indigo-300 max-w-[90px] truncate">{selectedCustomer.name}</span>
              ) : (
                <span className="text-gray-400">Add Customer</span>
              )}
            </button>
          </div>
          {/* Customer chip or walk-in indicator */}
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-indigo-600/10 border border-indigo-500/20 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-indigo-500/30 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-indigo-300">{selectedCustomer.name?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{selectedCustomer.name}</p>
                  {selectedCustomer.phone && <p className="text-[10px] text-indigo-400">{selectedCustomer.phone}</p>}
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-gray-500 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <Users className="h-3 w-3" />
              <span>Walk-in customer</span>
            </div>
          )}
        </div>

        {/* Order Type Tabs */}
        <div className="flex-shrink-0 bg-[#0f1117] border-b border-white/10 p-3">
          <div className="grid grid-cols-3 gap-1 bg-white/5 rounded-lg p-1">
            {([
              { key: 'dine_in', label: 'Dine-In', icon: <Store className="h-3 w-3" /> },
              { key: 'take_away', label: 'Take Away', icon: <Package className="h-3 w-3" /> },
              { key: 'delivery', label: 'Delivery', icon: <MapPin className="h-3 w-3" /> },
            ] as { key: OrderType; label: string; icon: React.ReactNode }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setOrderType(tab.key);
                  if (tab.key === 'delivery') setDeliveryModal(true);
                }}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-all
                  ${orderType === tab.key ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          {orderType === 'dine_in' && (
            <input
              type="text"
              placeholder="Table number (optional)"
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value)}
              className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          )}
          {orderType === 'delivery' && deliveryAddress.address && (
            <div className="mt-2 text-xs text-gray-400 flex items-center justify-between">
              <span className="truncate">{deliveryAddress.address}, {deliveryAddress.city}</span>
              <button onClick={() => setDeliveryModal(true)} className="text-indigo-400 hover:text-indigo-300 ml-2 flex-shrink-0">Edit</button>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
              <ShoppingCart className="h-12 w-12 mb-3" />
              <p className="text-sm font-medium">Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cartItems.map(item => {
                const effectivePrice = item.unit_price;
                return (
                  <div key={item.id} className="bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 transition-all group">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{item.product_name}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.selected_modifiers.map(m => (
                            <span key={m.id} className="text-[10px] text-gray-500 leading-none bg-white/5 px-1 rounded">+{m.name}</span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-gray-500 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      {/* Qty controls */}
                      <div className="flex items-center gap-2 bg-black/20 rounded-lg px-1">
                        <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:text-indigo-400 transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:text-indigo-400 transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Modifier button */}
                        {(item.modifier_groups?.length ?? 0) > 0 && (
                          <button
                            onClick={() => setModifierModal({ item })}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                          >
                            <SlidersHorizontal className="h-3 w-3" /> Add-ons
                          </button>
                        )}
                        <span className="text-sm font-bold text-white">{formatPrice(effectivePrice * item.quantity)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Discount + Totals + Charge */}
        <div className="flex-shrink-0 border-t border-white/10">
          {/* Discount */}
          <div className="px-3 pt-3">
            <div className="flex items-center gap-1 mb-1">
              <Tag className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-400">Discount</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[0, 5, 10, 15].map(pct => (
                <button
                  key={pct}
                  onClick={() => { setDiscountPct(pct); setCustomDiscount(''); }}
                  className={`py-1 rounded-md text-xs font-medium transition-all
                    ${effectiveDiscount === pct && customDiscount === '' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                >
                  {pct}%
                </button>
              ))}
              <input
                type="number"
                placeholder="%"
                value={customDiscount}
                onChange={e => setCustomDiscount(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-indigo-500 w-full"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="px-3 py-2.5 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Tax</span><span>+{formatPrice(taxAmount)}</span>
            </div>
            {effectiveDiscount > 0 && (
              <div className="flex justify-between text-xs text-green-400">
                <span>Discount ({effectiveDiscount}%)</span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-white pt-1.5 border-t border-white/10">
              <span>Grand Total</span>
              <span className="text-indigo-400">{formatPrice(grandTotal)}</span>
            </div>
          </div>

            {/* Order note */}
            <div className="px-3 pb-2">
              <input
                type="text"
                placeholder="Order note..."
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Charge Button */}
          <div className="px-3 pb-3">
            <button
              onClick={handleChargeClick}
              disabled={cartItems.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-base transition-all duration-150 flex items-center justify-center gap-2"
            >
              <CreditCard className="h-5 w-5" />
              {cartItems.length === 0 ? 'Cart is empty' : `Charge ${formatPrice(grandTotal)}`}
            </button>
          </div>
        </div>
      </>
    )}

    {/* ORDER HISTORY VIEW */}
    {activeView === 'history' && (
          <div className="flex-1 flex flex-col bg-[#0f1117] p-6 overflow-y-auto">
            <header className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Order History</h2>
                <p className="text-gray-500 text-sm">Review recent POS transactions</p>
              </div>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500" 
                />
              </div>
            </header>
            
            <div className="bg-[#1a1d27] border border-white/10 rounded-2xl overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-white/5 border-b border-white/10">
                   <tr>
                     <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase">Receipt</th>
                     <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase">Customer</th>
                     <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase">Total</th>
                     <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase">Status</th>
                     <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                   <tr className="hover:bg-white/5 transition-colors">
                     <td className="px-6 py-4 font-medium">POS-280388</td>
                     <td className="px-6 py-4 text-gray-400">Walk-in Customer</td>
                     <td className="px-6 py-4 font-bold text-indigo-400">₹450.00</td>
                     <td className="px-6 py-4"><span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-[10px] font-bold">PAID</span></td>
                     <td className="px-6 py-4"><button className="text-indigo-400 hover:text-indigo-300 text-sm">Details</button></td>
                   </tr>
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {/* CUSTOMERS VIEW */}
        {activeView === 'customers' && (
          <div className="flex-1 flex flex-col bg-[#0f1117] p-6 overflow-y-auto">
            <header className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Customer Directory</h2>
                <p className="text-gray-500 text-sm">Manage and add POS customers</p>
              </div>
              <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Add New Customer
              </button>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-[#1a1d27] border border-white/10 p-4 rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-indigo-600/20 rounded-full w-10 h-10 flex items-center justify-center">
                    <User className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">John Doe</h3>
                    <p className="text-xs text-gray-500">+91 9876543210</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs pt-3 border-t border-white/5">
                  <span className="text-gray-500">Total Visits: 12</span>
                  <span className="text-indigo-400 font-bold">₹12,450.00 Spent</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS VIEW */}
        {activeView === 'reports' && (
          <div className="flex-1 flex flex-col bg-[#0f1117] p-6 overflow-y-auto">
            <header className="mb-8">
              <h2 className="text-2xl font-bold">POS Analytics</h2>
              <p className="text-gray-500 text-sm">Daily sales and performance metrics</p>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Sales', value: '₹45,230', trend: '+12%', color: 'indigo' },
                { label: 'Orders', value: '42', trend: '+5%', color: 'green' },
                { label: 'Avg Order', value: '₹1,076', trend: '-2%', color: 'amber' },
                { label: 'Returns', value: '2', trend: '0%', color: 'red' },
              ].map((stat, i) => (
                <div key={i} className="bg-[#1a1d27] border border-white/10 p-5 rounded-3xl">
                  <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                  <div className="flex items-end justify-between">
                    <h3 className="text-2xl font-black">{stat.value}</h3>
                    <span className={`text-[10px] font-bold text-${stat.color}-400`}>{stat.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium italic">Sales Chart Visualization Loading...</p>
                </div>
              </div>
              <div className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
                <h3 className="font-bold mb-4">Top Selling Items</h3>
                <div className="space-y-4">
                  {[
                    { name: 'Fresh Milk 1L', sold: 24, revenue: '₹1,440' },
                    { name: 'Organic Eggs', sold: 18, revenue: '₹2,160' },
                    { name: 'Sourdough Bread', sold: 15, revenue: '₹1,200' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                       <div>
                         <p className="text-sm font-medium">{item.name}</p>
                         <p className="text-[10px] text-gray-500">{item.sold} units sold</p>
                       </div>
                       <p className="font-bold text-indigo-400">{item.revenue}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS VIEW */}
        {activeView === 'settings' && (
          <div className="flex-1 flex flex-col bg-[#0f1117] p-6 overflow-y-auto">
             <header className="mb-8">
              <h2 className="text-2xl font-bold">POS Configuration</h2>
              <p className="text-gray-500 text-sm">Terminal specific settings and preferences</p>
            </header>

            <div className="max-w-2xl space-y-6">
              <div className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Smartphone className="h-4 w-4" /> General Display</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Dark Mode</span>
                    <div className="w-10 h-5 bg-indigo-600 rounded-full flex items-center px-1">
                      <div className="bg-white w-3 h-3 rounded-full ml-auto" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Large Item Cards</span>
                    <div className="w-10 h-5 bg-white/10 rounded-full flex items-center px-1">
                      <div className="bg-gray-400 w-3 h-3 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Printer className="h-4 w-4" /> Print Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-print receipt</span>
                    <div className="w-10 h-5 bg-indigo-600 rounded-full flex items-center px-1">
                      <div className="bg-white w-3 h-3 rounded-full ml-auto" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Thermal Printer IP</span>
                    <input type="text" value="192.168.1.102" readOnly className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-indigo-400 w-24 text-right" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════ */}

      {/* ── 1. Custom Price Modal ─────────────────────────────────── */}
      {customPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-500/20 rounded-full p-2">
                <Pencil className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Set Custom Price</h3>
                <p className="text-xs text-gray-400">{customPriceModal.product.name}</p>
              </div>
            </div>
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
              <input
                autoFocus
                type="number"
                placeholder="0.00"
                value={customPriceValue}
                onChange={e => setCustomPriceValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const price = parseFloat(customPriceValue);
                    if (!isNaN(price) && price >= 0) {
                      addToCart(customPriceModal.product, price);
                      setCustomPriceModal(null);
                    }
                  }
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white text-xl font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCustomPriceModal(null)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  const price = parseFloat(customPriceValue);
                  if (!isNaN(price) && price >= 0) {
                    addToCart(customPriceModal.product, price);
                    setCustomPriceModal(null);
                  } else {
                    toast.error('Enter a valid price');
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Delivery Address Modal ─────────────────────────────── */}
      {deliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 rounded-full p-2">
                  <MapPin className="h-5 w-5 text-indigo-400" />
                </div>
                <h3 className="font-semibold text-white">Delivery Details</h3>
              </div>
              <button onClick={() => setDeliveryModal(false)} className="text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {([
                { key: 'name', label: 'Customer Name', placeholder: 'Full name' },
                { key: 'phone', label: 'Phone', placeholder: '+91 XXXXX XXXXX' },
                { key: 'address', label: 'Address *', placeholder: 'Street, building, area' },
                { key: 'city', label: 'City', placeholder: 'City' },
                { key: 'notes', label: 'Delivery Notes', placeholder: 'Landmark, instructions...' },
              ] as { key: keyof DeliveryAddress; label: string; placeholder: string }[]).map(field => (
                <div key={field.key}>
                  <label className="text-xs text-gray-400 mb-1 block">{field.label}</label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={deliveryAddress[field.key]}
                    onChange={e => setDeliveryAddress(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setOrderType('take_away'); setDeliveryModal(false); }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!deliveryAddress.address) { toast.error('Address is required'); return; }
                  setDeliveryModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Modifier Modal ─────────────────────────────────────── */}
      {modifierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white">Customise</h3>
                <p className="text-xs text-gray-400 mt-0.5">{modifierModal.item.product_name}</p>
              </div>
              <button onClick={() => setModifierModal(null)} className="text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-5">
              {(modifierModal.item.modifier_groups ?? []).map(group => (
                <div key={group.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{group.name}</span>
                    <span className="text-[10px] text-gray-500">
                      {group.min_select > 0 ? `Required` : 'Optional'}
                      {group.max_select ? ` · max ${group.max_select}` : ''}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {group.modifiers.map(modifier => {
                      const cartItem = cartItems.find(i => i.id === modifierModal.item.id);
                      const selected = cartItem?.selected_modifiers.some(m => m.id === modifier.id) ?? false;
                      return (
                        <button
                          key={modifier.id}
                          onClick={() => toggleModifier(modifierModal.item.id, modifier)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all
                            ${selected ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-gray-300 hover:border-white/20'}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all
                              ${selected ? 'border-indigo-400 bg-indigo-400' : 'border-gray-600'}`}>
                              {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </div>
                            <span className="text-sm">{modifier.name}</span>
                          </div>
                          {modifier.price_adjust !== 0 && (
                            <span className={`text-xs font-medium ${modifier.price_adjust > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {modifier.price_adjust > 0 ? '+' : ''}{formatPrice(modifier.price_adjust)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setModifierModal(null)}
              className="mt-4 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── 4a. Customer Modal ────────────────────────────────────── */}
      {customerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-[420px] shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="font-semibold text-white">Select Customer</h3>
                <p className="text-xs text-gray-400 mt-0.5">Walk-in or registered customer</p>
              </div>
              <button onClick={() => setCustomerModal(false)} className="text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Walk-in option */}
            <button
              onClick={() => { setSelectedCustomer(null); setCustomerModal(false); }}
              className="flex items-center gap-3 mx-4 mt-4 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
            >
              <div className="bg-indigo-500/20 rounded-full p-2">
                <Users className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Walk-in Customer</p>
                <p className="text-xs text-gray-400">No customer account linked</p>
              </div>
            </button>
            {/* Search */}
            <div className="px-4 pt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by name or phone..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            {/* Customer list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
              {(customers as any[])
                .filter(c =>
                  !customerSearch ||
                  c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                  c.phone?.includes(customerSearch)
                )
                .slice(0, 30)
                .map((customer: any) => (
                  <button
                    key={customer.id}
                    onClick={() => { setSelectedCustomer(customer); setCustomerModal(false); setCustomerSearch(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left
                      ${selectedCustomer?.id === customer.id
                        ? 'bg-indigo-600/20 border-indigo-500'
                        : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'}`}
                  >
                    <div className="bg-white/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-gray-300">
                        {customer.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{customer.name}</p>
                      {customer.phone && <p className="text-xs text-gray-400">{customer.phone}</p>}
                    </div>
                  </button>
                ))}
              {(customers as any[]).length === 0 && (
                <p className="text-center text-xs text-gray-500 py-4">No customers found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 4b. Payment Modal ─────────────────────────────────────── */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-[420px] shadow-2xl overflow-hidden">
            {paymentSuccess ? (
              /* Success Screen */
              <div className="p-8 flex flex-col items-center text-center">
                <div className="bg-green-500/20 rounded-full p-4 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Payment Complete!</h2>
                <p className="text-gray-400 text-sm mb-1">Receipt #{paymentSuccess.receiptNumber}</p>
                {paymentSuccess.change > 0 && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-6 py-3 mt-4 mb-2">
                    <p className="text-xs text-green-400 mb-0.5">Change Due</p>
                    <p className="text-3xl font-bold text-green-400">{formatPrice(paymentSuccess.change)}</p>
                  </div>
                )}
                <div className="flex gap-2 w-full mt-6">
                  <button
                    onClick={handlePrint}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors"
                  >
                    <Printer className="h-4 w-4" /> Print
                  </button>
                  <button
                    onClick={handleNewOrder}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
                  >
                    <Plus className="h-4 w-4" /> New Order
                  </button>
                </div>
              </div>
            ) : (
              /* Payment Input Screen */
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <h3 className="font-semibold text-white">Payment</h3>
                  <button onClick={() => setPaymentModal(false)} className="text-gray-500 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5">
                  {/* Amount due */}
                  <div className="text-center mb-5">
                    <p className="text-xs text-gray-400 mb-1">Amount Due</p>
                    <p className="text-4xl font-bold text-white">{formatPrice(grandTotal)}</p>
                  </div>

                  {/* Method Selector */}
                  <div className="grid grid-cols-4 gap-2 mb-5">
                    {([
                      { key: 'cash', icon: <Banknote className="h-5 w-5" />, label: 'Cash' },
                      { key: 'card', icon: <CreditCard className="h-5 w-5" />, label: 'Card' },
                      { key: 'upi', icon: <Smartphone className="h-5 w-5" />, label: 'UPI' },
                      { key: 'split', icon: <Layers className="h-5 w-5" />, label: 'Split' },
                    ] as { key: PaymentMethod; icon: React.ReactNode; label: string }[]).map(m => (
                      <button
                        key={m.key}
                        onClick={() => setPaymentMethod(m.key)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all
                          ${paymentMethod === m.key ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/20 hover:text-white'}`}
                      >
                        {m.icon}
                        <span className="text-[10px] font-medium">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Method-specific inputs */}
                  {paymentMethod === 'cash' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">Cash Tendered</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                          <input
                            autoFocus
                            type="number"
                            placeholder={grandTotal.toString()}
                            value={cashTendered}
                            onChange={e => setCashTendered(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        {/* Quick amounts */}
                        <div className="grid grid-cols-4 gap-1.5 mt-2">
                          {[grandTotal, Math.ceil(grandTotal / 100) * 100, Math.ceil(grandTotal / 500) * 500, Math.ceil(grandTotal / 1000) * 1000]
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .slice(0, 4)
                            .map(amt => (
                              <button
                                key={amt}
                                onClick={() => setCashTendered(amt.toString())}
                                className="py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 font-medium transition-colors"
                              >
                                ₹{amt}
                              </button>
                            ))}
                        </div>
                      </div>
                      {cashTendered && parseFloat(cashTendered) >= grandTotal && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex justify-between items-center">
                          <span className="text-sm text-green-400">Change</span>
                          <span className="text-lg font-bold text-green-400">{formatPrice(changeDue)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentMethod === 'card' && (
                    <div className="bg-white/5 rounded-xl p-4 text-center text-gray-400 text-sm border border-white/10">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 text-indigo-400" />
                      <p>Process card payment on the terminal</p>
                      <p className="text-xs text-gray-500 mt-1">Then tap Confirm below</p>
                    </div>
                  )}

                  {paymentMethod === 'upi' && (
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">UPI Reference / Transaction ID</label>
                      <input
                        autoFocus
                        type="text"
                        placeholder="UTR / UPI Ref No."
                        value={upiRef}
                        onChange={e => setUpiRef(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  {paymentMethod === 'split' && (
                    <div className="space-y-2">
                      {splitPayments.map((sp, idx) => (
                        <div key={idx} className="flex gap-2">
                          <select
                            value={sp.method}
                            onChange={e => {
                              const updated = [...splitPayments];
                              updated[idx] = { ...updated[idx], method: e.target.value as any };
                              setSplitPayments(updated);
                            }}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 flex-shrink-0"
                          >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="upi">UPI</option>
                          </select>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                            <input
                              type="number"
                              placeholder="Amount"
                              value={sp.amount}
                              onChange={e => {
                                const updated = [...splitPayments];
                                updated[idx] = { ...updated[idx], amount: e.target.value };
                                setSplitPayments(updated);
                              }}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-gray-500">Allocated: ₹{splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toFixed(2)}</span>
                        <span className={`font-medium ${splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) >= grandTotal ? 'text-green-400' : 'text-amber-400'}`}>
                          Remaining: ₹{Math.max(0, grandTotal - splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Confirm */}
                  <button
                    onClick={handleCharge}
                    disabled={createOrderMutation.isPending}
                    className="w-full mt-5 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {createOrderMutation.isPending ? (
                      <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        Confirm Payment
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
