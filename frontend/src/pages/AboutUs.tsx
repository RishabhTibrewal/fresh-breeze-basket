import {
  Leaf,
  Sprout,
  ShieldCheck,
  Heart,
  ChevronRight,
  Globe,
  Users,
  UserCheck,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const AboutUs = () => {
  const drivingValues = [
    {
      icon: <Leaf className="w-6 h-6" />,
      title: 'Natural & Pure',
      desc: 'No harmful chemicals,\nno preservatives.',
    },
    {
      icon: <UserCheck className="w-6 h-6" />,
      title: 'Farmer First',
      desc: 'Supporting farmers\nand local communities.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: 'Quality Always',
      desc: 'Strict quality checks\nat every stage.',
    },
    {
      icon: <Sprout className="w-6 h-6" />,
      title: 'Sustainable Farming',
      desc: 'For a greener,\nhealthier planet.',
    },
    {
      icon: <Heart className="w-6 h-6" />,
      title: 'Your Health Matters',
      desc: 'Nutritious food\nfor a better life.',
    },
  ];

  const journeySteps = [
    {
      title: 'Farm Sourcing',
      img: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=400&q=80',
    },
    {
      title: 'Quality Selection',
      img: 'https://images.unsplash.com/photo-1574316071802-0d684efa7bf5?auto=format&fit=crop&w=400&q=80',
    },
    {
      title: 'Hygienic Processing',
      img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80',
    },
    {
      title: 'Safe Packaging',
      img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    },
    {
      title: 'Your Home',
      img: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=400&q=80',
    },
  ];

  const coreValues = [
    {
      icon: <Sprout className="w-9 h-9" strokeWidth={1.75} />,
      title: 'Freshness\nFirst',
      desc: 'We harvest to order, ensuring that produce reaches you at peak freshness, often within 24 hours of being picked.',
    },
    {
      icon: <Globe className="w-9 h-9" strokeWidth={1.75} />,
      title: 'Sustainability',
      desc: 'We use eco-friendly packaging and support farms that employ sustainable agricultural practices.',
    },
    {
      icon: <Users className="w-9 h-9" strokeWidth={1.75} />,
      title: 'Community\nSupport',
      desc: 'By supporting local farmers, we help strengthen the local economy and reduce the environmental impact of long-distance food transportation.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-grow">
        {/* 1. Hero / Story Section */}
        <section className="relative overflow-hidden pt-6 pb-10 lg:py-12">
          {/* Decorative Left Floating Leaves */}
          <div className="hidden lg:block absolute top-4 left-2 pointer-events-none opacity-80">
            <Leaf className="w-10 h-10 text-[#4C8C2B] fill-[#68A83E]/80 transform -rotate-45 mb-3" />
            <Leaf className="w-12 h-12 text-[#3B7A23] fill-[#4C8C2B]/85 transform rotate-12 ml-2 mb-6" />
            <Leaf className="w-9 h-9 text-[#68A83E] fill-[#8BC34A]/70 transform -rotate-12" />
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left Text Column */}
              <div className="lg:col-span-6 lg:pl-6">
                <div className="inline-flex items-center gap-2 text-[#1E502B] font-bold text-base sm:text-lg mb-3">
                  <Sprout className="w-6 h-6 text-[#276B3C]" />
                  <span>About Us</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-[#1E502B] leading-[1.15] mb-5 tracking-tight">
                  Bringing Nature’s
                  <br />
                  Goodness to Your Home
                </h1>

                <div className="space-y-3 text-gray-600 text-sm sm:text-[15px] leading-relaxed">
                  <p>
                    Founded in 2020, FreshBasket began with a simple idea: to make fresh, organic
                    produce accessible to everyone. What started as a small farmers’ market stand has
                    grown into an online marketplace connecting consumers directly with local farmers
                    and producers.
                  </p>
                  <p>
                    We believe in transparency, sustainability, and supporting local communities. By
                    cutting out middlemen, we ensure farmers receive fair compensation for their hard
                    work, while customers enjoy the freshest produce at reasonable prices.
                  </p>
                  <p>
                    Today, we’re proud to serve thousands of customers, partnering with over 50 local
                    farms and artisanal food producers to bring the best seasonal offerings directly to
                    your doorstep.
                  </p>
                </div>

                {/* Decorative Curved Brush Underline */}
                <div className="mt-4">
                  <svg
                    className="w-36 h-4 text-[#276B3C]"
                    viewBox="0 0 160 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3 13C45 4 105 2 157 5"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Right Curved Farmer Image */}
              <div className="lg:col-span-6">
                <div className="relative h-[300px] sm:h-[380px] lg:h-[420px] w-full overflow-hidden rounded-3xl lg:rounded-l-[140px] lg:rounded-r-2xl shadow-md">
                  <img
                    src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80"
                    alt="Green farm field at sunrise"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#1E502B]/15 via-transparent to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Our Values — What Drives Us Strip */}
        <section className="py-4">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-[#eff5ea] rounded-2xl p-6 sm:p-8 lg:px-10 lg:py-9 border border-[#dce8d3]">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Left Header */}
                <div className="lg:col-span-3">
                  <div className="flex items-start gap-2.5 mb-2">
                    <Sprout className="w-7 h-7 text-[#276B3C] shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-sm font-bold text-[#1E502B]">Our Values</span>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E502B] leading-tight">
                        What Drives Us
                      </h2>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mt-2">
                    We believe in honest food, sustainable farming and a healthier tomorrow. Our
                    values guide everything we do — from sourcing to delivery.
                  </p>
                </div>

                {/* Right 5 Value Pillars */}
                <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-0">
                  {drivingValues.map((item) => (
                    <div
                      key={item.title}
                      className="flex flex-col items-center text-center px-3 lg:border-l lg:border-[#276B3C]/15"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#e2eed8] border border-[#cde0be] flex items-center justify-center mb-3 text-[#1E502B]">
                        {item.icon}
                      </div>
                      <h3 className="text-sm font-bold text-[#1E502B] mb-1">{item.title}</h3>
                      <p className="text-xs text-gray-600 whitespace-pre-line leading-snug">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Our Journey — From Farm to Your Table */}
        <section className="py-10 lg:py-14">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Description */}
              <div className="lg:col-span-3">
                <div className="inline-flex items-center gap-2 text-[#1E502B] font-bold text-sm sm:text-base mb-1">
                  <Sprout className="w-5 h-5 text-[#276B3C]" />
                  <span>Our Journey</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E502B] leading-tight mb-3">
                  From Farm
                  <br />
                  to Your Table
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  We work closely with farmers, support sustainable practices and bring you nature’s
                  best — with care, at every step.
                </p>
              </div>

              {/* Right 5 Circular Steps */}
              <div className="lg:col-span-9">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 items-center">
                  {journeySteps.map((step, index) => (
                    <div key={step.title} className="relative flex flex-col items-center text-center">
                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-md border-4 border-[#f5f8f0] mb-3">
                        <img
                          src={step.img}
                          alt={step.title}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-[#1E502B]">{step.title}</h3>

                      {/* Arrow between circles on desktop */}
                      {index < journeySteps.length - 1 && (
                        <ChevronRight className="hidden lg:block w-5 h-5 text-[#276B3C] absolute -right-3 top-12" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Our Values — 3 Feature Cards Section */}
        <section className="py-6">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-[#f1f5ee] rounded-3xl py-12 px-6 sm:px-10 lg:px-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1E502B] text-center mb-10">
                Our Values
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {coreValues.map((val) => (
                  <div
                    key={val.title}
                    className="bg-white rounded-3xl p-8 text-center shadow-sm border border-green-100/60 flex flex-col items-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-[#eff5ea] text-[#1E502B] flex items-center justify-center mb-5">
                      {val.icon}
                    </div>
                    <h3 className="font-playfair text-2xl sm:text-[28px] font-bold text-[#1E502B] leading-tight mb-4 whitespace-pre-line">
                      {val.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#276B3C]/90 leading-relaxed">
                      {val.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. Our Commitment — Bottom Banner */}
        <section className="py-8 mb-6">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="relative rounded-2xl overflow-hidden border border-[#dce8d3] bg-cover bg-center"
              style={{ backgroundImage: `url('/hero-layers/bg-table.png')` }}
            >
              {/* Soft White/Green Left Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#f4f8f1] via-[#f4f8f1]/95 to-transparent z-0" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center p-6 sm:p-8 lg:px-10 lg:py-8">
                {/* Left Commitment Copy */}
                <div className="lg:col-span-5">
                  <div className="inline-flex items-center gap-2 text-[#1E502B] font-bold text-xs sm:text-sm mb-1.5">
                    <Sprout className="w-5 h-5 text-[#276B3C]" />
                    <span>Our Commitment</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#1E502B] mb-2">
                    Healthy People. Healthy Planet.
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                    We are committed to bringing you the best of nature — while supporting farmers,
                    promoting sustainable agriculture and building a healthier future for generations
                    to come.
                  </p>
                </div>

                {/* Middle Script Quote */}
                <div className="lg:col-span-3 flex flex-col items-center justify-center text-center">
                  <div className="font-blackbones text-2xl sm:text-3xl text-[#1E502B] transform -rotate-6 leading-tight">
                    Good Food <Heart className="inline w-4 h-4 text-[#276B3C]" />
                    <br />
                    Better Tomorrow
                  </div>
                  <svg
                    className="w-32 h-4 text-[#276B3C] mt-1 transform -rotate-3"
                    viewBox="0 0 140 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 13C40 5 95 3 136 4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Right Produce Basket Image */}
                <div className="lg:col-span-4 flex justify-center lg:justify-end">
                  <img
                    src="/hero-layers/produce-basket-nobg.png"
                    alt="Fresh vegetables and wholesome grains"
                    className="w-full max-w-xs sm:max-w-sm h-auto object-contain drop-shadow-lg"
                  />
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

export default AboutUs;
