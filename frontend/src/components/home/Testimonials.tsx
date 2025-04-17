
import React from 'react';
import { Star } from 'lucide-react';

const testimonials = [
  {
    id: 1,
    name: 'Sarah',
    location: 'Downtown Dubai',
    stars: 5,
    text: 'The quality of the produce is exceptional! Everything arrives fresh and lasts much longer than supermarket options. The same-day delivery is a game-changer for my busy schedule.'
  },
  {
    id: 2,
    name: 'Mohammed',
    location: 'Jumeirah',
    stars: 5,
    text: "I've been ordering from FreshBasket for three months now, and I'm consistently impressed by the freshness and quality. Their organic selection is excellent, and the customer service is top-notch."
  },
  {
    id: 3,
    name: 'Lisa',
    location: 'Arabian Ranches',
    stars: 4,
    text: 'The family fresh box has been perfect for our household. Great variety each week and the kids are eating more vegetables now! Occasionally a few items could be riper, but overall wonderful service.'
  }
];

const Testimonials = () => {
  return (
    <section className="py-12 md:py-16 bg-primary bg-opacity-5">
      <div className="container mx-auto px-4">
        <h2 className="section-title text-center">What Our Customers Say</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex space-x-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < testimonial.stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-gray-600 mb-4 italic">"{testimonial.text}"</p>
              <div className="font-semibold">
                {testimonial.name}
                <span className="text-gray-500 font-normal"> • {testimonial.location}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
