import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const PrivacyPolicy = () => {
  const lastUpdated = 'November 21, 2026';

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-10 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-center font-playfair text-primary">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500 mb-8 text-center">
            Last Updated: {lastUpdated} &middot; App: <strong>gofreshco</strong> (Package:{' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">com.gofreshco.app</code>)
          </p>

          <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 text-sm mb-8">
            This Privacy Policy describes how <strong>GoFreshCo</strong> (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or
            &ldquo;us&rdquo;) collects, uses, stores, and protects your personal information when you use the{' '}
            <strong>gofreshco</strong> mobile application (Android &amp; iOS) and our website at{' '}
            <a
              href="https://www.gofreshco.com"
              className="underline font-medium"
              target="_blank"
              rel="noreferrer"
            >
              www.gofreshco.com
            </a>
            .
          </div>

          <div className="space-y-8 mb-12 text-gray-700 leading-relaxed">
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                1. Information We Collect
              </h2>
              <p className="mb-3">
                To provide grocery ordering, payment, and delivery services, we collect the following categories of
                information:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <span className="font-medium text-gray-900">Account &amp; Contact Information:</span> Name, email
                  address, phone number, and authentication credentials when you register or sign in.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Delivery Addresses:</span> Street address, city, state,
                  and postal/PIN code you provide to deliver your orders.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Location Data (Optional):</span> Approximate and precise
                  location (<code className="text-xs bg-gray-100 px-1 rounded">ACCESS_COARSE_LOCATION</code>,{' '}
                  <code className="text-xs bg-gray-100 px-1 rounded">ACCESS_FINE_LOCATION</code>) only when you grant
                  permission, used to auto-fill your delivery address and check delivery availability in your area.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Order &amp; Purchase History:</span> Products purchased,
                  quantities, order totals, delivery slots, and order status.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Payment Information:</span> Payments are processed
                  securely through <strong>Stripe</strong> (and Google Pay / Apple Pay where enabled). We do not store
                  your full credit/debit card number or CVV on our servers.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Device &amp; Notification Data:</span> Push notification
                  tokens (Expo / Firebase Cloud Messaging) to send order confirmation and live delivery updates, plus
                  basic diagnostic/error logs to maintain app stability.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                2. How We Use Your Information
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Create and manage your account and authenticate your sessions.</li>
                <li>Process, pack, ship, and deliver your grocery orders to your chosen address.</li>
                <li>Process payments, prevent fraud, and issue refunds when applicable.</li>
                <li>Send transactional notifications regarding order confirmations, dispatch, and delivery status.</li>
                <li>Respond to customer support requests and improve app performance and reliability.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                3. Data Sharing &amp; Third-Party Services
              </h2>
              <p className="mb-3">
                We <strong>do not sell</strong> your personal information. We only share data with trusted service
                providers strictly as needed to operate the app:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <span className="font-medium text-gray-900">Stripe:</span> For secure payment processing and fraud
                  prevention.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Cloud Hosting &amp; Database Providers (Supabase):</span>{' '}
                  For secure authentication, account management, and encrypted database storage.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Push Notification Services (Expo / Google FCM):</span> To
                  deliver real-time order and delivery status notifications.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Delivery Personnel:</span> Only your name, delivery
                  address, and phone number necessary to complete delivery.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Legal Compliance:</span> When required by applicable law,
                  regulation, or valid legal process.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                4. Data Security
              </h2>
              <p>
                All data transmitted between the <strong>gofreshco</strong> app and our servers is encrypted in transit
                using HTTPS/TLS. We use token-based authentication, access controls, and PCI-DSS compliant payment
                processing via Stripe to protect your data against unauthorized access, alteration, or disclosure.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                5. Data Retention &amp; Account Deletion
              </h2>
              <p className="mb-3">
                We retain your account information for as long as your account remains active or as needed to provide
                our services. Order and invoice records may be retained as required for tax, accounting, or legal
                compliance.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm space-y-2">
                <p className="font-medium text-gray-900">How to Request Account &amp; Data Deletion:</p>
                <p>
                  You can request permanent deletion of your account and associated personal data at any time by
                  emailing{' '}
                  <a href="mailto:support@gofreshco.com" className="text-primary underline font-medium">
                    support@gofreshco.com
                  </a>{' '}
                  with the subject line <strong>&ldquo;Account Deletion Request&rdquo;</strong> from your registered
                  email address (or via our{' '}
                  <Link to="/contact" className="text-primary underline font-medium">
                    Contact Us
                  </Link>{' '}
                  page or our dedicated{' '}
                  <Link to="/delete-account" className="text-primary underline font-medium">
                    Delete Account
                  </Link>{' '}
                  page).
                </p>
                <p>
                  Upon verification, we will delete your account profile, saved addresses, wishlist, and notification
                  tokens within <strong>30 days</strong>, retaining only minimal transaction records where legally
                  required for tax or regulatory compliance.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                6. Your Privacy Rights &amp; Controls
              </h2>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <span className="font-medium text-gray-900">Access &amp; Update:</span> View and update your profile
                  and saved delivery addresses directly in the app.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Permissions:</span> Revoke location or notification
                  permissions at any time through your device&apos;s system settings.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Deletion:</span> Request deletion of your account and
                  personal data as described above.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                7. Children&apos;s Privacy
              </h2>
              <p>
                The <strong>gofreshco</strong> app is not intended for children under the age of 13 (or the minimum
                digital consent age in your jurisdiction). We do not knowingly collect personal information from
                children. If you believe a child has provided us with personal data, please contact us and we will
                promptly delete it.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                8. Changes to This Privacy Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. Any changes will be posted on this page with an
                updated &ldquo;Last Updated&rdquo; date. Continued use of the app after changes take effect
                constitutes acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                9. Contact Us
              </h2>
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data,
                please contact us:
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

export default PrivacyPolicy;

