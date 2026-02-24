import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import Hero from '@/components/home/Hero';
import ValueProps from '@/components/home/ValueProps';
import FeaturedCategories from '@/components/home/FeaturedCategories';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import SpecialsCarousel from '@/components/home/SpecialsCarousel';
import Testimonials from '@/components/home/Testimonials';
import HowItWorks from '@/components/home/HowItWorks';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Home } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showDashboardButton, setShowDashboardButton] = useState(false);

  useEffect(() => {
    // Show dashboard button if user is logged in and came from login
    if (user) {
      const fromLogin = sessionStorage.getItem('from_login') === 'true';
      setShowDashboardButton(fromLogin || true); // Always show for logged-in users
    }
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Dashboard Access Button (shown for logged-in users) */}
      {showDashboardButton && (
        <div className="bg-gradient-to-r from-primary to-primary-light text-white py-3">
          <div className="container mx-auto px-4 flex justify-between items-center">
            <p className="text-sm">Welcome! Access all your business modules from the dashboard.</p>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}

      <main className="flex-grow">
        <Hero />
        <ValueProps />
        <FeaturedCategories />
        <FeaturedProducts />
        <SpecialsCarousel />
        <HowItWorks />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
