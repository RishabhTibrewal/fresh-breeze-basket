
import React from 'react';
import { Truck, Shield, Leaf, Thermometer } from 'lucide-react';

const ValueProps = () => {
  const values = [
    {
      icon: <Truck className="h-10 w-10 text-primary" />,
      title: 'Same-Day Delivery',
      description: 'Order before 2 PM for delivery on the same day'
    },
    {
      icon: <Shield className="h-10 w-10 text-primary" />,
      title: '100% Freshness Guarantee',
      description: "Not satisfied? We'll replace it or refund you"
    },
    {
      icon: <Leaf className="h-10 w-10 text-primary" />,
      title: 'Locally Sourced When Possible',
      description: 'We prioritize local farms and sustainable practices'
    },
    {
      icon: <Thermometer className="h-10 w-10 text-primary" />,
      title: 'Cold Chain Maintained',
      description: 'Temperature controlled from farm to your doorstep'
    }
  ];

  return (
    <section className="py-12 md:py-16 bg-cream">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((value, index) => (
            <div 
              key={index} 
              className="bg-white p-6 rounded-lg shadow-md text-center transition-transform hover:scale-105"
            >
              <div className="inline-flex items-center justify-center mb-4">
                {value.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">{value.title}</h3>
              <p className="text-gray-600">{value.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ValueProps;
