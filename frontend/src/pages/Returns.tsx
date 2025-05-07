import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const Returns = () => {
  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center font-playfair text-primary">Returns & Refunds</h1>
          <p className="text-gray-600 mb-8 text-center">
            At Fresh Breeze Basket, we're committed to your satisfaction. Learn about our returns and refunds policy below.
          </p>
          
          <div className="space-y-8 mb-12">
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Our Fresh Guarantee</h2>
              <p className="text-gray-600 mb-4">
                We stand behind the quality of all our products. If you receive any items that don't meet our quality standards, 
                we'll gladly replace them or refund your purchase.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700 text-sm">
                <strong>Our Promise:</strong> If you're not completely satisfied with any product's freshness or quality, 
                we'll make it right—no questions asked.
              </div>
            </section>
            
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Return Policy</h2>
              <p className="text-gray-600 mb-4">
                Because we deal with perishable goods, our return policy is designed to ensure quick resolution:
              </p>
              <ul className="list-disc list-inside space-y-3 text-gray-600 ml-2">
                <li><span className="font-medium text-gray-700">Time Frame:</span> Notify us within 24 hours of delivery</li>
                <li><span className="font-medium text-gray-700">Documentation:</span> Photos of the affected items help us improve quality control</li>
                <li><span className="font-medium text-gray-700">Process:</span> No need to return perishable items—we'll take your word and process your refund</li>
                <li><span className="font-medium text-gray-700">Non-perishable items:</span> Must be unopened and in original packaging for returns</li>
              </ul>
            </section>
            
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">How to Request a Return or Refund</h2>
              <ol className="list-decimal list-inside space-y-3 text-gray-600">
                <li className="pl-2">
                  <span className="font-medium text-gray-700">Contact Customer Service:</span> Reach out via email, phone, or the contact form on our website.
                </li>
                <li className="pl-2">
                  <span className="font-medium text-gray-700">Provide Details:</span> Include your order number, the items you're unhappy with, and the reason for your dissatisfaction.
                </li>
                <li className="pl-2">
                  <span className="font-medium text-gray-700">Share Images:</span> If possible, send photos of the products to help us improve our quality control.
                </li>
                <li className="pl-2">
                  <span className="font-medium text-gray-700">Choose Your Preference:</span> Let us know if you prefer a replacement or refund.
                </li>
              </ol>
            </section>
            
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Refund Methods and Timeline</h2>
              <div className="border border-gray-200 rounded-md overflow-hidden mb-4">
                <div className="grid grid-cols-2 bg-gray-50 border-b border-gray-200">
                  <div className="p-3 font-medium text-gray-700">Payment Method</div>
                  <div className="p-3 font-medium text-gray-700">Refund Timeline</div>
                </div>
                <div className="grid grid-cols-2 border-b border-gray-200">
                  <div className="p-3 text-sm">Credit/Debit Card</div>
                  <div className="p-3 text-sm">3-5 business days</div>
                </div>
                <div className="grid grid-cols-2 border-b border-gray-200">
                  <div className="p-3 text-sm">Store Credit</div>
                  <div className="p-3 text-sm">Immediate</div>
                </div>
                <div className="grid grid-cols-2">
                  <div className="p-3 text-sm">Cash on Delivery</div>
                  <div className="p-3 text-sm">Refunded as store credit</div>
                </div>
              </div>
            </section>
            
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Exceptions</h2>
              <p className="text-gray-600 mb-4">
                While we strive for 100% satisfaction, there are a few exceptions to our return policy:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 ml-2">
                <li>Custom-prepared items (e.g., pre-cut fruit platters)</li>
                <li>Products with clear consumption/usage indicators</li>
                <li>Items marked as final sale or clearance</li>
                <li>Requests made after the 24-hour notification window</li>
              </ul>
              <p className="mt-4 text-gray-600">
                However, we review each situation on a case-by-case basis and always aim to ensure customer satisfaction.
              </p>
            </section>
            
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">Damaged or Incorrect Orders</h2>
              <p className="text-gray-600 mb-4">
                If your order arrives damaged or if you receive incorrect items:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 ml-2">
                <li>Document the issue with photos when possible</li>
                <li>Contact us immediately</li>
                <li>We'll expedite a replacement delivery or issue an immediate refund</li>
              </ul>
            </section>
          </div>
          
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-primary mb-4">Need assistance with a return or refund?</h2>
            <p className="text-gray-600 mb-4">
              Our customer service team is ready to help make things right.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="/contact" 
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light"
              >
                Contact Us
              </a>
              <a 
                href="mailto:returns@freshbasket.ae" 
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light"
              >
                Email Returns Team
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Returns; 