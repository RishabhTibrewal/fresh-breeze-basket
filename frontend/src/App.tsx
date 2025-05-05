import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
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
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AccountLayout from "./layouts/AccountLayout";
import ProfilePage from "./pages/account/ProfilePage";
import AddressPage from "./pages/account/AddressPage";
import OrdersPage from "./pages/account/OrdersPage";
import PaymentMethodsPage from "./pages/account/PaymentMethodsPage";
import SettingsPage from "./pages/account/SettingsPage";
import OrderDetailsPage from "./pages/account/OrderDetailsPage";

// Admin Dashboard Routes
import AdminDashboard from "./pages/admin/Dashboard";
import AdminHome from "./pages/admin/AdminHome";
import ProductList from "./pages/admin/ProductList";
import ProductForm from "./pages/admin/ProductForm";
import CategoryList from "./pages/admin/CategoryList";
import AdminOrderList from "./pages/admin/AdminOrderList";
import AdminOrderDetails from "./pages/admin/AdminOrderDetails";

// Create a new QueryClient instance inside the component
const App = () => {
  const queryClient = new QueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
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
                <Route path="/auth" element={<Auth />} />
                
                {/* Protected Routes */}
                <Route path="/account" element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
                  <Route index element={<ProfilePage />} />
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
                  <Route path="customers" element={<div>Customers Management</div>} />
                  <Route path="settings" element={<div>Admin Settings</div>} />
                </Route>
                
                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
