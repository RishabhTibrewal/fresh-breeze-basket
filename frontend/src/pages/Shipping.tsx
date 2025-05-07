import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const Shipping = () => {
  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center font-playfair text-primary">Shipping & Delivery</h1>
          
          <div className="space-y-8 mb-12">
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Delivery Areas</h2>
              <p className="text-gray-600 mb-4">
                Fresh Breeze Basket currently delivers to all major residential and commercial areas in Dubai. 
                During checkout, you can enter your address to confirm if delivery is available in your area.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700 text-sm">
                <strong>Good to know:</strong> We're continuously expanding our delivery areas. If your area is not currently covered, 
                please contact us and we'll notify you when we add your location.
              </div>
            </section>
            
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Delivery Times</h2>
              <p className="text-gray-600 mb-4">
                We offer delivery slots between 8:00 AM and 10:00 PM, seven days a week.
                During checkout, you can select your preferred delivery time from the available slots.
              </p>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200">
                  <div className="p-3 font-medium text-gray-700">Delivery Type</div>
                  <div className="p-3 font-medium text-gray-700">Cutoff Time</div>
                </div>
                <div className="grid grid-cols-2 border-b border-gray-200">
                  <div className="p-3 text-sm">Same Day Delivery</div>
                  <div className="p-3 text-sm">Orders placed before 11:00 AM</div>
                </div>
                <div className="grid grid-cols-2 border-b border-gray-200">
                  <div className="p-3 text-sm">Next Day Delivery</div>
                  <div className="p-3 text-sm">Orders placed before 10:00 PM</div>
                </div>
                <div className="grid grid-cols-2">
                  <div className="p-3 text-sm">Scheduled Delivery</div>
                  <div className="p-3 text-sm">Up to 7 days in advance</div>
                </div>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Delivery Fees</h2>
              <p className="text-gray-600 mb-4">
                Our delivery fees are calculated based on your location and order value:
              </p>
              <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
                <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200">
                  <div className="p-3 font-medium text-gray-700">Order Value</div>
                  <div className="p-3 font-medium text-gray-700">Delivery Fee</div>
                </div>
                <div className="grid grid-cols-2 border-b border-gray-200">
                  <div className="p-3 text-sm">Under AED 100</div>
                  <div className="p-3 text-sm">AED 15</div>
                </div>
                <div className="grid grid-cols-2 border-b border-gray-200">
                  <div className="p-3 text-sm">AED 100 - 200</div>
                  <div className="p-3 text-sm">AED 10</div>
                </div>
                <div className="grid grid-cols-2">
                  <div className="p-3 text-sm">Above AED 200</div>
                  <div className="p-3 text-sm font-medium text-green-600">FREE</div>
                </div>
              </div>
              <p className="text-gray-600 text-sm">
                Additional charges may apply for express delivery or remote locations.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Delivery Process</h2>
              <ol className="list-decimal list-inside space-y-3 text-gray-600">
                <li className="pl-2">
                  <span className="font-medium text-gray-700">Order Confirmation:</span> You'll receive an order confirmation via email immediately after placing your order.
                </li>
                <li className="pl-2">
                  <span className="font-medium text-gray-700">Preparation:</span> Our team carefully selects and packs your items on the day of delivery to ensure maximum freshness.
                </li>
                <li className="pl-2">
                  <span className="font-medium text-gray-700">Delivery Notification:</span> You'll receive an SMS when your delivery is on its way with an estimated arrival time.
                </li>
                <li className="pl-2">
                  <span className="font-medium text-gray-700">Delivery:</span> Our driver will deliver your order to your doorstep in temperature-controlled packaging.
                </li>
              </ol>
            </section>
            
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Tracking Your Order</h2>
              <p className="text-gray-600 mb-4">
                You can track your order in real-time through:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Your account dashboard on our website</li>
                <li>The tracking link sent via SMS and email</li>
                <li>Contacting our customer service team</li>
              </ul>
            </section>
          </div>
          
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-primary mb-4">Have questions about delivery?</h2>
            <p className="text-gray-600 mb-4">
              Our customer service team is ready to assist you with any delivery-related queries.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="/contact" 
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light"
              >
                Contact Us
              </a>
              <a 
                href="/faq" 
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light"
              >
                View FAQs
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Shipping; 