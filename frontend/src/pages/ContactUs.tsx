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
  const [showLiveMap, setShowLiveMap] = useState(false);

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
              className="relative rounded-3xl overflow-hidden bg-cover bg-center border border-green-100 shadow-sm min-h-[300px] sm:min-h-[340px]"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80')`,
              }}
            >
              {/* Soft Gradient Overlay for Readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#eaf4e5]/95 via-[#eaf4e5]/85 to-transparent z-0" />

              {/* Decorative Dangling Corner Leaves */}
              <div className="hidden sm:block absolute top-0 left-4 pointer-events-none opacity-90 z-10">
                <svg
                  className="w-24 h-28 text-[#4C8C2B]"
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

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center px-6 sm:px-10 lg:px-14 py-8 lg:py-12">
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

        {/* 2. Contact Details, Support Highlights & Message Form Container */}
        <section className="py-6 lg:py-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-[#f4f8f1] rounded-3xl p-6 sm:p-8 lg:p-10 border border-[#deebd8] shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
                {/* Left Column: Phone, Email, Location */}
                <div className="lg:col-span-3 space-y-7">
                  {/* Phone */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#e1eed8] border border-[#d2e4c6] flex items-center justify-center shrink-0 text-[#1E502B]">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1E502B] mb-0.5">Phone</h3>
                      <p className="text-sm font-semibold text-[#1E502B]">+971 4 123 4567</p>
                      <p className="text-xs text-[#276B3C]/80 mt-0.5">Mon-Fri: 9am-6pm</p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#e1eed8] border border-[#d2e4c6] flex items-center justify-center shrink-0 text-[#1E502B]">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1E502B] mb-0.5">Email</h3>
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
                    <div className="w-12 h-12 rounded-full bg-[#e1eed8] border border-[#d2e4c6] flex items-center justify-center shrink-0 text-[#1E502B]">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1E502B] mb-0.5">Our Location</h3>
                      <p className="text-xs sm:text-sm font-medium text-[#1E502B]">
                        Sheikh Zayed Road
                      </p>
                      <p className="text-xs sm:text-sm text-[#276B3C]/90">Dubai, UAE</p>
                    </div>
                  </div>
                </div>

                {/* Middle Column: 4 Support Highlights (with left border on desktop) */}
                <div className="lg:col-span-4 lg:border-l lg:border-[#d5e4cf] lg:pl-8 space-y-6">
                  {supportFeatures.map((feat) => (
                    <div key={feat.title} className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-full bg-[#e1eed8] border border-[#d2e4c6] flex items-center justify-center shrink-0 text-[#1E502B]">
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
                  <div className="bg-[#e8f2e2] rounded-2xl p-6 sm:p-7 border border-[#d2e4cb] shadow-sm">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#1E502B] mb-1">
                      Send Us a Message
                    </h2>
                    <p className="text-xs sm:text-sm text-[#276B3C] mb-4">
                      Fill in the form below and we’ll get back to you soon.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Your Name"
                          className="w-full px-4 py-2.5 bg-white text-sm text-gray-800 placeholder:text-gray-400 rounded-xl border border-[#cfe1c7] focus:outline-none focus:ring-2 focus:ring-[#276B3C]"
                        />
                      </div>
                      <div>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="Your Email"
                          className="w-full px-4 py-2.5 bg-white text-sm text-gray-800 placeholder:text-gray-400 rounded-xl border border-[#cfe1c7] focus:outline-none focus:ring-2 focus:ring-[#276B3C]"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          required
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          placeholder="Subject"
                          className="w-full px-4 py-2.5 bg-white text-sm text-gray-800 placeholder:text-gray-400 rounded-xl border border-[#cfe1c7] focus:outline-none focus:ring-2 focus:ring-[#276B3C]"
                        />
                      </div>
                      <div>
                        <textarea
                          rows={3}
                          required
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          placeholder="Your Message"
                          className="w-full px-4 py-2.5 bg-white text-sm text-gray-800 placeholder:text-gray-400 rounded-xl border border-[#cfe1c7] focus:outline-none focus:ring-2 focus:ring-[#276B3C] resize-y"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-[#1E502B] hover:bg-[#276B3C] text-white font-semibold text-sm py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>Send Message</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Map Section */}
        <section className="py-6">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden shadow-sm border border-[#deebd8] bg-[#f9fbf8]">
              {/* Mode Toggle Button */}
              <div className="absolute top-4 right-4 z-20">
                <button
                  type="button"
                  onClick={() => setShowLiveMap(!showLiveMap)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/95 text-[#1E502B] shadow-sm border border-green-200 hover:bg-[#eef6e9] transition-all"
                >
                  {showLiveMap ? 'View Illustrated Map' : 'View Live Google Map'}
                </button>
              </div>

              {showLiveMap ? (
                <div className="h-[280px] sm:h-[360px] w-full">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3609.9568340138995!2d55.274098!3d25.197001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e5f4275f638be35%3A0x7c4413fc285c7e90!2sSheikh%20Zayed%20Rd%20-%20Dubai!5e0!3m2!1sen!2sae!4v1713164550305!5m2!1sen!2sae"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="FreshBasket Dubai Location"
                  />
                </div>
              ) : (
                <div className="relative h-[280px] sm:h-[360px] w-full overflow-hidden bg-[#eef1ec] flex items-center justify-center">
                  {/* Perspective Illustrated Map SVG */}
                  <svg
                    viewBox="0 0 1200 400"
                    className="w-full h-full object-cover"
                    preserveAspectRatio="xMidYMid slice"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient id="lakeGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#8cb9d3" />
                        <stop offset="100%" stopColor="#a3c8dc" />
                      </linearGradient>
                      <linearGradient id="parkGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a7c988" />
                        <stop offset="100%" stopColor="#b6d599" />
                      </linearGradient>
                    </defs>

                    {/* Base Map Background */}
                    <rect width="1200" height="400" fill="#edece8" />

                    {/* Street Grid Lines (Perspective Angled) */}
                    {/* Horizontal-ish perspective streets */}
                    <path
                      d="M-50 70 L1250 140"
                      stroke="#ffffff"
                      strokeWidth="28"
                      strokeLinecap="round"
                    />
                    <path
                      d="M-50 170 L1250 240"
                      stroke="#ffffff"
                      strokeWidth="32"
                      strokeLinecap="round"
                    />
                    <path
                      d="M-50 280 L1250 350"
                      stroke="#ffffff"
                      strokeWidth="38"
                      strokeLinecap="round"
                    />

                    {/* Vertical-ish cross perspective streets */}
                    <path
                      d="M100 -50 L-30 450"
                      stroke="#ffffff"
                      strokeWidth="26"
                      strokeLinecap="round"
                    />
                    <path
                      d="M260 -50 L110 450"
                      stroke="#ffffff"
                      strokeWidth="28"
                      strokeLinecap="round"
                    />
                    <path
                      d="M440 -50 L270 450"
                      stroke="#ffffff"
                      strokeWidth="30"
                      strokeLinecap="round"
                    />
                    <path
                      d="M620 -50 L430 450"
                      stroke="#ffffff"
                      strokeWidth="32"
                      strokeLinecap="round"
                    />
                    <path
                      d="M800 -50 L600 450"
                      stroke="#ffffff"
                      strokeWidth="32"
                      strokeLinecap="round"
                    />
                    <path
                      d="M980 -50 L770 450"
                      stroke="#ffffff"
                      strokeWidth="32"
                      strokeLinecap="round"
                    />
                    <path
                      d="M1160 -50 L940 450"
                      stroke="#ffffff"
                      strokeWidth="34"
                      strokeLinecap="round"
                    />

                    {/* Urban Blocks (Soft warm gray blocks) */}
                    <polygon points="120,80 230,86 195,155 85,148" fill="#dfded9" />
                    <polygon points="280,88 410,95 365,165 240,157" fill="#dfded9" />
                    <polygon points="460,98 580,105 530,175 410,167" fill="#dfded9" />
                    <polygon points="640,107 760,114 700,186 580,178" fill="#dfded9" />
                    <polygon points="820,117 940,124 875,196 750,188" fill="#dfded9" />

                    <polygon points="65,185 170,192 125,268 20,260" fill="#dfded9" />
                    <polygon points="220,195 340,203 285,282 170,272" fill="#dfded9" />
                    <polygon points="390,205 510,214 445,296 330,285" fill="#dfded9" />

                    {/* Green Park & Pond Area */}
                    <path
                      d="M570,220 C640,215 720,225 780,240 C840,255 890,290 860,350 C830,410 700,410 610,380 C540,360 520,310 525,270 C530,240 545,225 570,220 Z"
                      fill="url(#parkGrad)"
                    />
                    {/* Blue Lake inside park */}
                    <path
                      d="M650,270 C690,265 730,275 750,295 C770,315 760,345 735,360 C700,380 660,375 640,350 C620,325 625,295 640,280 C645,275 647,272 650,270 Z"
                      fill="url(#lakeGrad)"
                    />

                    {/* Street Labels (Italicized angled street names) */}
                    <text
                      x="180"
                      y="160"
                      transform="rotate(6, 180, 160)"
                      fill="#7a7975"
                      fontSize="13"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      Grand Street
                    </text>
                    <text
                      x="450"
                      y="180"
                      transform="rotate(6, 450, 180)"
                      fill="#7a7975"
                      fontSize="13"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      Hudson Street
                    </text>
                    <text
                      x="780"
                      y="200"
                      transform="rotate(6, 780, 200)"
                      fill="#7a7975"
                      fontSize="13"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      Channel Street
                    </text>
                    <text
                      x="100"
                      y="275"
                      transform="rotate(6, 100, 275)"
                      fill="#7a7975"
                      fontSize="13"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      South Street
                    </text>
                    <text
                      x="320"
                      y="295"
                      transform="rotate(6, 320, 295)"
                      fill="#7a7975"
                      fontSize="13"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      Bank Street
                    </text>

                    {/* Pin Marker on Sheikh Zayed Road */}
                    <g transform="translate(620, 160)">
                      <circle cx="0" cy="0" r="18" fill="#1E502B" opacity="0.2" />
                      <circle cx="0" cy="0" r="12" fill="#1E502B" opacity="0.35" />
                      <path
                        d="M0 -22 C-8 -22 -14 -16 -14 -8 C-14 3 0 16 0 16 C0 16 14 3 14 -8 C14 -16 8 -22 0 -22 Z"
                        fill="#1E502B"
                      />
                      <circle cx="0" cy="-9" r="5" fill="#ffffff" />
                    </g>
                  </svg>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 4. Bottom Banner: "We're Closer Than You Think!" */}
        <section className="py-6 mb-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="relative rounded-3xl overflow-hidden border border-[#dce8d3] bg-cover bg-center"
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

                {/* Right Map Pin Graphic with Dotted Path */}
                <div className="md:col-span-4 flex justify-center md:justify-end items-center">
                  <div className="relative flex items-center">
                    {/* Dotted path leading to pin */}
                    <svg
                      className="w-32 h-12 text-[#276B3C] mr-2 hidden sm:block"
                      viewBox="0 0 120 40"
                      fill="none"
                    >
                      <path
                        d="M5 30 Q 60 5, 115 20"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                      />
                    </svg>

                    <div className="relative bg-white/90 backdrop-blur-sm px-5 py-3.5 rounded-2xl shadow-md border border-green-100 flex items-center gap-3 transform -rotate-2">
                      <div className="w-10 h-10 rounded-full bg-[#1E502B] text-white flex items-center justify-center shadow-sm">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1E502B]">Farm-to-Home Network</p>
                        <p className="text-[11px] text-[#276B3C]">Always fresh across Dubai</p>
                      </div>
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
