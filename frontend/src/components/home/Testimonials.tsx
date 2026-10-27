
import React from 'react';
import { Star, Leaf } from 'lucide-react';

const REVIEWS = [
  {
    id: 1,
    name: 'Priya Sharma',
    location: 'Delhi',
    stars: 5,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    text: 'The vegetables are always fresh and of great quality. Packaging is neat and delivery is on time. Very happy with my purchase!',
    productTag: 'Fresh Vegetables',
    productImg: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=100&q=80',
  },
  {
    id: 2,
    name: 'Rohit Mehta',
    location: 'Noida',
    stars: 5,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    text: 'I have been ordering rice and pulses from here for months. The quality is excellent and the grains are clean and fresh.',
    productTag: 'Premium Rice',
    productImg: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=100&q=80',
  },
  {
    id: 3,
    name: 'Neha Kapoor',
    location: 'Gurgaon',
    stars: 5,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
    text: 'Loved the variety of pulses and grains. Everything feels fresh, natural and healthy. Will definitely order again!',
    productTag: 'Pulses & Grains',
    productImg: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=100&q=80',
  },
];

const Testimonials = () => {
  return (
    <section className="py-16 md:py-24 bg-[#F4F8F3] relative overflow-hidden border-b border-green-100/50">
      
      {/* Floating background leaf accents */}
      <div className="absolute top-10 right-10 opacity-20 pointer-events-none">
        <Leaf className="w-20 h-20 text-[#276B3C] transform rotate-45" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Column: Heading & Overall Rating Score */}
          <div className="lg:col-span-4 flex flex-col justify-between h-full">
            <div>
              {/* Subtitle Badge */}
              <div className="inline-flex items-center gap-2 text-[#276B3C] font-semibold text-sm mb-2">
                <Leaf className="w-4 h-4 fill-[#276B3C]" />
                <span>Happy Customers</span>
              </div>

              {/* Title */}
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1E502B] font-serif mb-4 leading-tight">
                Real Reviews,<br />Real Goodness
              </h2>

              <p className="text-gray-600 text-base mb-8 leading-relaxed">
                From fresh produce to daily essentials, our customers love the quality, freshness and service.
              </p>

              {/* Rating Counter Box */}
              <div className="bg-white p-5 rounded-2xl border border-green-100 shadow-sm inline-block w-full max-w-xs mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl font-extrabold text-[#1E502B]">4.8/5</span>
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-medium">
                  Based on 2,500+ happy customers
                </p>
              </div>
            </div>

            {/* Bottom Graphic Banner */}
            <div className="relative mt-4">
              <div className="rounded-2xl overflow-hidden shadow-lg border-2 border-white relative">
                <img 
                  src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80" 
                  alt="Fresh farm produce" 
                  className="w-full h-44 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                  <div className="text-white font-serif italic text-lg font-semibold flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-green-400" />
                    <span>Thank you for your trust</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Customer Testimonial Cards */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {REVIEWS.map((review) => (
              <div 
                key={review.id}
                className="bg-white rounded-2xl p-6 border border-green-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Customer Info Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <img 
                      src={review.avatar} 
                      alt={review.name} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-green-200"
                    />
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{review.name}</h4>
                      <p className="text-xs text-gray-500">{review.location}</p>
                      <div className="flex text-amber-400 mt-0.5">
                        {[...Array(review.stars)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Review Text */}
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-6 italic">
                    "{review.text}"
                  </p>
                </div>

                {/* Associated Product Tag */}
                <div className="pt-4 border-t border-gray-100 flex items-center gap-3 bg-[#F9FAF8] p-2.5 rounded-xl">
                  <img 
                    src={review.productImg} 
                    alt={review.productTag} 
                    className="w-10 h-10 rounded-lg object-cover border border-green-100"
                  />
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">Verified Order</span>
                    <span className="text-xs font-bold text-[#1E502B]">{review.productTag}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
};

export default Testimonials;

