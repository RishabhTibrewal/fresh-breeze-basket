
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, ShieldCheck, Truck, Sparkles } from 'lucide-react';

const Hero = () => {
  return (
    <section
      className="relative w-full bg-cover bg-bottom bg-no-repeat min-h-[80vh] lg:min-h-[85vh] flex items-center overflow-hidden pt-10 sm:pt-14 lg:pt-16 pb-0 border-b border-green-100/50"
      style={{ backgroundImage: `url('/hero-layers/bg-table.png')` }}
    >
      {/* Background Green Organic Shape Overlay (Right Side) */}
      <div className="absolute top-0 right-0 h-full w-full lg:w-3/5 xl:w-1/2 flex justify-end pointer-events-none z-0">
        <img
          src="/hero-layers/shape-green-nobg.png"
          alt="Green design shape background"
          className="h-full w-auto max-w-full object-contain object-right opacity-90"
        />
      </div>

      {/* Ambient Leaf Accents */}
      <div className="absolute top-8 left-8 opacity-20 pointer-events-none z-0">
        <Leaf className="w-16 h-16 text-[#276B3C] transform -rotate-45" />
      </div>

      {/* Full Screen Content Container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">

          {/* Left Column: Text Content & Value Props */}
          <div className="lg:col-span-6 flex flex-col justify-center text-left py-6 lg:py-10">

            {/* Tagline Pill */}
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md text-[#276B3C] px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold w-fit mb-4 sm:mb-6 shadow-sm border border-green-200/60">
              <Leaf className="w-4 h-4 fill-[#276B3C]" />
              <span>Why Choose Us</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-[#1E502B] leading-[1.1] font-serif mb-4 tracking-tight">
              Good Food.<br />
              <span className="text-[#276B3C]">Better Living.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-gray-700 text-sm sm:text-base lg:text-lg max-w-xl mb-6 sm:mb-8 leading-relaxed font-sans font-medium">
              We bring you the freshest produce, purest grains and everyday essentials — so you and your family can live healthier, every day.
            </p>

            {/* 4 Feature Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 max-w-2xl">
              {/* Feature 1 */}
              <div className="flex flex-col items-start bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-green-100/70 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-1.5 shrink-0">
                  <Leaf className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Fresh Produce</h4>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 leading-tight">Handpicked for quality</p>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col items-start bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-green-100/70 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-1.5 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Quality Assured</h4>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 leading-tight">Clean, safe & trusted</p>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col items-start bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-green-100/70 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-1.5 shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-gray-900 text-xs sm:text-sm">Fast Delivery</h4>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 leading-tight">At your convenience</p>
              </div>

              {/* Feature 4 */}
              <div className="flex flex-col items-start bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-green-100/70 shadow-xs">
                <div className="w-8 h-8 rounded-full bg-[#E8F5E9] text-[#276B3C] flex items-center justify-center mb-1.5 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-gray-900 text-xs sm:text-sm">100% Natural</h4>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 leading-tight">No harmful chemicals</p>
              </div>
            </div>

            {/* Shop Now CTA Button */}
            <div>
              <Link
                to="/products"
                className="inline-flex items-center gap-3 bg-[#276B3C] hover:bg-[#1E502B] text-white font-semibold px-8 py-3.5 sm:px-9 sm:py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 text-base"
              >
                <span>Shop Now</span>
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </Link>
            </div>

          </div>

          {/* Right Column: Layered Produce Basket Cut-out & Floating Badge (Touching Table) */}
          <div className="lg:col-span-6 relative flex justify-end items-end self-end mt-4 lg:mt-0">

            {/* Floating "Freshness in Every Basket" Badge Text */}
            <div className="absolute top-0 sm:top-2 right-0 sm:right-2 z-20 pointer-events-none transform -rotate-2">
              <div className="text-[#f4f6e8] font-blackbones font-bold text-3xl sm:text-4xl lg:text-5xl drop-shadow-xl text-right leading-tight tracking-wide">
                Freshness<br />
                <span className="text-2xl sm:text-3xl lg:text-4xl">in Every Basket</span>
              </div>
            </div>

            {/* Layer 2: Transparent Produce Basket Cut-out Image resting directly on bottom table */}
            <div className="relative z-10 w-full flex justify-end ml-auto translate-y-1.5 sm:translate-y-2">
              <img
                src="/hero-layers/produce-basket-nobg.png"
                alt="Fresh produce basket with fruits, grains and vegetables"
                className="ml-auto w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl h-auto object-contain object-right drop-shadow-2xl transform hover:scale-[1.02] transition-transform duration-500"
              />
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;






