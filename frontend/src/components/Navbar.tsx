
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Menu, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import CartDrawer from '@/components/cart/CartDrawer';
import { UserNav } from './user/UserNav';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { state, setIsCartOpen } = useCart();
  const { user } = useAuth();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleSearch = () => setIsSearchOpen(!isSearchOpen);
  const openCart = () => setIsCartOpen(true);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'Categories', path: '/categories' },
    { name: 'About Us', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto py-3 px-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <div className="text-2xl font-bold text-primary">
                <span className="font-playfair">Fresh</span>
                <span className="text-primary-light">Basket</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className="font-montserrat text-gray-700 hover:text-primary transition-colors"
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
                  className="w-64 pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            {/* Action Icons */}
            <div className="flex items-center space-x-4">
              <button 
                onClick={toggleSearch}
                className="md:hidden p-2 text-gray-600 hover:text-primary transition-colors"
              >
                <Search className="h-6 w-6" />
              </button>
              
              {user ? (
                <UserNav />
              ) : (
                <Link 
                  to="/auth" 
                  className="p-2 text-gray-600 hover:text-primary transition-colors"
                >
                  Sign In
                </Link>
              )}
              
              <button 
                onClick={openCart}
                className="p-2 text-gray-600 hover:text-primary transition-colors relative"
              >
                <ShoppingCart className="h-6 w-6" />
                {state.totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {state.totalItems > 99 ? '99+' : state.totalItems}
                  </span>
                )}
              </button>
              <button 
                onClick={toggleMenu}
                className="md:hidden p-2 text-gray-600 hover:text-primary transition-colors"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div 
            className={cn(
              "transition-all duration-300 overflow-hidden md:hidden",
              isSearchOpen ? "max-h-20 opacity-100 mt-4" : "max-h-0 opacity-0"
            )}
          >
            <div className="relative">
              <input
                type="text"
                placeholder="Search fresh produce..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Mobile Menu */}
          <div 
            className={cn(
              "transition-all duration-300 overflow-hidden md:hidden",
              isMenuOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <nav className="flex flex-col space-y-4 mt-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className="font-montserrat text-gray-700 hover:text-primary transition-colors py-2 border-b border-gray-100"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      
      {/* Cart Drawer */}
      <CartDrawer />
    </>
  );
};

export default Navbar;
