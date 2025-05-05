
import React from 'react';
import { Building, Mail, MapPin, Phone, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const AboutUs = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {/* Hero Section */}
        <div className="bg-primary text-white py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">About Us</h1>
            <p className="text-lg md:text-xl max-w-3xl">
              Fresh Basket brings quality produce directly from farms to your table. 
              Our mission is to provide fresh, organic food while supporting local farmers.
            </p>
          </div>
        </div>
        
        {/* Our Story */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="md:w-1/2">
                <img 
                  src="https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=1200&auto=format" 
                  alt="Our Team" 
                  className="rounded-lg shadow-lg w-full h-auto"
                />
              </div>
              <div className="md:w-1/2">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Our Story</h2>
                <p className="text-gray-600 mb-4">
                  Founded in 2020, FreshBasket began with a simple idea: to make fresh, 
                  organic produce accessible to everyone. What started as a small farmers' 
                  market stand has grown into an online marketplace connecting consumers 
                  directly with local farmers and producers.
                </p>
                <p className="text-gray-600 mb-4">
                  We believe in transparency, sustainability, and supporting local communities. 
                  By cutting out middlemen, we ensure farmers receive fair compensation for 
                  their hard work, while customers enjoy the freshest produce at reasonable prices.
                </p>
                <p className="text-gray-600">
                  Today, we're proud to serve thousands of customers, partnering with over 
                  50 local farms and artisanal food producers to bring the best seasonal 
                  offerings directly to your doorstep.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Our Values */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center mb-4">
                  <span className="text-xl text-white">1</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Freshness First</h3>
                <p className="text-gray-600">
                  We harvest to order, ensuring that produce reaches you at peak freshness, 
                  often within 24 hours of being picked.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center mb-4">
                  <span className="text-xl text-white">2</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Sustainability</h3>
                <p className="text-gray-600">
                  We use eco-friendly packaging and support farms that employ sustainable 
                  agricultural practices.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center mb-4">
                  <span className="text-xl text-white">3</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">Community Support</h3>
                <p className="text-gray-600">
                  By supporting local farmers, we help strengthen the local economy and 
                  reduce the environmental impact of long-distance food transportation.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Contact Information */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">Get In Touch</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Visit Us</h3>
                <p className="text-gray-600">
                  123 Fresh Street<br />
                  Organic City, OC 12345
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
                  <Phone className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Call Us</h3>
                <p className="text-gray-600">
                  (555) 123-4567<br />
                  Mon-Fri: 9am-6pm
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Email Us</h3>
                <p className="text-gray-600">
                  info@freshbasket.com<br />
                  support@freshbasket.com
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Business Hours</h3>
                <p className="text-gray-600">
                  Mon-Fri: 9am-6pm<br />
                  Sat: 10am-4pm
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Team Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">Meet Our Team</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  name: "Sarah Johnson",
                  position: "Founder & CEO",
                  image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80"
                },
                {
                  name: "Michael Chen",
                  position: "Head of Operations",
                  image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80"
                },
                {
                  name: "Elena Rodriguez",
                  position: "Farm Relations",
                  image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80"
                },
                {
                  name: "David Kim",
                  position: "Head of Logistics",
                  image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80"
                }
              ].map((member, index) => (
                <div key={index} className="bg-white p-6 rounded-lg shadow-md text-center">
                  <div className="w-24 h-24 mx-auto mb-4 overflow-hidden rounded-full">
                    <img 
                      src={member.image} 
                      alt={member.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-semibold mb-1">{member.name}</h3>
                  <p className="text-gray-600 mb-4">{member.position}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AboutUs;
