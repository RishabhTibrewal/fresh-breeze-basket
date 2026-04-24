import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Badge } from "@/components/ui/badge";
import {
  Plus, Minus, Trash2, ShoppingCart, Printer,
  X, Search, ChevronLeft, ChevronRight,
  Store, History, Users, UserPlus,
  Settings, LogOut, CreditCard, Smartphone,
  Banknote, Layers, CheckCircle2, Tag,
  MapPin, Package, Pencil, ChevronDown,
  SlidersHorizontal, Receipt, BarChart3, User,
  Loader2, Play, Calendar, Download, Utensils, Filter, FileDown
} from "lucide-react";
import { toast } from "sonner";
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { warehousesService } from '@/api/warehouses';
import { invoicesService } from '@/api/invoices';
import {
  downloadReport,
  reportsApi,
  type ReportFilter,
  type SalesProductWiseRow,
} from '@/api/reports';
import PosAnalyticsBatchAWidgets from './PosAnalyticsBatchAWidgets';
import PosAnalyticsBatchBWidgets from './PosAnalyticsBatchBWidgets';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

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
const toLocalDate = (value: Date = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function Sparkline({
  values,
  className = "h-6 w-20",
}: {
  values: number[];
  className?: string;
}) {
  const safe = values.length ? values : [0];
  const max = Math.max(...safe, 1);
  const points = safe.map((v, i) => {
    const x = safe.length === 1 ? 0 : (i / (safe.length - 1)) * 100;
    const y = 100 - (v / max) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none" aria-hidden="true">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreatePOSOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  const canViewAllPosSessions = (profile?.roles || []).includes('admin') || profile?.role === 'admin';

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
  const [orderStatus, setOrderStatus] = useState<'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'>('delivered');
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
  const [historyDetailsOrderId, setHistoryDetailsOrderId] = useState<string | null>(null);

  // ── outlet ──
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [outletDropdownOpen, setOutletDropdownOpen] = useState(false);

  // ── settings ──
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_settings') || '{"autoPrint":true,"theme":"dark"}');
    } catch {
      return { autoPrint: true, theme: 'dark' };
    }
  });
  const updateSetting = (key: string, val: any) => {
    const newOpts = { ...settings, [key]: val };
    setSettings(newOpts);
    localStorage.setItem('pos_settings', JSON.stringify(newOpts));
  };

  // ── customer ──
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  
  // ── add customer modal ──
  const [addCustomerModal, setAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

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
  const [sellingView, setSellingView] = useState<'top' | 'low'>('top');
  const [chartView, setChartView] = useState<'hourly' | 'daily' | 'weekly'>('hourly');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'session'>('daily');
  const [comparisonMode, setComparisonMode] = useState(true);
  const [segmentation, setSegmentation] = useState<'none' | 'cashier' | 'outlet' | 'fulfillment'>('none');
  const [segmentValue, setSegmentValue] = useState<string>('all');
  const [selectedTrendBucket, setSelectedTrendBucket] = useState<string | null>(null);
  const [selectedItemDrilldown, setSelectedItemDrilldown] = useState<{ productId: string; variantId?: string; name: string } | null>(null);
  const todayDate = toLocalDate();
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyOutletId, setHistoryOutletId] = useState('');
  const reportSnapshotRef = useRef<HTMLDivElement>(null);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const { data: activeSession, refetch: refetchSession } = useQuery({
    queryKey: ['pos-active-session'],
    queryFn: async () => {
      const res = await apiClient.get('/pos/sessions/active');
      return res.data?.data || null;
    },
  });

  const { data: posOrders = [], isLoading: posOrdersLoading } = useQuery({
    queryKey: ['pos-history', canViewAllPosSessions ? 'all-sessions' : activeSession?.id],
    queryFn: async () => {
      const params: Record<string, any> = {
        order_source: 'pos',
        limit: 1000,
      };

      if (!canViewAllPosSessions && activeSession?.id) {
        params.pos_session_id = activeSession.id;
      }

      const res = await apiClient.get('/orders', {
        params
      });
      return res.data?.data || [];
    },
    enabled: canViewAllPosSessions || !!activeSession?.id
  });

  const { data: historyOrderDetails, isLoading: historyOrderDetailsLoading } = useQuery({
    queryKey: ['pos-order-details', historyDetailsOrderId],
    queryFn: async () => {
      if (!historyDetailsOrderId) return null;
      const res = await apiClient.get(`/orders/${historyDetailsOrderId}`);
      return res.data?.data || res.data || null;
    },
    enabled: !!historyDetailsOrderId,
  });

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
      const res = await apiClient.get('/customers', { params: { limit: 200, source: 'pos' } });
      return res.data?.data || res.data || [];
    },
    staleTime: 30000,
  });

  const reportDisplayFilters = useMemo(() => {
    let fromDate = todayDate;
    let toDate = todayDate;
    const hasCustomDateRange = Boolean(reportDateFrom || reportDateTo);

    if (!hasCustomDateRange && reportPeriod === 'session' && activeSession?.opened_at) {
      fromDate = toLocalDate(new Date(activeSession.opened_at));
    } else if (!hasCustomDateRange && reportPeriod === 'weekly') {
      fromDate = toLocalDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    } else if (!hasCustomDateRange && reportPeriod === 'monthly') {
      fromDate = toLocalDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    }

    return {
      from_date: reportDateFrom || fromDate,
      to_date: reportDateTo || toDate,
      pos_session_id: (reportPeriod === 'session' || !canViewAllPosSessions) && activeSession?.id
        ? activeSession.id
        : null,
    };
  }, [todayDate, reportDateFrom, reportDateTo, reportPeriod, canViewAllPosSessions, activeSession?.id, activeSession?.opened_at]);

  const filteredPosOrders = useMemo(() => {
    const orders = Array.isArray(posOrders) ? posOrders : [];
    const fromDate = reportDisplayFilters.from_date ? new Date(`${reportDisplayFilters.from_date}T00:00:00`) : null;
    const toDate = reportDisplayFilters.to_date ? new Date(`${reportDisplayFilters.to_date}T23:59:59.999`) : null;

    return orders.filter((order: any) => {
      if (reportDisplayFilters.pos_session_id && order?.pos_session_id !== reportDisplayFilters.pos_session_id) {
        return false;
      }
      if (!order?.created_at) return false;
      const orderDate = new Date(order.created_at);
      if (Number.isNaN(orderDate.getTime())) return false;
      if (fromDate && orderDate < fromDate) return false;
      if (toDate && orderDate > toDate) return false;
      return true;
    });
  }, [posOrders, reportDisplayFilters]);

  const outletFilteredOrders = useMemo(() => {
    const baseOrders = Array.isArray(posOrders) ? posOrders : [];
    if (!selectedOutletId) return baseOrders;
    return baseOrders.filter((order: any) => order.outlet_id === selectedOutletId);
  }, [posOrders, selectedOutletId]);

  const historyFilteredOrders = useMemo(() => {
    const baseOrders = Array.isArray(posOrders) ? posOrders : [];
    const fromDate = historyDateFrom ? new Date(`${historyDateFrom}T00:00:00`) : null;
    const toDate = historyDateTo ? new Date(`${historyDateTo}T23:59:59.999`) : null;

    return baseOrders.filter((order: any) => {
      if (historyOutletId && order.outlet_id !== historyOutletId) return false;
      if (!fromDate && !toDate) return true;
      const dtRaw = order?.created_at || order?.createdAt || order?.order_date;
      if (!dtRaw) return false;
      const dt = new Date(dtRaw);
      if (Number.isNaN(dt.getTime())) return false;
      if (fromDate && dt < fromDate) return false;
      if (toDate && dt > toDate) return false;
      return true;
    });
  }, [posOrders, historyDateFrom, historyDateTo, historyOutletId]);

  const reportOrders = useMemo(() => {
    if (!selectedOutletId) return filteredPosOrders;
    return filteredPosOrders.filter((order: any) => order.outlet_id === selectedOutletId);
  }, [filteredPosOrders, selectedOutletId]);

  const segmentOptions = useMemo(() => {
    if (segmentation === 'none') return [];
    const map = new Map<string, string>();
    reportOrders.forEach((order: any) => {
      if (segmentation === 'cashier') {
        const id = String(order.created_by || order.user_id || order.cashier_id || 'unknown');
        const name = order?.profiles?.first_name
          ? `${order.profiles.first_name} ${order.profiles.last_name || ''}`.trim()
          : (order.cashier_name || 'Unknown Cashier');
        map.set(id, name);
      } else if (segmentation === 'outlet') {
        const id = String(order.outlet_id || 'unknown');
        const name = order.outlet_name || (warehouses as any[]).find((w: any) => w.id === id)?.name || 'Unknown Outlet';
        map.set(id, name);
      } else if (segmentation === 'fulfillment') {
        const key = String(order.fulfillment_type || order.order_type_label || 'unknown');
        map.set(key, key.replace(/_/g, ' '));
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [segmentation, reportOrders, warehouses]);

  useEffect(() => {
    setSegmentValue('all');
  }, [segmentation]);

  const segmentedReportOrders = useMemo(() => {
    if (segmentation === 'none' || segmentValue === 'all') return reportOrders;
    return reportOrders.filter((order: any) => {
      if (segmentation === 'cashier') {
        const id = String(order.created_by || order.user_id || order.cashier_id || 'unknown');
        return id === segmentValue;
      }
      if (segmentation === 'outlet') {
        return String(order.outlet_id || 'unknown') === segmentValue;
      }
      const key = String(order.fulfillment_type || order.order_type_label || 'unknown');
      return key === segmentValue;
    });
  }, [reportOrders, segmentation, segmentValue]);

  const trendFilteredOrders = useMemo(() => {
    if (!selectedTrendBucket) return segmentedReportOrders;
    return segmentedReportOrders.filter((order: any) => {
      const createdAtRaw = order?.created_at || order?.createdAt || order?.order_date;
      if (!createdAtRaw) return false;
      const dt = new Date(createdAtRaw);
      if (Number.isNaN(dt.getTime())) return false;
      if (chartView === 'hourly') return `h-${dt.getHours()}` === selectedTrendBucket;
      if (chartView === 'daily') return toLocalDate(dt) === selectedTrendBucket;
      const day = dt.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);
      return `w-${toLocalDate(monday)}` === selectedTrendBucket;
    });
  }, [segmentedReportOrders, selectedTrendBucket, chartView]);

  const isDateRangeSelected = useMemo(() => {
    return Boolean(reportDateFrom && reportDateTo && reportDateFrom !== reportDateTo);
  }, [reportDateFrom, reportDateTo]);

  const chartBaseDate = useMemo(() => {
    return reportDisplayFilters.from_date || reportDisplayFilters.to_date || todayDate;
  }, [reportDisplayFilters, todayDate]);

  useEffect(() => {
    if (isDateRangeSelected && chartView === 'hourly') {
      setChartView('daily');
    }
  }, [isDateRangeSelected, chartView]);

  useEffect(() => {
    setSelectedTrendBucket(null);
  }, [chartView, reportPeriod, reportDateFrom, reportDateTo, selectedOutletId, segmentation, segmentValue]);

  const sellingItems = useMemo(() => {
    const map = new Map<string, { product_id: string; variant_id?: string; name: string; sold: number; revenue: number }>();
    trendFilteredOrders.forEach((order: any) => {
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      items.forEach((item: any) => {
        const key = `${item.product_id}::${item.variant_id || ''}`;
        const variantName = item.variant_name && item.variant_name !== '—' ? ` (${item.variant_name})` : '';
        const name = item.product_name ? `${item.product_name}${variantName}` : (item.name || 'Unknown item');
        if (!map.has(key)) {
          map.set(key, {
            product_id: item.product_id,
            variant_id: item.variant_id || undefined,
            name,
            sold: 0,
            revenue: 0,
          });
        }
        const row = map.get(key)!;
        row.sold += Number(item.quantity || 0);
        row.revenue += Number(item.line_total || item.total || Number(item.quantity || 0) * Number(item.unit_price || item.price || 0));
      });
    });
    const normalized = Array.from(map.values());
    const sorted = normalized.sort((a, b) => (
      sellingView === 'top' ? (b.sold - a.sold) : (a.sold - b.sold)
    ));
    return sorted.slice(0, 5);
  }, [trendFilteredOrders, sellingView]);

  const salesTrend = useMemo(() => {
    const toSafeNumber = (value: unknown) => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
      }
      if (typeof value === 'string') {
        // Handle formatted values like "₹1,234.50" or "1,234.50"
        const cleaned = value.replace(/[^0-9.-]/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : 0;
      }
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    const bucketMap = new Map<string, { label: string; total: number; order: number }>();
    const orders = segmentedReportOrders;
    orders.forEach((order: any) => {
      const createdAtRaw = order?.created_at || order?.createdAt || order?.order_date;
      if (!createdAtRaw) return;

      const dt = new Date(createdAtRaw);
      if (Number.isNaN(dt.getTime())) return;

      const hour = dt.getHours();
      const orderLevelTotal = toSafeNumber(
        order.total_amount ??
        order.grand_total ??
        order.final_total ??
        order.total ??
        order.subtotal
      );
      const itemsLevelTotal = Array.isArray(order.order_items)
        ? order.order_items.reduce((sum: number, item: any) => {
            const qty = toSafeNumber(item.quantity);
            const unitPrice = toSafeNumber(item.unit_price ?? item.price);
            const lineTotal = toSafeNumber(item.line_total ?? item.subtotal ?? item.total);
            return sum + (lineTotal > 0 ? lineTotal : qty * unitPrice);
          }, 0)
        : 0;

      const safeOrderTotal = orderLevelTotal > 0 ? orderLevelTotal : itemsLevelTotal;
      let key = '';
      let label = '';
      let orderKey = 0;

      if (chartView === 'hourly') {
        key = `h-${hour}`;
        label = `${String(hour).padStart(2, '0')}:00`;
        orderKey = hour;
      } else if (chartView === 'daily') {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        key = `${y}-${m}-${d}`;
        label = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        orderKey = new Date(key).getTime();
      } else {
        const day = dt.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        const monday = new Date(dt);
        monday.setDate(dt.getDate() - diffToMonday);
        monday.setHours(0, 0, 0, 0);
        const y = monday.getFullYear();
        const m = String(monday.getMonth() + 1).padStart(2, '0');
        const d = String(monday.getDate()).padStart(2, '0');
        key = `w-${y}-${m}-${d}`;
        label = `Wk ${monday.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
        orderKey = monday.getTime();
      }

      const existing = bucketMap.get(key);
      if (existing) {
        existing.total += safeOrderTotal;
      } else {
        bucketMap.set(key, { label, total: safeOrderTotal, order: orderKey });
      }
    });

    const points = (chartView === 'hourly'
      ? Array.from({ length: 24 }, (_, hour) => {
          const key = `h-${hour}`;
          const fromMap = bucketMap.get(key);
          return {
            key,
            label: `${String(hour).padStart(2, '0')}:00`,
            total: fromMap?.total || 0,
            order: hour,
          };
        })
      : Array.from(bucketMap.entries()).map(([key, value]) => ({
          key,
          label: value.label,
          total: value.total,
          order: value.order,
        })).sort((a, b) => a.order - b.order)
    );

    const maxTotal = Math.max(...points.map(b => b.total), 0);
    return {
      points: points.map(b => ({
        ...b,
        heightPct: maxTotal > 0 ? Math.max((b.total / maxTotal) * 100, b.total > 0 ? 6 : 0) : 0,
      })),
      maxTotal,
    };
  }, [segmentedReportOrders, chartView, chartBaseDate]);

  const outletWiseStats = useMemo(() => {
    const map = new Map<string, { outletId: string; outletName: string; orders: number; sales: number }>();
    const warehouseMap = new Map((warehouses as any[]).map((w: any) => [w.id, w]));

    trendFilteredOrders.forEach((order: any) => {
      const outletId = order.outlet_id || 'unknown';
      const outletMeta = warehouseMap.get(outletId);
      const outletName = outletMeta?.name || (outletId === 'unknown' ? 'Unknown Outlet' : `Outlet ${outletId.slice(0, 6)}`);
      const amount = Number(order.total_amount || 0);
      const existing = map.get(outletId);
      if (existing) {
        existing.orders += 1;
        existing.sales += Number.isFinite(amount) ? amount : 0;
      } else {
        map.set(outletId, {
          outletId,
          outletName,
          orders: 1,
          sales: Number.isFinite(amount) ? amount : 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [trendFilteredOrders, warehouses]);

  const salesTrendChartData = useMemo(() => ({
    labels: salesTrend.points.map((point: any) => point.label),
    datasets: [
      {
        label: 'Sales',
        data: salesTrend.points.map((point: any) => Number(point.total || 0)),
        backgroundColor: 'rgba(99, 102, 241, 0.75)',
        borderColor: 'rgba(129, 140, 248, 1)',
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false as const,
        maxBarThickness: 24,
      },
    ],
  }), [salesTrend.points]);

  const salesTrendChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${formatPrice(Number(ctx.parsed?.y || 0))}`,
        },
      },
    },
    onClick: (_event: unknown, elements: Array<{ index: number }>) => {
      if (!elements?.length) return;
      const idx = elements[0].index;
      const key = salesTrend.points[idx]?.key;
      if (!key) return;
      setSelectedTrendBucket((prev) => (prev === key ? null : key));
    },
    scales: {
      x: {
        ticks: {
          color: '#9ca3af',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: chartView === 'hourly' ? 8 : 6,
        },
        grid: {
          display: false,
          drawBorder: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#9ca3af',
          callback: (value: any) => formatPrice(Number(value || 0)),
        },
        grid: {
          color: 'rgba(255,255,255,0.08)',
          drawBorder: false,
        },
      },
    },
  }), [chartView, salesTrend.points]);

  const previousRange = useMemo(() => {
    if (reportPeriod === 'session') return null;
    const from = new Date(`${reportDisplayFilters.from_date}T00:00:00`);
    const to = new Date(`${reportDisplayFilters.to_date}T23:59:59.999`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    const ms = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - ms);
    return { from: toLocalDate(prevFrom), to: toLocalDate(prevTo) };
  }, [reportDisplayFilters.from_date, reportDisplayFilters.to_date, reportPeriod]);

  const previousOrders = useMemo(() => {
    if (!comparisonMode || !previousRange) return [] as any[];
    const baseOrders = Array.isArray(posOrders) ? posOrders : [];
    const from = new Date(`${previousRange.from}T00:00:00`);
    const to = new Date(`${previousRange.to}T23:59:59.999`);
    return baseOrders.filter((order: any) => {
      if (selectedOutletId && order.outlet_id !== selectedOutletId) return false;
      const createdAtRaw = order?.created_at || order?.createdAt || order?.order_date;
      if (!createdAtRaw) return false;
      const dt = new Date(createdAtRaw);
      if (Number.isNaN(dt.getTime())) return false;
      if (dt < from || dt > to) return false;
      return true;
    });
  }, [comparisonMode, previousRange, posOrders, selectedOutletId]);

  const currentRevenue = useMemo(() => trendFilteredOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0), [trendFilteredOrders]);
  const previousRevenue = useMemo(() => previousOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0), [previousOrders]);
  const currentOrdersCount = trendFilteredOrders.length;
  const previousOrdersCount = previousOrders.length;
  const currentAvgOrder = currentOrdersCount > 0 ? currentRevenue / currentOrdersCount : 0;
  const previousAvgOrder = previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0;

  const safePctDelta = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const handleSnapshotPdf = () => {
    const root = reportSnapshotRef.current;
    if (!root) return;
    const snapshotWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!snapshotWindow) {
      toast.error('Popup blocked. Please allow popups to export snapshot.');
      return;
    }
    snapshotWindow.document.write(`
      <html>
        <head>
          <title>POS Analytics Snapshot</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
            .meta { margin-bottom: 12px; font-size: 12px; color: #475569; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 12px; }
          </style>
        </head>
        <body>
          <h2>POS Analytics Snapshot</h2>
          <div class="meta">Generated at ${new Date().toLocaleString()} | Period: ${reportPeriod}</div>
          ${root.innerHTML}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    snapshotWindow.document.close();
  };

  const formatOrderDateTime = (value?: string) => {
    if (!value) return 'N/A';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const { data: modifierGroups = [] } = useQuery<ModifierGroup[]>({
    queryKey: ['modifier-groups-with-modifiers'],
    queryFn: async () => {
      const res = await apiClient.get('/modifiers');
      return res.data?.data || res.data || [];
    },
  });

  const buildPosReportFilters = (period: 'daily' | 'weekly' | 'monthly' | 'session'): ReportFilter => {
    let fromDate = todayDate;
    let toDate = todayDate;
    const hasCustomDateRange = Boolean(reportDateFrom || reportDateTo);

    if (!hasCustomDateRange && period === 'session' && activeSession?.opened_at) {
      fromDate = toLocalDate(new Date(activeSession.opened_at));
    } else if (!hasCustomDateRange && period === 'weekly') {
      fromDate = toLocalDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    } else if (!hasCustomDateRange && period === 'monthly') {
      fromDate = toLocalDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    }

    const filters: ReportFilter = {
      order_source: 'pos',
      from_date: reportDateFrom || fromDate,
      to_date: reportDateTo || toDate,
    };

    if (selectedOutletId) {
      filters.branch_ids = [selectedOutletId];
    }

    if ((period === 'session' || !canViewAllPosSessions) && activeSession?.id) {
      filters.pos_session_id = activeSession.id;
    }

    return filters;
  };

  const itemWiseFilters = useMemo<ReportFilter>(() => {
    const filters = buildPosReportFilters(reportPeriod);
    return filters;
  }, [reportPeriod, reportDateFrom, reportDateTo, selectedOutletId, canViewAllPosSessions, activeSession?.id]);

  const {
    data: itemWiseReport,
    isLoading: itemWiseLoading,
    isFetching: itemWiseFetching,
    error: itemWiseError,
  } = useQuery({
    queryKey: ['pos-item-wise-report', itemWiseFilters],
    queryFn: () => reportsApi.salesProductWise(itemWiseFilters),
    enabled: activeView === 'reports',
  });

  // ─── Batch A: High-impact POS analytics widgets ─────────────────────────────
  const posWidgetFilters = useMemo<ReportFilter>(() => buildPosReportFilters(reportPeriod), [
    reportPeriod, reportDateFrom, reportDateTo, selectedOutletId, canViewAllPosSessions, activeSession?.id,
  ]);

  const hourlyHeatmapQuery = useQuery({
    queryKey: ['pos-hourly-heatmap', posWidgetFilters],
    queryFn: () => reportsApi.salesHourlyHeatmap(posWidgetFilters),
    enabled: activeView === 'reports',
  });

  const paymentMixQuery = useQuery({
    queryKey: ['pos-payment-mix', posWidgetFilters],
    queryFn: () => reportsApi.salesPaymentMix(posWidgetFilters),
    enabled: activeView === 'reports',
  });

  const fulfillmentMixQuery = useQuery({
    queryKey: ['pos-fulfillment-mix', posWidgetFilters],
    queryFn: () => reportsApi.salesFulfillmentMix(posWidgetFilters),
    enabled: activeView === 'reports',
  });

  const discountImpactQuery = useQuery({
    queryKey: ['pos-discount-impact', posWidgetFilters],
    queryFn: () => reportsApi.salesDiscountImpact(posWidgetFilters),
    enabled: activeView === 'reports',
  });

  const cashierPerfQuery = useQuery({
    queryKey: ['pos-cashier-performance', posWidgetFilters],
    queryFn: () => reportsApi.posCashierPerformance(posWidgetFilters),
    enabled: activeView === 'reports' && canViewAllPosSessions,
  });

  const returnsQuery = useQuery({
    queryKey: ['pos-returns', posWidgetFilters],
    queryFn: () => reportsApi.salesReturns(posWidgetFilters),
    enabled: activeView === 'reports',
  });
  const returnsValue = Number(returnsQuery.data?.summary?.total_return_value ?? 0);

  const categoryBrandQuery = useQuery({
    queryKey: ['pos-category-brand', posWidgetFilters],
    queryFn: () => reportsApi.salesCategoryBrand(posWidgetFilters),
    enabled: activeView === 'reports',
  });

  const basketQuery = useQuery({
    queryKey: ['pos-basket-metrics', posWidgetFilters],
    queryFn: () => reportsApi.salesBasketMetrics(posWidgetFilters),
    enabled: activeView === 'reports',
  });

  const modifierQuery = useQuery({
    queryKey: ['pos-modifier-revenue', posWidgetFilters],
    queryFn: () => reportsApi.salesModifierRevenue(posWidgetFilters),
    enabled: activeView === 'reports',
  });

  const trendComparisonQuery = useQuery({
    queryKey: ['pos-trend-comparison', posWidgetFilters],
    queryFn: () => reportsApi.salesTrendComparison(posWidgetFilters),
    enabled: activeView === 'reports',
  });

  const moversQuery = useQuery({
    queryKey: ['pos-movers', posWidgetFilters],
    queryFn: () => reportsApi.salesMovers(posWidgetFilters),
    enabled: activeView === 'reports',
  });

  const outletLeaderboardQuery = useQuery({
    queryKey: ['pos-outlet-leaderboard', posWidgetFilters],
    queryFn: () => reportsApi.salesOutletLeaderboard(posWidgetFilters),
    enabled: activeView === 'reports' && canViewAllPosSessions,
  });

  // ─── Derived memos that depend on itemWiseReport (must come after its useQuery) ─
  const itemWiseRows = useMemo(() => {
    const rows = (itemWiseReport?.data || []) as SalesProductWiseRow[];
    const bucketItemKeys = new Set<string>();
    trendFilteredOrders.forEach((order: any) => {
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      items.forEach((item: any) => {
        bucketItemKeys.add(`${item.product_id}::${item.variant_id || ''}`);
      });
    });

    let filtered = rows;
    if (selectedTrendBucket) {
      filtered = filtered.filter((row) => bucketItemKeys.has(`${row.product_id}::${row.variant_id || ''}`));
    }
    if (selectedItemDrilldown) {
      filtered = filtered.filter((row) => row.product_id === selectedItemDrilldown.productId
        && String(row.variant_id || '') === String(selectedItemDrilldown.variantId || ''));
    }
    return filtered;
  }, [itemWiseReport?.data, selectedItemDrilldown, trendFilteredOrders, selectedTrendBucket]);

  const buildItemSparkline = (row: SalesProductWiseRow) => {
    const dayMap = new Map<string, number>();
    trendFilteredOrders.forEach((order: any) => {
      const day = toLocalDate(new Date(order.created_at || order.order_date || new Date()));
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      let revenue = 0;
      items.forEach((item: any) => {
        if (item.product_id !== row.product_id) return;
        if (row.variant_id && String(item.variant_id || '') !== String(row.variant_id || '')) return;
        revenue += Number(item.line_total || item.total || Number(item.quantity || 0) * Number(item.unit_price || item.price || 0));
      });
      if (revenue > 0) dayMap.set(day, (dayMap.get(day) || 0) + revenue);
    });
    const days = Array.from(dayMap.keys()).sort();
    return days.slice(-7).map((d) => dayMap.get(d) || 0);
  };

  const drilldownDetails = useMemo(() => {
    if (!selectedItemDrilldown) return null;
    const dayRevenue = new Map<string, number>();
    const outletRevenue = new Map<string, number>();
    let qty = 0;
    let revenue = 0;
    let orderCount = 0;
    trendFilteredOrders.forEach((order: any) => {
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      let matchedRevenue = 0;
      let matchedQty = 0;
      items.forEach((item: any) => {
        if (item.product_id !== selectedItemDrilldown.productId) return;
        if (selectedItemDrilldown.variantId && String(item.variant_id || '') !== String(selectedItemDrilldown.variantId || '')) return;
        const lineRevenue = Number(item.line_total || item.total || Number(item.quantity || 0) * Number(item.unit_price || item.price || 0));
        const lineQty = Number(item.quantity || 0);
        matchedRevenue += lineRevenue;
        matchedQty += lineQty;
      });
      if (matchedRevenue > 0) {
        orderCount += 1;
        revenue += matchedRevenue;
        qty += matchedQty;
        const day = toLocalDate(new Date(order.created_at || order.order_date || new Date()));
        dayRevenue.set(day, (dayRevenue.get(day) || 0) + matchedRevenue);
        const outlet = order.outlet_name || (warehouses as any[]).find((w: any) => w.id === order.outlet_id)?.name || 'Unknown Outlet';
        outletRevenue.set(outlet, (outletRevenue.get(outlet) || 0) + matchedRevenue);
      }
    });
    return {
      qty,
      revenue,
      orderCount,
      trend: Array.from(dayRevenue.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-7),
      outlets: Array.from(outletRevenue.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [selectedItemDrilldown, trendFilteredOrders, warehouses]);

  const handleDownloadPosWidget = async (endpoint: string, label: string) => {
    const toastId = `pos-widget-${endpoint}`;
    try {
      toast.loading(`Preparing ${label}…`, { id: toastId });
      await downloadReport(endpoint, 'excel', posWidgetFilters);
      toast.success(`${label} downloaded`, { id: toastId });
    } catch (err) {
      console.error('Widget download error:', err);
      toast.error(`Failed to download ${label}`, { id: toastId });
    }
  };

  const handleDownloadReport = async (period: 'daily' | 'weekly' | 'monthly' | 'session') => {
    try {
      const params = buildPosReportFilters(period);

      toast.loading(`Preparing ${period} report...`, { id: 'report-download' });

      const response = await apiClient.get('/reports/sales/order-summary', {
        params: { ...params, export: 'excel' },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `pos_report_${period}_${todayDate}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`${period.charAt(0).toUpperCase() + period.slice(1)} report downloaded`, { id: 'report-download' });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download report', { id: 'report-download' });
    }
  };

  const handleDownloadItemWiseReport = async () => {
    try {
      toast.loading('Preparing item-wise report...', { id: 'item-wise-report-download' });
      await downloadReport('/reports/sales/product-wise', 'excel', itemWiseFilters);
      toast.success('Item-wise report downloaded', { id: 'item-wise-report-download' });
    } catch (error) {
      console.error('Item-wise download error:', error);
      toast.error('Failed to download item-wise report', { id: 'item-wise-report-download' });
    }
  };

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
  const rawTax = cartItems.reduce((s, item) => {
    const modifierAdj = item.selected_modifiers.reduce((a, m) => a + m.price_adjust, 0);
    const base = (item.unit_price + modifierAdj) * item.quantity;
    return s + base * (item.tax_percentage / 100);
  }, 0);
  const taxAmount = parseFloat((rawTax * (1 - effectiveDiscount / 100)).toFixed(2));
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
      // Merge if same variant is already in cart with same price and NO modifiers selected
      const existing = prev.find(i => 
        i.variant_id === variant.variant_id && 
        i.unit_price === price && // Ensure price matches (important for custom prices)
        i.selected_modifiers.length === 0
      );
      if (existing) {
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
    setOrderStatus('delivered');
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

  const startSessionMutation = useMutation({
    mutationFn: async (openingCash: number) => {
      const outletId = selectedOutletId || (warehouses[0] as any)?.id;
      if (!outletId) {
        throw new Error('Please select an outlet before starting session');
      }
      const res = await apiClient.post('/pos/sessions', {
        outlet_id: outletId,
        opening_cash: openingCash
      });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Session started');
      refetchSession();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to start session')
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string }) => {
      const res = await apiClient.post('/customers', { ...data, source: 'pos' });
      return res.data?.data || res.data;
    },
    onSuccess: (newCust) => {
      toast.success('Customer added');
      queryClient.invalidateQueries({ queryKey: ['pos-customers'] });
      setSelectedCustomer(newCust);
      setAddCustomerModal(false);
      setNewCustomer({ name: '', phone: '' });
      if (!activeView || activeView === 'sale') setCustomerModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add customer')
  });

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
        pos_session_id: activeSession?.id || null,
        status: orderStatus,
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
      queryClient.invalidateQueries({ queryKey: ['pos-history'] });
      queryClient.invalidateQueries({ queryKey: ['pos-variants'] });
      queryClient.invalidateQueries({ queryKey: ['pos-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
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

  const handlePrintKitchenKOT = async () => {
    if (!paymentSuccess?.orderId) return;
    try {
      const html = await invoicesService.getKitchenKOTHTML(paymentSuccess.orderId);
      await invoicesService.printHTML(html);
    } catch {
      toast.error('Could not open Kitchen KOT');
    }
  };

  const handlePrintCustomerBill = async () => {
    if (!paymentSuccess?.orderId) return;
    try {
      const html = await invoicesService.getCustomerKOTHTML(paymentSuccess.orderId);
      await invoicesService.printHTML(html);
    } catch {
      toast.error('Could not open Customer Bill');
    }
  };

  const handlePrintHistoryBill = async () => {
    if (!historyDetailsOrderId) return;
    try {
      const html = await invoicesService.getCustomerKOTHTML(historyDetailsOrderId);
      await invoicesService.printHTML(html);
    } catch {
      toast.error('Could not open Customer Bill');
    }
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
      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden relative">
        
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
                  if (tab.key === 'delivery') {
                    setOrderStatus('pending');
                    setDeliveryModal(true);
                  } else {
                    setOrderStatus('delivered');
                  }
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
          <div className="flex-1 min-h-0 flex flex-col bg-[#0f1117] p-6 overflow-hidden">
            <header className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Order History</h2>
                <p className="text-gray-500 text-sm">Review recent POS transactions</p>
              </div>
            </header>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                <label className="text-[11px] text-gray-400 whitespace-nowrap">Outlet</label>
                <select
                  value={historyOutletId}
                  onChange={(e) => setHistoryOutletId(e.target.value)}
                  className="bg-transparent text-xs text-white border border-white/10 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">All Outlets</option>
                  {(warehouses as any[]).map((w: any) => (
                    <option key={w.id} value={w.id} className="bg-[#1a1d27] text-white">
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="bg-transparent text-xs text-white border border-white/10 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
                  aria-label="History from date"
                />
                <span className="text-gray-500 text-xs">to</span>
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="bg-transparent text-xs text-white border border-white/10 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
                  aria-label="History to date"
                />
                {(historyDateFrom || historyDateTo || historyOutletId) && (
                  <button
                    onClick={() => {
                      setHistoryDateFrom('');
                      setHistoryDateTo('');
                      setHistoryOutletId('');
                    }}
                    className="text-[10px] text-indigo-300 hover:text-indigo-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 min-h-0 bg-[#1a1d27] border border-white/10 rounded-2xl overflow-auto">
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
                   {posOrdersLoading ? (
                     <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading orders...</td></tr>
                   ) : historyFilteredOrders.length === 0 ? (
                     <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No recent POS orders</td></tr>
                   ) : (
                     historyFilteredOrders.map((order: any) => (
                       <tr key={order.id} className="hover:bg-white/5 transition-colors">
                         <td className="px-6 py-4 font-medium">{order.receipt_number || `POS-${order.id.slice(0, 5)}`}</td>
                         <td className="px-6 py-4 text-gray-400">
                           {order.profiles?.first_name ? `${order.profiles.first_name} ${order.profiles.last_name || ''}` : (order.customer?.name || 'Walk-in Customer')}
                         </td>
                         <td className="px-6 py-4 font-bold text-indigo-400">{formatPrice(order.total_amount)}</td>
                         <td className="px-6 py-4">
                           <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${order.payment_status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                             {order.payment_status?.toUpperCase() || 'UNKNOWN'}
                           </span>
                         </td>
                         <td className="px-6 py-4">
                          <button 
                            onClick={() => setHistoryDetailsOrderId(order.id)}
                             className="text-indigo-400 hover:text-indigo-300 text-sm"
                           >
                             Details
                           </button>
                         </td>
                       </tr>
                     ))
                   )}
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
              <button 
                onClick={() => setAddCustomerModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" /> Add New Customer
              </button>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(customers as any[]).map((customer: any) => (
                <div key={customer.id} className="bg-[#1a1d27] border border-white/10 p-4 rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-indigo-600/20 rounded-full w-10 h-10 flex items-center justify-center">
                      <User className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-bold">{customer.name}</h3>
                      <p className="text-xs text-gray-500">{customer.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs pt-3 border-t border-white/5">
                    <span className="text-gray-500">Total Visits: {customer.totalOrders || 0}</span>
                    <span className="text-indigo-400 font-bold">{formatPrice(customer.totalSpent || 0)} Spent</span>
                  </div>
                </div>
              ))}
              {(customers as any[]).length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-400">
                  No customers found. Click 'Add New Customer' to create one.
                </div>
              )}
            </div>
          </div>
        )}

        {/* REPORTS VIEW */}
        {activeView === 'reports' && (
          <div ref={reportSnapshotRef} className="flex-1 flex flex-col bg-[#0f1117] p-6 overflow-y-auto">
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">POS Analytics</h2>
                <p className="text-gray-500 text-sm">Session sales and performance metrics</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
                  {[
                    { key: 'today', label: 'Today' },
                    { key: 'yesterday', label: 'Yesterday' },
                    { key: 'this_week', label: 'This Week' },
                    { key: 'last_week', label: 'Last Week' },
                    { key: 'this_month', label: 'This Month' },
                    { key: 'mtd', label: 'MTD' },
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => {
                        const now = new Date();
                        const today = toLocalDate(now);
                        if (preset.key === 'today') {
                          setReportDateFrom(today); setReportDateTo(today); setReportPeriod('daily');
                        } else if (preset.key === 'yesterday') {
                          const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                          const y = toLocalDate(d);
                          setReportDateFrom(y); setReportDateTo(y); setReportPeriod('daily');
                        } else if (preset.key === 'this_week') {
                          const day = now.getDay();
                          const diff = day === 0 ? 6 : day - 1;
                          const monday = new Date(now);
                          monday.setDate(now.getDate() - diff);
                          setReportDateFrom(toLocalDate(monday)); setReportDateTo(today); setReportPeriod('weekly');
                        } else if (preset.key === 'last_week') {
                          const day = now.getDay();
                          const diff = day === 0 ? 6 : day - 1;
                          const thisMonday = new Date(now);
                          thisMonday.setDate(now.getDate() - diff);
                          const lastMonday = new Date(thisMonday);
                          lastMonday.setDate(thisMonday.getDate() - 7);
                          const lastSunday = new Date(thisMonday);
                          lastSunday.setDate(thisMonday.getDate() - 1);
                          setReportDateFrom(toLocalDate(lastMonday)); setReportDateTo(toLocalDate(lastSunday)); setReportPeriod('weekly');
                        } else if (preset.key === 'this_month') {
                          const start = new Date(now.getFullYear(), now.getMonth(), 1);
                          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                          setReportDateFrom(toLocalDate(start)); setReportDateTo(toLocalDate(end)); setReportPeriod('monthly');
                        } else if (preset.key === 'mtd') {
                          const start = new Date(now.getFullYear(), now.getMonth(), 1);
                          setReportDateFrom(toLocalDate(start)); setReportDateTo(today); setReportPeriod('monthly');
                        }
                      }}
                      className="px-2 py-1 text-[11px] rounded-md transition-colors text-gray-300 hover:text-white"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                  <label className="text-[11px] text-gray-400 whitespace-nowrap">Outlet</label>
                  <select
                    value={selectedOutletId}
                    onChange={(e) => setSelectedOutletId(e.target.value)}
                    className="bg-transparent text-xs text-white border border-white/10 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">All Outlets</option>
                    {(warehouses as any[]).map((w: any) => (
                      <option key={w.id} value={w.id} className="bg-[#1a1d27] text-white">
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                  <input
                    type="date"
                    value={reportDateFrom}
                    onChange={(e) => setReportDateFrom(e.target.value)}
                    className="bg-transparent text-xs text-white border border-white/10 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
                    aria-label="From date"
                  />
                  <span className="text-gray-500 text-xs">to</span>
                  <input
                    type="date"
                    value={reportDateTo}
                    onChange={(e) => setReportDateTo(e.target.value)}
                    className="bg-transparent text-xs text-white border border-white/10 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
                    aria-label="To date"
                  />
                  {(reportDateFrom || reportDateTo) && (
                    <button
                      onClick={() => { setReportDateFrom(''); setReportDateTo(''); }}
                      className="text-[10px] text-indigo-300 hover:text-indigo-200"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
                  {(['daily', 'weekly', 'monthly', 'session'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setReportPeriod(period)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        reportPeriod === period ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1 items-center gap-1 px-2">
                  <Filter className="h-3.5 w-3.5 text-gray-400" />
                  <select
                    value={segmentation}
                    onChange={(e) => setSegmentation(e.target.value as 'none' | 'cashier' | 'outlet' | 'fulfillment')}
                    className="bg-transparent text-xs text-white border border-white/10 rounded px-2 py-1"
                  >
                    <option value="none" className="bg-[#1a1d27]">No Segment</option>
                    <option value="cashier" className="bg-[#1a1d27]">By Cashier</option>
                    <option value="outlet" className="bg-[#1a1d27]">By Outlet</option>
                    <option value="fulfillment" className="bg-[#1a1d27]">By Fulfillment</option>
                  </select>
                  {segmentation !== 'none' && (
                    <select
                      value={segmentValue}
                      onChange={(e) => setSegmentValue(e.target.value)}
                      className="bg-transparent text-xs text-white border border-white/10 rounded px-2 py-1"
                    >
                      <option value="all" className="bg-[#1a1d27]">All</option>
                      {segmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#1a1d27]">{opt.label}</option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  onClick={() => setComparisonMode((v) => !v)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                    comparisonMode
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                      : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  {comparisonMode ? 'This vs Previous' : 'Current only'}
                </button>
                <button
                  onClick={() => handleDownloadReport(reportPeriod)}
                  className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Report
                </button>
                <button
                  onClick={handleSnapshotPdf}
                  className="h-8 bg-violet-600 hover:bg-violet-500 text-white px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Snapshot PDF
                </button>
              </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[
                {
                  label: 'Total Sales',
                  value: formatPrice(currentRevenue),
                  trend: comparisonMode ? `${safePctDelta(currentRevenue, previousRevenue) >= 0 ? '↑' : '↓'} ${Math.abs(safePctDelta(currentRevenue, previousRevenue)).toFixed(1)}%` : 'Current',
                  color: safePctDelta(currentRevenue, previousRevenue) >= 0 ? 'emerald' : 'red',
                },
                {
                  label: 'Orders',
                  value: currentOrdersCount.toString(),
                  trend: comparisonMode ? `${safePctDelta(currentOrdersCount, previousOrdersCount) >= 0 ? '↑' : '↓'} ${Math.abs(safePctDelta(currentOrdersCount, previousOrdersCount)).toFixed(1)}%` : 'Current',
                  color: safePctDelta(currentOrdersCount, previousOrdersCount) >= 0 ? 'emerald' : 'red',
                },
                {
                  label: 'Avg Order',
                  value: formatPrice(currentAvgOrder),
                  trend: comparisonMode ? `${safePctDelta(currentAvgOrder, previousAvgOrder) >= 0 ? '↑' : '↓'} ${Math.abs(safePctDelta(currentAvgOrder, previousAvgOrder)).toFixed(1)}%` : 'Target',
                  color: currentAvgOrder < 250 ? 'red' : 'amber',
                },
                {
                  label: 'Returns',
                  value: formatPrice(returnsValue),
                  trend: returnsValue > currentRevenue * 0.08 ? 'High' : 'Healthy',
                  color: returnsValue > currentRevenue * 0.08 ? 'red' : 'emerald',
                },
              ].map((stat, i) => (
                <div key={i} className="bg-[#1a1d27] border border-white/10 p-5 rounded-3xl">
                  <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                  <div className="flex items-end justify-between">
                    <h3 className="text-2xl font-black">{stat.value}</h3>
                    <span className={`text-[10px] font-bold ${stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'red' ? 'text-red-400' : 'text-amber-400'}`}>{stat.trend}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl min-h-[300px]">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold">Sales Trend</h3>
                  <span className="text-[10px] text-gray-500">{selectedTrendBucket ? `Filtered: ${selectedTrendBucket}` : 'Click bar to filter'}</span>
                </div>
                <div className="mb-4 inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
                  {(['hourly', 'daily', 'weekly'] as const)
                    .filter((view) => !(isDateRangeSelected && view === 'hourly'))
                    .map((view) => (
                    <button
                      key={view}
                      onClick={() => setChartView(view)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        chartView === view ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      {view.charAt(0).toUpperCase() + view.slice(1)}
                    </button>
                  ))}
                </div>
                {reportOrders.length === 0 ? (
                  <div className="h-[220px] flex items-center justify-center text-center">
                    <div>
                      <BarChart3 className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm font-medium">No sales data to visualize yet</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-[220px]">
                    <Bar data={salesTrendChartData} options={salesTrendChartOptions} />
                  </div>
                )}
              </div>
              <div className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">{sellingView === 'top' ? 'Top Selling Items' : 'Low Selling Items'}</h3>
                  <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
                    <button
                      onClick={() => setSellingView('top')}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        sellingView === 'top' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      Top
                    </button>
                    <button
                      onClick={() => setSellingView('low')}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        sellingView === 'low' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      Low
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {sellingItems.length > 0 ? (
                    sellingItems.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedItemDrilldown({ productId: item.product_id, variantId: item.variant_id, name: item.name })}
                        className="w-full text-left flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg px-2"
                      >
                         <div>
                           <p className="text-sm font-medium">{item.name}</p>
                           <p className="text-[10px] text-gray-500">{item.sold} units sold</p>
                         </div>
                         <p className="font-bold text-indigo-400">{formatPrice(item.revenue)}</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-center py-4 text-gray-500 text-sm">No sales data available</p>
                  )}
                </div>
              </div>
            </div>

            {selectedItemDrilldown && drilldownDetails && (
              <div className="mt-6 bg-[#1a1d27] border border-indigo-500/20 p-6 rounded-3xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold">Item Drilldown</h3>
                    <p className="text-[11px] text-gray-500 mt-1">{selectedItemDrilldown.name} · trend + outlet contribution</p>
                  </div>
                  <button
                    onClick={() => setSelectedItemDrilldown(null)}
                    className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Revenue</p>
                    <p className="text-lg font-bold text-indigo-300">{formatPrice(drilldownDetails.revenue)}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Qty Sold</p>
                    <p className="text-lg font-bold text-white">{drilldownDetails.qty}</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Orders</p>
                    <p className="text-lg font-bold text-white">{drilldownDetails.orderCount}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-300 mb-2">Last 7 days trend</p>
                    <div className="h-20 text-indigo-300">
                      <Sparkline values={drilldownDetails.trend.map((x) => x[1])} className="h-20 w-full" />
                    </div>
                    <div className="mt-2 text-[10px] text-gray-500 flex flex-wrap gap-2">
                      {drilldownDetails.trend.map(([day, value]) => (
                        <span key={day}>{day}: {formatPrice(value)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-300 mb-2">Contributing outlets</p>
                    <div className="space-y-2">
                      {drilldownDetails.outlets.map(([outlet, value]) => (
                        <div key={outlet} className="flex items-center justify-between text-sm border-b border-white/5 pb-1">
                          <span className="text-gray-200">{outlet}</span>
                          <span className="font-semibold text-indigo-300">{formatPrice(value)}</span>
                        </div>
                      ))}
                      {drilldownDetails.outlets.length === 0 && (
                        <p className="text-xs text-gray-500">No outlet split available for this item.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Outlet-wise POS Performance</h3>
                <span className="text-[10px] text-gray-500">Date-filtered view</span>
              </div>
              {outletWiseStats.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No outlet data available for selected range</p>
              ) : (
                <div className="space-y-2">
                  {outletWiseStats.map((outlet) => (
                    <div
                      key={outlet.outletId}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                        selectedOutletId && selectedOutletId === outlet.outletId
                          ? 'border-indigo-500/40 bg-indigo-500/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{outlet.outletName}</p>
                        <p className="text-[11px] text-gray-500">{outlet.orders} orders</p>
                      </div>
                      <p className="text-sm font-bold text-indigo-300">{formatPrice(outlet.sales)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold">Item-wise Report</h3>
                  <p className="text-[11px] text-gray-500 mt-1">POS item performance for selected date/outlet filters</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedItemDrilldown && (
                    <button
                      onClick={() => setSelectedItemDrilldown(null)}
                      className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold"
                    >
                      Clear Drilldown
                    </button>
                  )}
                  <button
                    onClick={handleDownloadItemWiseReport}
                    className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Item-wise
                  </button>
                </div>
              </div>

              {itemWiseLoading || itemWiseFetching ? (
                <div className="py-8 flex items-center justify-center text-sm text-gray-400 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading item-wise report...
                </div>
              ) : itemWiseError ? (
                <div className="py-8 text-center text-sm text-red-300">
                  Could not load item-wise report data.
                </div>
              ) : itemWiseRows.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No item-wise sales data found for selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-white/10">
                        <th className="py-2 pr-3">Item</th>
                        <th className="py-2 pr-3">SKU</th>
                        <th className="py-2 pr-3 text-right">Qty Sold</th>
                        <th className="py-2 pr-3 text-right">Avg Price</th>
                        <th className="py-2 pr-3 text-right">Revenue</th>
                        <th className="py-2 text-right">Orders</th>
                        <th className="py-2 text-right">7-Day Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemWiseRows.map((row: SalesProductWiseRow) => {
                        const itemName = row.variant_name && row.variant_name !== '—'
                          ? `${row.product_name} (${row.variant_name})`
                          : row.product_name;

                        return (
                          <tr key={`${row.product_id}-${row.variant_id || row.sku}`} className="border-b border-white/5 last:border-b-0">
                            <td className="py-3 pr-3">
                              <p className="text-white font-medium">{itemName}</p>
                            </td>
                            <td className="py-3 pr-3 text-gray-300">{row.sku || '—'}</td>
                            <td className="py-3 pr-3 text-right text-gray-200">{row.total_qty}</td>
                            <td className="py-3 pr-3 text-right text-gray-200">{formatPrice(Number(row.avg_unit_price || 0))}</td>
                            <td className="py-3 pr-3 text-right font-semibold text-indigo-300">{formatPrice(Number(row.total_revenue || 0))}</td>
                            <td className="py-3 text-right text-gray-200">{row.order_count}</td>
                            <td className="py-3 text-right text-indigo-300">
                              <Sparkline values={buildItemSparkline(row)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <PosAnalyticsBatchAWidgets
              hourlyHeatmapQuery={hourlyHeatmapQuery}
              paymentMixQuery={paymentMixQuery}
              fulfillmentMixQuery={fulfillmentMixQuery}
              discountImpactQuery={discountImpactQuery}
              cashierPerfQuery={cashierPerfQuery}
              returnsQuery={returnsQuery}
              canViewAllPosSessions={canViewAllPosSessions}
              handleDownloadPosWidget={handleDownloadPosWidget}
              navigate={navigate}
            />

            <PosAnalyticsBatchBWidgets
              categoryBrandQuery={categoryBrandQuery}
              basketQuery={basketQuery}
              modifierQuery={modifierQuery}
              trendQuery={trendComparisonQuery}
              moversQuery={moversQuery}
              leaderboardQuery={outletLeaderboardQuery}
              isAdmin={canViewAllPosSessions}
              handleDownloadPosWidget={handleDownloadPosWidget}
            />
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
                    <button 
                      onClick={() => updateSetting('theme', settings.theme === 'dark' ? 'light' : 'dark')}
                      className={`w-10 h-5 rounded-full flex items-center px-1 transition-colors ${settings.theme === 'dark' ? 'bg-indigo-600' : 'bg-white/10'}`}>
                      <div className={`bg-white w-3 h-3 rounded-full transition-transform ${settings.theme === 'dark' ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Large Item Cards</span>
                    <button 
                      onClick={() => updateSetting('largeCards', !settings.largeCards)}
                      className={`w-10 h-5 rounded-full flex items-center px-1 transition-colors ${settings.largeCards ? 'bg-indigo-600' : 'bg-white/10'}`}>
                      <div className={`bg-white w-3 h-3 rounded-full transition-transform ${settings.largeCards ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#1a1d27] border border-white/10 p-6 rounded-3xl">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Printer className="h-4 w-4" /> Print Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-print receipt</span>
                    <button 
                      onClick={() => updateSetting('autoPrint', !settings.autoPrint)}
                      className={`w-10 h-5 rounded-full flex items-center px-1 transition-colors ${settings.autoPrint ? 'bg-indigo-600' : 'bg-white/10'}`}>
                      <div className={`bg-white w-3 h-3 rounded-full transition-transform ${settings.autoPrint ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Thermal Printer IP</span>
                    <input type="text" value="192.168.1.102" readOnly className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-indigo-400 w-24 text-right" />
                  </div>
                </div>
              </div>

              <div className="bg-[#1a1d27] border border-red-500/10 p-6 rounded-3xl">
                <h3 className="font-bold mb-4 text-red-500">Danger Zone</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                       <p className="text-sm font-bold">End POS Session</p>
                       <p className="text-[10px] text-gray-500">Close the current shift and lock the terminal</p>
                    </div>
                    <button 
                      onClick={async () => {
                        if (confirm('Are you sure you want to end this POS session?')) {
                          try {
                            await apiClient.post(`/pos/sessions/${activeSession?.id}/close`);
                            toast.success('Session ended');
                            refetchSession();
                            window.location.reload();
                          } catch (err: any) {
                            toast.error(err.response?.data?.error || 'Failed to close session');
                          }
                        }
                      }}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                      End Terminal Session
                    </button>
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

      {/* ── 0. Session Overlay ────────────────────────────────────── */}
      {!activeSession && activeView !== 'settings' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0c10]/90 backdrop-blur-md">
           <div className="bg-[#1a1d27] border border-white/10 rounded-3xl p-8 w-[400px] shadow-2xl text-center">
             <div className="bg-indigo-600/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
               <Store className="h-8 w-8 text-indigo-400" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">Terminal Locked</h2>
             <p className="text-gray-400 text-sm mb-8">Start a new POS session to begin ringing up sales.</p>
             
             <div className="space-y-4 text-left">
                <div>
                   <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Opening Cash</label>
                   <div className="relative">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                     <input 
                       id="openingCash"
                       type="number" 
                       defaultValue={0}
                       className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 text-lg font-bold transition-colors"
                     />
                   </div>
                </div>
                <button 
                  onClick={() => {
                     const cash = parseFloat((document.getElementById('openingCash') as HTMLInputElement).value) || 0;
                     startSessionMutation.mutate(cash);
                  }}
                  disabled={startSessionMutation.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {startSessionMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                  START SESSION
                </button>
             </div>
           </div>
        </div>
      )}

      {/* ── Add Customer Modal ────────────────────────────────────── */}
      {addCustomerModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl">
            <h3 className="font-bold text-lg text-white mb-4">Add New Customer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 pointer-events-none">Customer Name <span className="text-red-400">*</span></label>
                <input 
                  autoFocus
                  type="text" 
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="E.g. John Doe"
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:border-indigo-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 pointer-events-none">Phone Number</label>
                <input 
                  type="tel" 
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="+1..."
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:border-indigo-500 outline-none" 
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setAddCustomerModal(false)} className="px-4 py-2 hover:bg-white/5 rounded-lg text-gray-400 font-medium">Cancel</button>
              <button 
                onClick={() => {
                  if (!newCustomer.name.trim()) return toast.error('Name is required');
                  createCustomerMutation.mutate(newCustomer);
                }}
                disabled={createCustomerMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2"
              >
                {createCustomerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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

              <div className="pt-2 border-t border-white/5 mt-4">
                <label className="text-xs font-bold text-gray-400 mb-3 block uppercase tracking-wider">Order Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['pending', 'processing', 'shipped'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setOrderStatus(s)}
                      className={`py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all duration-200
                        ${orderStatus === s 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' 
                          : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:bg-white/10'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
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
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setAddCustomerModal(true)}
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  New
                </button>
                <button onClick={() => setCustomerModal(false)} className="text-gray-500 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
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
              {(customers as any[]).filter(c => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)).length === 0 && (
                <div className="py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                  <UserPlus className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-white mb-1">No customers found</p>
                  <p className="text-xs text-gray-500 mb-4 px-8">Search returned no results. Would you like to create a new customer?</p>
                  <button 
                    onClick={() => { setCustomerModal(false); setAddCustomerModal(true); }}
                    className="mx-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    CREATE NEW ACCOUNT
                  </button>
                </div>
              )}
              {(customers as any[]).filter(c => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)).length > 0 && (
                <div className="pt-2 text-center">
                  <p className="text-[10px] text-gray-500 mb-2">Can't find the customer?</p>
                  <button 
                    onClick={() => { setCustomerModal(false); setAddCustomerModal(true); }}
                    className="w-full py-2 rounded-xl border border-dashed border-white/10 text-indigo-400 text-xs font-bold hover:bg-indigo-600/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="h-3 w-3" />
                    CREATE NEW ACCOUNT
                  </button>
                </div>
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
                <div className="flex flex-col gap-3 w-full mt-6">
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={handlePrintKitchenKOT}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-bold transition-colors border border-amber-500/20"
                    >
                      <Utensils className="h-4 w-4" /> Kitchen KOT
                    </button>
                    <button
                      onClick={handlePrintCustomerBill}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-500 font-bold transition-colors border border-green-500/20"
                    >
                      <Receipt className="h-4 w-4" /> Customer Bill
                    </button>
                  </div>
                  <button
                    onClick={handleNewOrder}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                  >
                    <Plus className="h-4 w-4" /> Start New Order
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

      {/* ── 5. Order Details Modal (History) ─────────────────────── */}
      {historyDetailsOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="font-semibold text-white text-lg">Order Details</h3>
                <p className="text-xs text-gray-400">
                  Order Id: {historyOrderDetails?.id || historyDetailsOrderId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintHistoryBill}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition-colors text-xs font-semibold"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Bill
                </button>
                <button onClick={() => setHistoryDetailsOrderId(null)} className="text-gray-500 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-sm">
              {historyOrderDetailsLoading ? (
                <div className="py-12 text-center text-gray-400">Loading order details...</div>
              ) : !historyOrderDetails ? (
                <div className="py-12 text-center text-gray-400">Could not load order details.</div>
              ) : (
                <div className="space-y-5">
                  <div className="text-gray-400">{formatOrderDateTime(historyOrderDetails.created_at)}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">From</p>
                      <p className="font-semibold text-white">{profile?.company_name || 'Fresh Breeze Basket'}</p>
                      <p className="text-gray-400 text-xs mt-1">{profile?.company_address || 'Address not available'}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">To</p>
                      <p className="font-semibold text-white">{historyOrderDetails.customer?.name || 'Walk-in Customer'}</p>
                      <p className="text-gray-400 text-xs mt-1">
                        Phone: {historyOrderDetails.customer?.phone || 'N/A'}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Order Type: {historyOrderDetails.order_type_label || historyOrderDetails.fulfillment_type || 'Quick Bill'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Details</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <p className="text-gray-300">Bill No: <span className="text-white font-medium">{historyOrderDetails.receipt_number || '-'}</span></p>
                      <p className="text-gray-300">Order Status: <span className="text-white font-medium">{historyOrderDetails.status || '-'}</span></p>
                      <p className="text-gray-300">Payment Status: <span className="text-white font-medium">{historyOrderDetails.payment_status || '-'}</span></p>
                      <p className="text-gray-300">Order Source: <span className="text-white font-medium">{historyOrderDetails.order_source || 'pos'}</span></p>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2">Quantity</th>
                          <th className="px-3 py-2">Price</th>
                          <th className="px-3 py-2">Tax</th>
                          <th className="px-3 py-2">Sub Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(historyOrderDetails.order_items || []).map((item: any, idx: number) => (
                          <tr key={item.id || idx}>
                            {(() => {
                              const qty = Number(item.quantity ?? 0);
                              const unitPrice = Number(item.unit_price ?? item.price ?? 0);
                              const amountCandidates = [
                                item.line_total,
                                item.lineTotal,
                                item.taxable_value,
                                item.net_amount,
                                item.total,
                                item.subtotal,
                              ]
                                .map((val) => Number(val))
                                .filter((val) => Number.isFinite(val) && val > 0);
                              const lineSubtotal = amountCandidates[0] ?? (qty * unitPrice);
                              const lineTax = Number(item.tax_amount ?? item.tax ?? 0);
                              return (
                                <>
                            <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 text-white">{item.product?.name || item.products?.name || item.variant?.name || 'Item'}</td>
                            <td className="px-3 py-2 text-gray-300">{qty}</td>
                            <td className="px-3 py-2 text-gray-300">{formatPrice(unitPrice)}</td>
                            <td className="px-3 py-2 text-gray-300">{lineTax.toFixed(2)}</td>
                            <td className="px-3 py-2 text-indigo-300">{formatPrice(lineSubtotal)}</td>
                                </>
                              );
                            })()}
                          </tr>
                        ))}
                        {(historyOrderDetails.order_items || []).length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-4 text-center text-gray-500">No line items found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Payment Details</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-gray-400">Payment Method</span><span className="text-white">{historyOrderDetails.payment_method || 'N/A'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Total Amount</span><span className="text-white">{formatPrice(Number(historyOrderDetails.total_amount || 0))}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Discount</span><span className="text-white">{formatPrice(Number(historyOrderDetails.total_discount || 0))}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">External Discount</span><span className="text-white">{formatPrice(Number(historyOrderDetails.extra_discount_amount || 0))}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Tax</span><span className="text-white">{formatPrice(Number(historyOrderDetails.total_tax || 0))}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Charges</span><span className="text-white">{formatPrice(Number(historyOrderDetails.total_extra_charges || 0))}</span></div>
                      <div className="flex justify-between font-semibold border-t border-white/10 pt-2 mt-2">
                        <span className="text-white">Grand Total</span>
                        <span className="text-indigo-300">{formatPrice(Number(historyOrderDetails.total_amount || 0))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
