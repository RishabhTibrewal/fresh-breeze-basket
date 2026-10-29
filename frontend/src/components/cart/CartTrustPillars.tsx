import React from 'react';
import { Leaf, FlaskConical, Sprout, Heart } from 'lucide-react';

export const CartTrustPillars: React.FC = () => {
  const pillars = [
    {
      icon: <Leaf className="w-6 h-6 text-[#1E502B]" />,
      title: '100% Natural',
      desc: 'No artificial additives',
    },
    {
      icon: <FlaskConical className="w-6 h-6 text-[#1E502B]" />,
      title: 'Chemical Free',
      desc: 'Safe for your family',
    },
    {
      icon: <Sprout className="w-6 h-6 text-[#1E502B]" />,
      title: 'Farm Fresh',
      desc: 'Directly from farmers',
    },
    {
      icon: <Heart className="w-6 h-6 text-[#1E502B]" />,
      title: 'Healthy Choices',
      desc: 'For a better tomorrow',
    },
    {
      icon: <Leaf className="w-6 h-6 text-[#1E502B]" />,
      title: 'Sustainable',
      desc: 'Good for you & the planet',
    },
  ];

  return (
    <div className="bg-[#f4f8f1] border border-[#e2ede0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 my-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-0 items-center">
        {pillars.map((item, index) => (
          <div
            key={item.title}
            className={`flex items-center gap-3.5 px-2 sm:px-4 ${
              index > 0 ? 'lg:border-l lg:border-[#276B3C]/15' : ''
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#e2eed8] border border-[#cde0be] flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#1E502B] leading-tight">
                {item.title}
              </h4>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 leading-snug">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

