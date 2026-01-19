import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Disclosure } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';

const FAQ = () => {
  const faqs = [
    {
      question: "How does Fresh Breeze Basket delivery work?",
      answer: "We deliver fresh produce directly to your home or office in Dubai. Choose your items, select a delivery time, and we'll bring them straight to your doorstep in temperature-controlled vehicles to ensure freshness."
    },
    {
      question: "What areas do you deliver to?",
      answer: "We currently deliver to all major areas in Dubai. Enter your address during checkout to confirm if delivery is available in your area."
    },
    {
      question: "How do I know my produce will be fresh?",
      answer: "We source our products directly from local farms and international suppliers daily. All produce is inspected for quality and freshness before delivery, and we guarantee freshness with our satisfaction policy."
    },
    {
      question: "What if I'm not home during delivery?",
      answer: "Our delivery team will contact you before arrival. If you're not available, you can arrange for someone else to receive your order or reschedule delivery for a more convenient time."
    },
    {
      question: "Can I modify or cancel my order?",
      answer: "Yes, you can modify or cancel your order up to 24 hours before the scheduled delivery time through your account dashboard or by contacting our customer service team."
    },
    {
      question: "How do I track my order?",
      answer: "Once your order is confirmed, you'll receive a tracking link via email and SMS. You can also track your order in real-time through your account dashboard on our website."
    },
    {
      question: "Do you offer subscriptions or recurring deliveries?",
      answer: "Yes, we offer weekly and bi-weekly subscription boxes for both mixed produce and specialized selections. You can customize your subscription through your account dashboard."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards, Apple Pay, Google Pay, and cash on delivery for orders under ₹ 500."
    },
    {
      question: "Are your products organic?",
      answer: "We offer both conventional and certified organic products. Organic items are clearly labeled in our store with our 'Certified Organic' badge."
    },
    {
      question: "How do I contact customer service?",
      answer: "You can reach our customer service team via email at support@freshbasket.ae, by phone at +971 4 123 4567, or through the contact form on our website. We're available 7 days a week from 8am to 8pm."
    }
  ];

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center font-playfair text-primary">Frequently Asked Questions</h1>
          <p className="text-gray-600 mb-8 text-center">
            Find answers to the most common questions about Fresh Breeze Basket's services.
          </p>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Disclosure key={index} as="div" className="border border-gray-200 rounded-lg overflow-hidden">
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex justify-between w-full px-4 py-4 text-left text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring focus-visible:ring-primary-light">
                      <span className="text-gray-900 font-semibold">{faq.question}</span>
                      <ChevronDown
                        className={`${
                          open ? 'transform rotate-180' : ''
                        } w-5 h-5 text-primary-light`}
                      />
                    </Disclosure.Button>
                    <Disclosure.Panel className="px-4 py-4 text-sm text-gray-600 bg-gray-50 border-t border-gray-200">
                      {faq.answer}
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            ))}
          </div>
          
          <div className="mt-12 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-primary mb-4">Still have questions?</h2>
            <p className="text-gray-600 mb-4">
              Our customer service team is here to help you with any questions you might have.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="/contact" 
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light"
              >
                Contact Us
              </a>
              <a 
                href="tel:+97141234567" 
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light"
              >
                Call Us: +971 4 123 4567
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default FAQ; 