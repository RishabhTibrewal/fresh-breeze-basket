import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CategoryProvider } from "@/contexts/CategoryContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import ThankYou from "./pages/ThankYou";
import Categories from "./pages/Categories";
import AboutUs from "./pages/AboutUs";
import ContactUs from "./pages/ContactUs";
import FAQ from "./pages/FAQ";
import Shipping from "./pages/Shipping";
import Returns from "./pages/Returns";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AccountLayout from "./layouts/AccountLayout";
import ProfilePage from "./pages/account/ProfilePage";
import AddressPage from "./pages/account/AddressPage";
import OrdersPage from "./pages/account/OrdersPage";
import PaymentMethodsPage from "./pages/account/PaymentMethodsPage";
import SettingsPage from "./pages/account/SettingsPage";
import OrderDetailsPage from "./pages/account/OrderDetailsPage";
import CustomerProfilePage from "./pages/account/CustomerProfilePage";

// Admin Dashboard Routes
import AdminDashboard from "./pages/admin/Dashboard";
import AdminHome from "./pages/admin/AdminHome";
import ProductList from "./pages/admin/ProductList";
import ProductForm from "./pages/admin/ProductForm";
import CategoryList from "./pages/admin/CategoryList";
import AdminOrderList from "./pages/admin/AdminOrderList";
import AdminOrderDetails from "./pages/admin/AdminOrderDetails";
import CustomerList from "./pages/admin/CustomerList";
import AdminCheck from "./pages/admin/AdminCheck";

// Sales Executive Routes
import SalesLayout from "./layouts/SalesLayout";
import SalesDashboard from "./pages/sales/Dashboard";
import Customers from "./pages/sales/Customers";
import CustomerOrders from "./pages/sales/CustomerOrders";
import CreateOrder from "./pages/sales/CreateOrder";
import OrderDetail from "./pages/sales/OrderDetail";
import OrderUpdate from "./pages/sales/OrderUpdate";
import Orders from "./pages/sales/Orders";
import CreditManagement from "./pages/sales/CreditManagement";
import SalesProtectedRoute from "./components/auth/SalesProtectedRoute";

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
                  
                  {/* Protected Routes */}
                  <Route path="/account" element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
                    <Route index element={<ProfilePage />} />
                    <Route path="customer" element={<CustomerProfilePage />} />
                    <Route path="address" element={<AddressPage />} />
                    <Route path="orders" element={<OrdersPage />} />
                    <Route path="orders/:id" element={<OrderDetailsPage />} />
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
                    <Route path="settings" element={<div>Admin Settings</div>} />
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
                    <Route path="analytics" element={<div>Sales Analytics</div>} />
                  </Route>
                  
                  {/* Catch-all route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </CategoryProvider>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
