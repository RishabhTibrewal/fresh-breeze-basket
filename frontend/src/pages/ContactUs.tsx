import React, { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Sprout,
  Leaf,
  ShieldCheck,
  Truck,
  Heart,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { toast } from 'sonner';

const ContactUs = () => {
  const supportFeatures = [
    {
      icon: <Leaf className="w-5 h-5" />,
      title: 'Quick Support',
      desc: "We're just a call or message away.",
    },
    {
      icon: <ShieldCheck className="w-5 h-5" />,
      title: 'Trusted & Secure',
      desc: 'Your information is always safe with us.',
    },
    {
      icon: <Truck className="w-5 h-5" />,
      title: 'Same-Day Delivery',
      desc: 'Order before 2 PM for delivery on the same day',
    },
    {
      icon: <Heart className="w-5 h-5" />,
      title: 'Customer First',
      desc: 'Your satisfaction matters to us.',
    },
  ];

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Thank you! Your message has been sent and we'll get back to you soon.");
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-grow">
        {/* 1. Top Hero Banner */}
        <section className="pt-4 pb-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="relative rounded-2xl overflow-hidden bg-cover bg-bottom border border-green-100 shadow-sm"
              style={{ backgroundImage: `url('/hero-layers/bg-table.png')` }}
            >
              {/* Soft Left Gradient for Readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#eef6e8]/95 via-[#eef6e8]/80 to-transparent z-0" />

              {/* Decorative Corner Leaves */}
              <div className="hidden sm:block absolute top-3 left-3 pointer-events-none opacity-80 z-10">
                <Leaf className="w-9 h-9 text-[#4C8C2B] fill-[#68A83E]/80 transform -rotate-45" />
              </div>
              <div className="hidden sm:block absolute bottom-3 left-3 pointer-events-none opacity-80 z-10">
                <Leaf className="w-8 h-8 text-[#4C8C2B] fill-[#68A83E]/80 transform rotate-12" />
              </div>

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center px-6 sm:px-10 lg:px-14 pt-8 pb-6 lg:py-10">
                {/* Left Copy */}
                <div className="lg:col-span-6">
                  <div className="inline-flex items-center gap-2 text-[#1E502B] font-bold text-base sm:text-lg mb-3">
                    <Sprout className="w-6 h-6 text-[#276B3C]" />
                    <span>Get in Touch</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-[#1E502B] leading-[1.1] mb-4 tracking-tight">
                    We’re Here
                    <br />
                    to Help You
                  </h1>

                  <p className="text-[#1E502B]/90 text-sm sm:text-base lg:text-lg font-medium max-w-md leading-relaxed">
                    Have a question, suggestion or need assistance?
                    <br />
                    We’d love to hear from you!
                  </p>
                </div>

                {/* Right Overflowing Produce Basket */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <img
                    src="/hero-layers/produce-basket-nobg.png"
                    alt="Fresh vegetables in a wicker basket"
                    className="w-full max-w-md lg:max-w-lg h-auto object-contain drop-shadow-xl transform translate-y-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Contact Details, Support Highlights & Message Form */}
        <section className="py-6 lg:py-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left Column: Phone, Email, Location */}
              <div className="lg:col-span-3 space-y-8">
                {/* Phone */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#e4f0dc] border border-[#cde0be] flex items-center justify-center shrink-0 text-[#1E502B]">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E502B] mb-0.5">Phone</h3>
                    <p className="text-sm font-semibold text-[#1E502B]">+971 4 123 4567</p>
                    <p className="text-xs text-[#276B3C]/80 mt-0.5">Mon-Fri: 9am-6pm</p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#e4f0dc] border border-[#cde0be] flex items-center justify-center shrink-0 text-[#1E502B]">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E502B] mb-0.5">Email</h3>
                    <p className="text-xs sm:text-sm font-medium text-[#1E502B]">
                      info@freshbasket.ae
                    </p>
                    <p className="text-xs sm:text-sm text-[#276B3C]/90">
                      support@freshbasket.ae
                    </p>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#e4f0dc] border border-[#cde0be] flex items-center justify-center shrink-0 text-[#1E502B]">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1E502B] mb-0.5">Our Location</h3>
                    <p className="text-xs sm:text-sm font-medium text-[#1E502B]">
                      Sheikh Zayed Road
                    </p>
                    <p className="text-xs sm:text-sm text-[#276B3C]/90">Dubai, UAE</p>
                  </div>
                </div>
              </div>

              {/* Middle Column: 4 Support Highlights (with left border on desktop) */}
              <div className="lg:col-span-4 lg:border-l lg:border-gray-200 lg:pl-10 space-y-6">
                {supportFeatures.map((feat) => (
                  <div key={feat.title} className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#e4f0dc] border border-[#cde0be] flex items-center justify-center shrink-0 text-[#1E502B]">
                      {feat.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1E502B] mb-0.5">{feat.title}</h3>
                      <p className="text-xs text-[#276B3C]/85 leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Column: Send Us a Message Card */}
              <div className="lg:col-span-5">
                <div className="bg-[#eaf3e4] rounded-2xl p-6 sm:p-8 border border-[#d8e8ce] shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#1E502B] mb-1">
                    Send Us a Message
                  </h2>
                  <p className="text-xs sm:text-sm text-[#276B3C] mb-5">
                    Fill in the form below and we’ll get back to you soon.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    <div>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Your Name"
                        className="w-full px-4 py-2.5 bg-white text-sm text-gray-800 placeholder:text-[#276B3C]/70 rounded-xl border border-[#d5e5cb] focus:outline-none focus:ring-2 focus:ring-[#276B3C]"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Your Email"
                        className="w-full px-4 py-2.5 bg-white text-sm text-gray-800 placeholder:text-[#276B3C]/70 rounded-xl border border-[#d5e5cb] focus:outline-none focus:ring-2 focus:ring-[#276B3C]"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        required
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Subject"
                        className="w-full px-4 py-2.5 bg-white text-sm text-gray-800 placeholder:text-[#276B3C]/70 rounded-xl border border-[#d5e5cb] focus:outline-none focus:ring-2 focus:ring-[#276B3C]"
                      />
                    </div>
                    <div>
                      <textarea
                        rows={4}
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Your Message"
                        className="w-full px-4 py-2.5 bg-white text-sm text-gray-800 placeholder:text-[#276B3C]/70 rounded-xl border border-[#d5e5cb] focus:outline-none focus:ring-2 focus:ring-[#276B3C] resize-y"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-[#1E502B] hover:bg-[#276B3C] text-white font-semibold text-sm py-3 px-6 rounded-full shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Message</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Map Section */}
        <section className="py-6">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-200/80 h-[280px] sm:h-[340px]">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3609.9568340138995!2d55.274098!3d25.197001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e5f4275f638be35%3A0x7c4413fc285c7e90!2sSheikh%20Zayed%20Rd%20-%20Dubai!5e0!3m2!1sen!2sae!4v1713164550305!5m2!1sen!2sae"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="FreshBasket Location"
              />
            </div>
          </div>
        </section>

        {/* 4. Bottom Banner: "We're Closer Than You Think!" */}
        <section className="py-6 mb-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="relative rounded-2xl overflow-hidden border border-[#dce8d3] bg-cover bg-center"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=80')`,
              }}
            >
              {/* Left-to-right Soft Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#f5f8f0] via-[#f5f8f0]/90 to-transparent z-0" />

              <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center px-6 sm:px-10 py-8">
                {/* Left Handwritten Script Heading */}
                <div className="md:col-span-4 flex flex-col items-start md:items-center">
                  <div className="font-blackbones text-2xl sm:text-3xl text-[#1E502B] transform -rotate-3 leading-tight">
                    We’re Closer
                    <br />
                    Than You Think!
                  </div>
                  <svg
                    className="w-36 h-4 text-[#276B3C] mt-1 transform -rotate-2"
                    viewBox="0 0 150 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 13C45 5 100 3 146 4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Middle Copy with Left Border */}
                <div className="md:col-span-4 md:border-l md:border-gray-300 md:pl-8">
                  <p className="text-sm sm:text-base font-medium text-[#1E502B] leading-relaxed mb-2">
                    From our farms to your home —
                    <br />
                    we’re always within reach.
                  </p>
                  <Sprout className="w-6 h-6 text-[#4C8C2B]" />
                </div>

                {/* Right Map Pin Graphic */}
                <div className="md:col-span-4 flex justify-center md:justify-end items-center">
                  <div className="relative bg-white/85 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-md border border-green-100 flex items-center gap-3 transform -rotate-2">
                    <div className="w-10 h-10 rounded-full bg-[#1E502B] text-white flex items-center justify-center shadow-sm">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1E502B]">Farm-to-Home Network</p>
                      <p className="text-[11px] text-[#276B3C]">Fast & fresh across Dubai</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ContactUs;
