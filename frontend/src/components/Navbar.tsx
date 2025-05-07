import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Menu, X, Search, ChevronRight, Home, Package, LayoutGrid, Info, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCategory } from '@/contexts/CategoryContext';
import CartDrawer from '@/components/cart/CartDrawer';
import CategoryDrawer from '@/components/category/CategoryDrawer';
import { UserNav } from './user/UserNav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { state, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const { setIsCategoryDrawerOpen } = useCategory();

  const toggleSearch = () => setIsSearchOpen(!isSearchOpen);
  const openCart = () => setIsCartOpen(true);
  const openCategoryDrawer = () => setIsCategoryDrawerOpen(true);

  const navLinks = [
    { name: 'Home', path: '/', icon: <Home className="h-4 w-4 mr-2" /> },
    { name: 'Products', path: '/products', icon: <Package className="h-4 w-4 mr-2" /> },
    { name: 'Categories', path: '/categories', icon: <LayoutGrid className="h-4 w-4 mr-2" /> },
    { name: 'About Us', path: '/about', icon: <Info className="h-4 w-4 mr-2" /> },
    { name: 'Contact', path: '/contact', icon: <Mail className="h-4 w-4 mr-2" /> },
  ];

  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto py-2 sm:py-3 px-3 sm:px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {/* Mobile Category Menu Button */}
              <button 
                onClick={openCategoryDrawer}
                className="md:hidden p-1.5 sm:p-2 text-gray-600 hover:text-primary transition-colors mr-2"
                aria-label="Categories"
              >
                <LayoutGrid className="h-5 sm:h-6 w-5 sm:w-6" />
              </button>

              {/* Logo */}
              <Link to="/" className="flex items-center">
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  <span className="font-playfair">Fresh</span>
                  <span className="text-primary-light">Basket</span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-3 lg:space-x-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className="font-montserrat text-sm lg:text-base text-gray-700 hover:text-primary transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            {/* Search Bar - Desktop */}
            <div className="hidden md:flex items-center">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search fresh produce..."
                  className="w-48 lg:w-64 pl-8 lg:pl-10 pr-3 lg:pr-4 py-1.5 lg:py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <Search className="absolute left-2 lg:left-3 top-1.5 lg:top-2.5 h-4 lg:h-5 w-4 lg:w-5 text-gray-400" />
              </div>
            </div>

            {/* Action Icons */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button 
                onClick={toggleSearch}
                className="md:hidden p-1.5 sm:p-2 text-gray-600 hover:text-primary transition-colors"
                aria-label="Search"
              >
                <Search className="h-5 sm:h-6 w-5 sm:w-6" />
              </button>
              
              {user ? (
                <UserNav />
              ) : (
                <Link 
                  to="/auth" 
                  className="text-xs sm:text-sm p-1.5 sm:p-2 text-gray-600 hover:text-primary transition-colors"
                >
                  Sign In
                </Link>
              )}
              
              <button 
                onClick={openCart}
                className="p-1.5 sm:p-2 text-gray-600 hover:text-primary transition-colors relative"
                aria-label="Cart"
              >
                <ShoppingCart className="h-5 sm:h-6 w-5 sm:w-6" />
                {state.totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent text-white text-xs rounded-full h-4 sm:h-5 w-4 sm:w-5 flex items-center justify-center">
                    {state.totalItems > 99 ? '99+' : state.totalItems}
                  </span>
                )}
              </button>

              {/* Mobile Menu - Using Dropdown */}
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="p-1.5 sm:p-2 text-gray-600 hover:text-primary transition-colors"
                      aria-label="Menu"
                    >
                      <Menu className="h-5 sm:h-6 w-5 sm:w-6" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 mt-1">
                    <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {navLinks.map((link) => (
                      <DropdownMenuItem key={link.name} asChild>
                        <Link to={link.path} className="flex items-center w-full">
                          {link.icon}
                          <span>{link.name}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div 
            className={cn(
              "transition-all duration-300 overflow-hidden md:hidden",
              isSearchOpen ? "max-h-16 sm:max-h-20 opacity-100 mt-2 sm:mt-4" : "max-h-0 opacity-0"
            )}
          >
            <div className="relative">
              <input
                type="text"
                placeholder="Search fresh produce..."
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <Search className="absolute left-2 sm:left-3 top-1.5 sm:top-2.5 h-4 sm:h-5 w-4 sm:w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </header>
      
      {/* Cart Drawer */}
      <CartDrawer />
      
      {/* Category Drawer */}
      <CategoryDrawer />
    </>
  );
};

export default Navbar;
