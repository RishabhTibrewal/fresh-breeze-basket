
import React from 'react';
import { ShoppingCart, Clock, Truck, Utensils } from 'lucide-react';

const HowItWorks = () => {
  const steps = [
    {
      icon: <ShoppingCart className="h-12 w-12 text-primary" />,
      title: 'Choose your fresh produce',
      description: 'Browse our wide selection of fruits and vegetables'
    },
    {
      icon: <Clock className="h-12 w-12 text-primary" />,
      title: 'Select delivery time',
      description: 'Choose a convenient time slot for delivery'
    },
    {
      icon: <Truck className="h-12 w-12 text-primary" />,
      title: 'Receive at your door',
      description: 'Our refrigerated vehicles maintain the cold chain'
    },
    {
      icon: <Utensils className="h-12 w-12 text-primary" />,
      title: 'Enjoy farm-fresh quality',
      description: 'Experience the taste of freshly harvested produce'
    }
  ];

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <h2 className="section-title text-center">How It Works</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center">
              <div className="relative">
                <div className="flex items-center justify-center mx-auto mb-4 w-24 h-24 rounded-full bg-primary bg-opacity-10">
                  {step.icon}
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gray-200 -z-10">
                    <div className="absolute top-1/2 left-1/2 transform -translate-y-1/2 w-3 h-3 rounded-full bg-primary"></div>
                  </div>
                )}
              </div>
              <h3 className="text-xl font-semibold mb-2">Step {index + 1}: {step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
