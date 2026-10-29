import React from 'react';
import { Heart } from 'lucide-react';

export const CartBottomBanner: React.FC = () => {
  return (
    <section className="relative rounded-3xl overflow-hidden border border-[#dce8d3] my-8 shadow-sm">
      {/* Background Farm Landscape */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80')`,
        }}
      />
      {/* Soft gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#f4f8f1]/95 via-[#f4f8f1]/80 to-transparent sm:to-[#f4f8f1]/30 z-0" />

      {/* Decorative Dangling Corner Leaves */}
      <div className="hidden sm:block absolute top-0 left-4 pointer-events-none opacity-90 z-10">
        <svg
          className="w-20 h-24 text-[#4C8C2B]"
          viewBox="0 0 100 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M10 0C15 25 35 45 60 50C40 60 15 50 10 0Z"
            fill="#4C8C2B"
            fillOpacity="0.85"
          />
          <path
            d="M5 25C20 45 45 65 75 65C50 78 20 65 5 25Z"
            fill="#3B7A23"
            fillOpacity="0.9"
          />
          <path
            d="M0 60C18 75 35 95 55 105C35 110 15 95 0 60Z"
            fill="#68A83E"
            fillOpacity="0.75"
          />
        </svg>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 items-center p-6 sm:p-10 min-h-[220px] sm:min-h-[260px]">
        {/* Left Handwritten Script Callout */}
        <div className="md:col-span-6 flex flex-col items-start pl-4 sm:pl-8">
          <div className="relative bg-[#ebf4e6]/90 backdrop-blur-sm border border-[#d2e4cb] rounded-3xl p-5 sm:p-6 shadow-sm transform -rotate-2 max-w-xs">
            <div className="font-blackbones text-2xl sm:text-3xl text-[#1E502B] leading-tight">
              Pure Natural
              <br />
              Healthy <Heart className="inline w-4 h-4 text-[#2E7D32] fill-[#2E7D32]/30" />
            </div>
            <svg
              className="w-32 h-3.5 text-[#2E7D32] mt-1 transform -rotate-1"
              viewBox="0 0 140 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 11C40 4 95 3 136 5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Right Rice Bowl & Harvest Graphic */}
        <div className="md:col-span-6 flex justify-center md:justify-end mt-6 md:mt-0 pr-0 sm:pr-4">
          <div className="relative rounded-2xl overflow-hidden shadow-md border-2 border-white/80 max-w-xs sm:max-w-sm">
            <img
              src="https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80"
              alt="Fresh harvest grains and wholesome rice"
              className="w-full h-44 sm:h-48 object-cover hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <div className="absolute bottom-2.5 left-3 text-white text-xs font-semibold drop-shadow">
              Farm Harvested Goodness
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

