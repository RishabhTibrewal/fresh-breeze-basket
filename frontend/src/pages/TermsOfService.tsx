import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const TermsOfService = () => {
  const lastUpdated = 'November 21, 2026';

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-10 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-center font-playfair text-primary">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500 mb-8 text-center">
            Last Updated: {lastUpdated} &middot; App: <strong>gofreshco</strong> (Package:{' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">com.gofreshco.app</code>)
          </p>

          <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 text-sm mb-8">
            Welcome to <strong>GoFreshCo</strong>. By accessing or using the <strong>gofreshco</strong> mobile
            application or our website at{' '}
            <a
              href="https://www.gofreshco.com"
              className="underline font-medium"
              target="_blank"
              rel="noreferrer"
            >
              www.gofreshco.com
            </a>
            , you agree to be bound by these Terms of Service.
          </div>

          <div className="space-y-8 mb-12 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                1. Eligibility &amp; Account Registration
              </h2>
              <p>
                To place orders on GoFreshCo, you must be at least 18 years old (or the age of majority in your
                jurisdiction) and provide accurate, complete registration details. You are responsible for maintaining
                the confidentiality of your account credentials and for all activity under your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                2. Products, Pricing &amp; Availability
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  All products, pack sizes, descriptions, and prices are subject to availability and may change without
                  prior notice.
                </li>
                <li>
                  Product images are for illustrative purposes; slight natural variations may occur in fresh produce and
                  packaged goods.
                </li>
                <li>
                  We reserve the right to limit order quantities or cancel orders if an item is out of stock or priced
                  incorrectly due to a technical error, in which case any amount paid will be refunded.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                3. Orders &amp; Payments
              </h2>
              <p>
                When you place an order, you authorize us (and our payment processor, <strong>Stripe</strong>) to charge
                your selected payment method for the total order amount, including applicable taxes and delivery fees.
                Orders are confirmed once payment is authorized or Cash on Delivery (where available) is accepted.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                4. Delivery &amp; Shipping
              </h2>
              <p>
                We deliver to serviceable areas based on the delivery address you provide. Estimated delivery times and
                slots are provided for convenience and may vary due to weather, traffic, or operational factors. Please
                ensure someone is available at the delivery address to receive perishable goods.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                5. Cancellations, Returns &amp; Refunds
              </h2>
              <p>
                Orders may be cancelled before dispatch. For damaged, missing, or unsatisfactory items, please notify us
                within 24 hours of delivery in accordance with our{' '}
                <Link to="/returns" className="text-primary underline font-medium">
                  Returns &amp; Refunds Policy
                </Link>
                . Approved refunds are processed back to your original payment method.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                6. Acceptable Use
              </h2>
              <p className="mb-2">You agree not to:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Use the app or website for any unlawful, fraudulent, or abusive purpose.</li>
                <li>Attempt to gain unauthorized access to our servers, APIs, or other users&apos; accounts.</li>
                <li>Interfere with the normal operation, security, or performance of the service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                7. Intellectual Property
              </h2>
              <p>
                All content, branding, logos, graphics, and software within the <strong>gofreshco</strong> app and
                website are the property of GoFreshCo or its licensors and are protected by applicable intellectual
                property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                8. Privacy
              </h2>
              <p>
                Your use of our services is also governed by our{' '}
                <Link to="/privacy-policy" className="text-primary underline font-medium">
                  Privacy Policy
                </Link>
                , which explains how we collect, use, and protect your personal data.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                9. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by law, GoFreshCo is provided on an &ldquo;as is&rdquo; and &ldquo;as
                available&rdquo; basis. GoFreshCo shall not be liable for any indirect, incidental, or consequential
                damages arising from your use of the app or website. Our total liability for any claim related to an
                order shall not exceed the amount you paid for that order.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                10. Changes to Terms &amp; Contact
              </h2>
              <p>
                We may update these Terms of Service from time to time. Continued use of the app or website after
                updates constitutes acceptance of the revised terms. If you have questions, contact us:
              </p>
              <ul className="list-none space-y-1 mt-3 text-sm bg-gray-50 border border-gray-200 rounded-md p-4">
                <li>
                  <strong>App Name:</strong> gofreshco (<code className="text-xs">com.gofreshco.app</code>)
                </li>
                <li>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:support@gofreshco.com" className="text-primary underline">
                    support@gofreshco.com
                  </a>
                </li>
                <li>
                  <strong>Website:</strong>{' '}
                  <a
                    href="https://www.gofreshco.com/contact"
                    className="text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://www.gofreshco.com/contact
                  </a>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default TermsOfService;

