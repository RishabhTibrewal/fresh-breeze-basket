
import React from 'react';
import Hero from '@/components/home/Hero';
import ValueProps from '@/components/home/ValueProps';
import FeaturedCategories from '@/components/home/FeaturedCategories';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import SpecialsCarousel from '@/components/home/SpecialsCarousel';
import Testimonials from '@/components/home/Testimonials';
import HowItWorks from '@/components/home/HowItWorks';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
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
