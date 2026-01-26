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

// Loading component
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
  </div>
);

// Create a new QueryClient instance inside the component
const App: React.FC = () => {
  const queryClient = new QueryClient();
  
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
                      <Route path="payments" element={<PaymentHistoryPage />} />
                      <Route path="payment" element={<PaymentMethodsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                    </Route>
                    <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                    <Route path="/thank-you" element={<ProtectedRoute><ThankYou /></ProtectedRoute>} />
                    
                    {/* Admin Routes - Only accessible to admin users */}
                    <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>}>
                      <Route index element={<AdminHome />} />
                      <Route path="products" element={<ProductList />} />
                      <Route path="products/new" element={<ProductForm />} />
                      <Route path="products/edit/:id" element={<ProductForm />} />
                      <Route path="categories" element={<CategoryList />} />
                      <Route path="orders" element={<AdminOrderList />} />
                      <Route path="orders/:id" element={<AdminOrderDetails />} />
                      <Route path="customers" element={<CustomerList />} />
                      <Route path="customers/:id" element={<AdminCustomerDetails />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="sales-targets" element={<SalesTargets />} />
                      <Route path="leads" element={<AdminLeads />} />
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
                      <Route path="check" element={<AdminCheck />} />
                    </Route>
                    
                    {/* Sales Executive Routes */}
                    <Route path="/sales" element={
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
                    
                    {/* POS Routes */}
                    <Route path="/pos" element={<ProtectedRoute><CreatePOSOrder /></ProtectedRoute>} />
                    
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
