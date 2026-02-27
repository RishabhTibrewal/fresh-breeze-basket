import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CategoryProvider } from "@/contexts/CategoryContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SalesProtectedRoute from "./components/auth/SalesProtectedRoute";
import AccountLayout from "./layouts/AccountLayout";
import SalesLayout from "./layouts/SalesLayout";
import ModuleLayout from "./layouts/ModuleLayout";

// Public routes - lazy loaded
const Index = lazy(() => import("./pages/Index"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const Categories = lazy(() => import("./pages/Categories"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Shipping = lazy(() => import("./pages/Shipping"));
const Returns = lazy(() => import("./pages/Returns"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const CreateCompany = lazy(() => import("./pages/CreateCompany"));
const TestPayment = lazy(() => import('./components/TestPayment').then(m => ({ default: m.TestPayment })));

// Account routes - lazy loaded
const ProfilePage = lazy(() => import("./pages/account/ProfilePage"));
const AddressPage = lazy(() => import("./pages/account/AddressPage"));
const OrdersPage = lazy(() => import("./pages/account/OrdersPage"));
const PaymentMethodsPage = lazy(() => import("./pages/account/PaymentMethodsPage"));
const PaymentHistoryPage = lazy(() => import("./pages/account/PaymentHistoryPage"));
const SettingsPage = lazy(() => import("./pages/account/SettingsPage"));
const OrderDetailsPage = lazy(() => import("./pages/account/OrderDetailsPage"));
const CustomerProfilePage = lazy(() => import("./pages/account/CustomerProfilePage"));

// Admin routes - lazy loaded (large chunk, split separately)
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const ProductList = lazy(() => import("./pages/admin/ProductList"));
const ProductForm = lazy(() => import("./pages/admin/ProductForm"));
const CategoryList = lazy(() => import("./pages/admin/CategoryList"));
const AdminOrderList = lazy(() => import("./pages/admin/AdminOrderList"));
const AdminOrderDetails = lazy(() => import("./pages/admin/AdminOrderDetails"));
const CustomerList = lazy(() => import("./pages/admin/CustomerList"));
const AdminCustomerDetails = lazy(() => import("./pages/admin/AdminCustomerDetails"));
const AdminCheck = lazy(() => import("./pages/admin/AdminCheck"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const SalesTargets = lazy(() => import("./pages/admin/SalesTargets"));
const SalesPersons = lazy(() => import("./pages/admin/SalesPersons"));
const AdminLeads = lazy(() => import("./pages/admin/Leads"));
const Warehouses = lazy(() => import("./pages/admin/Warehouses"));
const WarehouseInventory = lazy(() => import("./pages/admin/WarehouseInventory"));
const PurchaseOrders = lazy(() => import("./pages/admin/PurchaseOrders"));
const CreatePurchaseOrder = lazy(() => import("./pages/admin/CreatePurchaseOrder"));
const PurchaseOrderDetail = lazy(() => import("./pages/admin/PurchaseOrderDetail"));
const GoodsReceipts = lazy(() => import("./pages/admin/GoodsReceipts"));
const CreateGoodsReceipt = lazy(() => import("./pages/admin/CreateGoodsReceipt"));
const GoodsReceiptDetail = lazy(() => import("./pages/admin/GoodsReceiptDetail"));
const Suppliers = lazy(() => import("./pages/admin/Suppliers"));
const SupplierForm = lazy(() => import("./pages/admin/SupplierForm"));
const PurchaseInvoices = lazy(() => import("./pages/admin/PurchaseInvoices"));
const CreatePurchaseInvoice = lazy(() => import("./pages/admin/CreatePurchaseInvoice"));
const PurchaseInvoiceDetail = lazy(() => import("./pages/admin/PurchaseInvoiceDetail"));
const SupplierPayments = lazy(() => import("./pages/admin/SupplierPayments"));
const CreateSupplierPayment = lazy(() => import("./pages/admin/CreateSupplierPayment"));
const SupplierPaymentDetail = lazy(() => import("./pages/admin/SupplierPaymentDetail"));
const BrandList = lazy(() => import("./pages/admin/BrandList"));
const BrandForm = lazy(() => import("./pages/admin/BrandForm"));
const BrandDetail = lazy(() => import("./pages/admin/BrandDetail"));
const TaxList = lazy(() => import("./pages/admin/TaxList"));
const TaxForm = lazy(() => import("./pages/admin/TaxForm"));
const TaxDetail = lazy(() => import("./pages/admin/TaxDetail"));
const VariantList = lazy(() => import("./pages/admin/VariantList"));
const VariantForm = lazy(() => import("./pages/admin/VariantForm"));
const VariantDetail = lazy(() => import("./pages/admin/VariantDetail"));
const PriceList = lazy(() => import("./pages/admin/PriceList"));
const PriceForm = lazy(() => import("./pages/admin/PriceForm"));
const StockAdjustment = lazy(() => import("./pages/admin/StockAdjustment"));
const StockTransfer = lazy(() => import("./pages/admin/StockTransfer"));
const StockMovements = lazy(() => import("./pages/admin/StockMovements"));
const PlaceholderPage = lazy(() => import("./pages/admin/PlaceholderPage"));
const SalesAnalysis = lazy(() => import("./pages/admin/SalesAnalysis"));
const AdminCreditManagement = lazy(() => import("./pages/admin/CreditManagement"));
const AdminCreatePOSOrder = lazy(() => import("./pages/admin/CreatePOSOrder"));

// Sales routes - lazy loaded
const SalesDashboard = lazy(() => import("./pages/sales/Dashboard"));
const Customers = lazy(() => import("./pages/sales/Customers"));
const CustomerOrders = lazy(() => import("./pages/sales/CustomerOrders"));
const CreateOrder = lazy(() => import("./pages/sales/CreateOrder"));
const OrderDetail = lazy(() => import("./pages/sales/OrderDetail"));
const OrderUpdate = lazy(() => import("./pages/sales/OrderUpdate"));
const Orders = lazy(() => import("./pages/sales/Orders"));
const CreditManagement = lazy(() => import("./pages/sales/CreditManagement"));
const SalesAnalytics = lazy(() => import("./pages/sales/SalesAnalytics"));
const Leads = lazy(() => import("./pages/sales/Leads"));
const CreatePOSOrder = lazy(() => import("./pages/pos/CreatePOSOrder"));

// Shared order pages
const CreateReturnOrderPage = lazy(() => import("./pages/orders/CreateReturnOrderPage"));
const OrderDocumentPage = lazy(() => import("./pages/orders/OrderDocumentPage"));

// Dashboard and module routes
const HomeDashboard = lazy(() => import("./pages/HomeDashboard"));

// Loading component
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
  </div>
);

// Create QueryClient once outside the component so it persists across re-renders
// (Creating it inside would wipe the entire cache on every App re-render)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes — reduces redundant refetches
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <CategoryProvider>
                <Toaster />
                <Sonner />
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Index />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/products/:id" element={<ProductDetails />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/about" element={<AboutUs />} />
                    <Route path="/contact" element={<ContactUs />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/shipping" element={<Shipping />} />
                    <Route path="/returns" element={<Returns />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/create-company" element={<CreateCompany />} />
                    <Route path="/test-payment" element={<TestPayment />} />
                    
                    {/* Protected Routes */}
                    <Route path="/account" element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
                      <Route index element={<ProfilePage />} />
                      <Route path="customer" element={<CustomerProfilePage />} />
                      <Route path="address" element={<AddressPage />} />
                      <Route path="orders" element={<OrdersPage />} />
                      <Route path="orders/:id" element={<OrderDetailsPage />} />
                      <Route path="orders/:id/return" element={<CreateReturnOrderPage />} />
                      <Route path="payments" element={<PaymentHistoryPage />} />
                      <Route path="payment" element={<PaymentMethodsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                    </Route>
                    <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                    <Route path="/thank-you" element={<ProtectedRoute><ThankYou /></ProtectedRoute>} />
                    
                    {/* Home Dashboard - Module Launcher */}
                    <Route path="/dashboard" element={<ProtectedRoute><HomeDashboard /></ProtectedRoute>} />
                    
                    {/* Admin Routes - Only accessible to admin users */}
                    <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>}>
                      <Route index element={<AdminHome />} />
                      <Route path="products" element={<ProductList />} />
                      <Route path="products/new" element={<ProductForm />} />
                      <Route path="products/edit/:id" element={<ProductForm />} />
                      <Route path="products/:productId/variants" element={<VariantList />} />
                      <Route path="products/:productId/variants/new" element={<VariantForm />} />
                      <Route path="variants/:variantId" element={<VariantDetail />} />
                      <Route path="variants/:variantId/edit" element={<VariantForm />} />
                      <Route path="brands" element={<BrandList />} />
                      <Route path="brands/new" element={<BrandForm />} />
                      <Route path="brands/:id" element={<BrandDetail />} />
                      <Route path="brands/:id/edit" element={<BrandForm />} />
                      <Route path="taxes" element={<TaxList />} />
                      <Route path="taxes/new" element={<TaxForm />} />
                      <Route path="taxes/:id/edit" element={<TaxForm />} />
                      <Route path="taxes/:id" element={<TaxDetail />} />
                      <Route path="prices" element={<PriceList />} />
                      <Route path="prices/new" element={<PriceForm />} />
                      <Route path="categories" element={<CategoryList />} />
                      <Route path="inventory/adjust" element={<StockAdjustment />} />
                      <Route path="inventory/transfer" element={<StockTransfer />} />
                      <Route path="inventory/movements" element={<StockMovements />} />
                      <Route path="inventory/balance" element={<PlaceholderPage />} />
                      <Route path="inventory/warehouse-balance" element={<PlaceholderPage />} />
                      <Route path="orders" element={<AdminOrderList />} />
                      <Route path="orders/:id" element={<AdminOrderDetails />} />
                      <Route path="orders/:id/return" element={<CreateReturnOrderPage />} />
                      <Route path="customers" element={<CustomerList />} />
                      <Route path="customers/:id" element={<AdminCustomerDetails />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="sales-targets" element={<SalesTargets />} />
                      <Route path="leads" element={<AdminLeads />} />
                      <Route path="quotations" element={<PlaceholderPage />} />
                      <Route path="invoices" element={<PlaceholderPage />} />
                      <Route path="payments" element={<PlaceholderPage />} />
                      <Route path="credit-management" element={<AdminCreditManagement />} />
                      <Route path="sales-persons" element={<SalesPersons />} />
                      <Route path="pos" element={<AdminCreatePOSOrder />} />
                      <Route path="sales/analysis" element={<SalesAnalysis />} />
                      <Route path="sales/reports/summary" element={<PlaceholderPage />} />
                      <Route path="sales/reports/invoice-register" element={<PlaceholderPage />} />
                      <Route path="sales/reports/receivables" element={<PlaceholderPage />} />
                      <Route path="sales/reports/by-person" element={<PlaceholderPage />} />
                      <Route path="warehouses" element={<Warehouses />} />
                      <Route path="warehouses/:warehouseId/inventory" element={<WarehouseInventory />} />
                      <Route path="purchase-orders" element={<PurchaseOrders />} />
                      <Route path="purchase-orders/new" element={<CreatePurchaseOrder />} />
                      <Route path="purchase-orders/:id/edit" element={<CreatePurchaseOrder />} />
                      <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />
                      <Route path="goods-receipts" element={<GoodsReceipts />} />
                      <Route path="goods-receipts/new" element={<CreateGoodsReceipt />} />
                      <Route path="goods-receipts/:id/edit" element={<CreateGoodsReceipt />} />
                      <Route path="goods-receipts/:id" element={<GoodsReceiptDetail />} />
                      <Route path="suppliers" element={<Suppliers />} />
                      <Route path="suppliers/new" element={<SupplierForm />} />
                      <Route path="suppliers/:id" element={<SupplierForm />} />
                      <Route path="suppliers/:id/edit" element={<SupplierForm />} />
                      <Route path="purchase-invoices" element={<PurchaseInvoices />} />
                      <Route path="purchase-invoices/new" element={<CreatePurchaseInvoice />} />
                      <Route path="purchase-invoices/:id/edit" element={<CreatePurchaseInvoice />} />
                      <Route path="purchase-invoices/:id" element={<PurchaseInvoiceDetail />} />
                      <Route path="supplier-payments" element={<SupplierPayments />} />
                      <Route path="supplier-payments/new" element={<CreateSupplierPayment />} />
                      <Route path="supplier-payments/:id" element={<SupplierPaymentDetail />} />
                      <Route path="procurement/reports/summary" element={<PlaceholderPage />} />
                      <Route path="procurement/reports/grn-pending" element={<PlaceholderPage />} />
                      <Route path="procurement/reports/supplier-outstanding" element={<PlaceholderPage />} />
                      <Route path="reports/profit-loss" element={<PlaceholderPage />} />
                      <Route path="reports/inventory-valuation" element={<PlaceholderPage />} />
                      <Route path="reports/tax-gst" element={<PlaceholderPage />} />
                      <Route path="reports/aging" element={<PlaceholderPage />} />
                      <Route path="reports/custom" element={<PlaceholderPage />} />
                      <Route path="settings/company" element={<PlaceholderPage />} />
                      <Route path="settings/users-roles" element={<PlaceholderPage />} />
                      <Route path="settings/payment-modes" element={<PlaceholderPage />} />
                      <Route path="settings/number-series" element={<PlaceholderPage />} />
                      <Route path="settings/audit-logs" element={<PlaceholderPage />} />
                      <Route path="check" element={<AdminCheck />} />
                    </Route>
                    
                    {/* POS Routes */}
                    <Route path="/pos" element={<ProtectedRoute><CreatePOSOrder /></ProtectedRoute>} />
                    
                    {/* Module Routes with Contextual Sidebar */}
                    {/* Inventory Module */}
                    <Route path="/inventory" element={<ProtectedRoute><ModuleLayout /></ProtectedRoute>}>
                      <Route index element={<AdminHome />} />
                      <Route path="products" element={<ProductList />} />
                      <Route path="products/new" element={<ProductForm />} />
                      <Route path="products/edit/:id" element={<ProductForm />} />
                      <Route path="products/:productId/variants" element={<VariantList />} />
                      <Route path="products/:productId/variants/new" element={<VariantForm />} />
                      <Route path="variants/:variantId" element={<VariantDetail />} />
                      <Route path="variants/:variantId/edit" element={<VariantForm />} />
                      <Route path="categories" element={<CategoryList />} />
                      <Route path="brands" element={<BrandList />} />
                      <Route path="brands/new" element={<BrandForm />} />
                      <Route path="brands/:id" element={<BrandDetail />} />
                      <Route path="brands/:id/edit" element={<BrandForm />} />
                      <Route path="warehouses" element={<Warehouses />} />
                      <Route path="warehouses/:warehouseId/inventory" element={<WarehouseInventory />} />
                      <Route path="adjust" element={<StockAdjustment />} />
                      <Route path="transfer" element={<StockTransfer />} />
                      <Route path="movements" element={<StockMovements />} />
                      <Route path="balance" element={<PlaceholderPage />} />
                      <Route path="warehouse-balance" element={<PlaceholderPage />} />
                    </Route>
                    
                    {/* Sales Module */}
                    <Route path="/sales" element={<ProtectedRoute><ModuleLayout /></ProtectedRoute>}>
                      <Route index element={<AdminHome />} />
                      <Route path="orders" element={<AdminOrderList />} />
                      <Route path="orders/create" element={<CreateOrder />} />
                      <Route path="orders/:id" element={<OrderDocumentPage />} />
                      <Route path="orders/:id/return" element={<CreateReturnOrderPage />} />
                      <Route path="quotations" element={<PlaceholderPage />} />
                      <Route path="invoices" element={<PlaceholderPage />} />
                      <Route path="payments" element={<PlaceholderPage />} />
                      <Route path="customers" element={<Customers />} />
                      <Route path="customers/:customerId/orders" element={<CustomerOrders />} />
                      <Route path="leads" element={<AdminLeads />} />
                      <Route path="credit-management" element={<AdminCreditManagement />} />
                      <Route path="analytics" element={<SalesAnalysis />} />
                    </Route>
                    
                    {/* Sales Executive Routes (Legacy - for sales executives) */}
                    <Route path="/sales-exec" element={
                      <SalesProtectedRoute>
                        <SalesLayout>
                          <Outlet />
                        </SalesLayout>
                      </SalesProtectedRoute>
                    }>
                      <Route index element={<SalesDashboard />} />
                      <Route path="customers" element={<Customers />} />
                      <Route path="customers/:customerId/orders" element={<CustomerOrders />} />
                      <Route path="orders/create" element={<CreateOrder />} />
                      <Route path="orders/:orderId" element={<OrderDetail />} />
                      <Route path="orders/:orderId/edit" element={<OrderUpdate />} />
                      <Route path="orders" element={<Orders />} />
                      <Route path="credit-management" element={<CreditManagement />} />
                      <Route path="analytics" element={<SalesAnalytics />} />
                      <Route path="leads" element={<Leads />} />
                      <Route path="pos" element={<CreatePOSOrder />} />
                    </Route>
                    
                    {/* Procurement Module */}
                    <Route path="/procurement" element={<ProtectedRoute><ModuleLayout /></ProtectedRoute>}>
                      <Route index element={<PlaceholderPage />} />
                      <Route path="purchase-orders" element={<PurchaseOrders />} />
                      <Route path="purchase-orders/new" element={<CreatePurchaseOrder />} />
                      <Route path="purchase-orders/:id/edit" element={<CreatePurchaseOrder />} />
                      <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />
                      <Route path="suppliers" element={<Suppliers />} />
                      <Route path="suppliers/new" element={<SupplierForm />} />
                      <Route path="suppliers/:id" element={<SupplierForm />} />
                      <Route path="suppliers/:id/edit" element={<SupplierForm />} />
                      <Route path="goods-receipts" element={<GoodsReceipts />} />
                      <Route path="goods-receipts/new" element={<CreateGoodsReceipt />} />
                      <Route path="goods-receipts/:id/edit" element={<CreateGoodsReceipt />} />
                      <Route path="goods-receipts/:id" element={<GoodsReceiptDetail />} />
                      <Route path="purchase-invoices" element={<PurchaseInvoices />} />
                      <Route path="purchase-invoices/new" element={<CreatePurchaseInvoice />} />
                      <Route path="purchase-invoices/:id/edit" element={<CreatePurchaseInvoice />} />
                      <Route path="purchase-invoices/:id" element={<PurchaseInvoiceDetail />} />
                      <Route path="supplier-payments" element={<SupplierPayments />} />
                      <Route path="supplier-payments/new" element={<CreateSupplierPayment />} />
                      <Route path="supplier-payments/:id" element={<SupplierPaymentDetail />} />
                    </Route>
                    
                    {/* E-commerce Module */}
                    <Route path="/ecommerce" element={<ProtectedRoute><ModuleLayout /></ProtectedRoute>}>
                      <Route index element={<AdminHome />} />
                      <Route path="products" element={<ProductList />} />
                      <Route path="orders" element={<AdminOrderList />} />
                      <Route path="settings" element={<AdminSettings />} />
                    </Route>
                    
                    {/* Accounting Module */}
                    <Route path="/accounting" element={<ProtectedRoute><ModuleLayout /></ProtectedRoute>}>
                      <Route index element={<PlaceholderPage />} />
                      <Route path="chart-of-accounts" element={<PlaceholderPage />} />
                      <Route path="journal-entries" element={<PlaceholderPage />} />
                      <Route path="ledgers" element={<PlaceholderPage />} />
                      <Route path="reconciliation" element={<PlaceholderPage />} />
                    </Route>
                    
                    {/* Reports Module */}
                    <Route path="/reports" element={<ProtectedRoute><ModuleLayout /></ProtectedRoute>}>
                      <Route index element={<PlaceholderPage />} />
                      <Route path="sales" element={<PlaceholderPage />} />
                      <Route path="inventory" element={<PlaceholderPage />} />
                      <Route path="financial" element={<PlaceholderPage />} />
                      <Route path="custom" element={<PlaceholderPage />} />
                    </Route>
                    
                    {/* Settings Module */}
                    <Route path="/settings" element={<ProtectedRoute><ModuleLayout /></ProtectedRoute>}>
                      <Route index element={<PlaceholderPage />} />
                      <Route path="company" element={<PlaceholderPage />} />
                      <Route path="users-roles" element={<AdminSettings />} />
                      <Route path="taxes" element={<TaxList />} />
                      <Route path="taxes/new" element={<TaxForm />} />
                      <Route path="taxes/:id/edit" element={<TaxForm />} />
                      <Route path="taxes/:id" element={<TaxDetail />} />
                      <Route path="payment-modes" element={<PlaceholderPage />} />
                      <Route path="warehouses" element={<Warehouses />} />
                      <Route path="warehouses/:warehouseId/inventory" element={<WarehouseInventory />} />
                      <Route path="number-series" element={<PlaceholderPage />} />
                      <Route path="audit-logs" element={<PlaceholderPage />} />
                      <Route path="sales-persons" element={<SalesPersons />} />
                      <Route path="sales-targets" element={<SalesTargets />} />
                    </Route>
                    
                    {/* Catch-all route */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </CategoryProvider>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
