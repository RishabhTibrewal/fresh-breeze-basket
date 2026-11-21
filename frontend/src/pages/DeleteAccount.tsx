import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DeleteAccount = () => {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const subject = encodeURIComponent('Account Deletion Request - gofreshco');
    const body = encodeURIComponent(
      `Hello GoFreshCo Support,\n\nPlease permanently delete my gofreshco account and associated personal data.\n\nRegistered Email: ${email.trim()}\nReason (optional): ${reason.trim() || 'N/A'}\n\nThank you.`
    );
    window.location.href = `mailto:support@gofreshco.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-10 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-center font-playfair text-primary">
            Delete Your Account &amp; Data
          </h1>
          <p className="text-sm text-gray-500 mb-8 text-center">
            App: <strong>gofreshco</strong> by <strong>GoFreshCo</strong> &middot; Package:{' '}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">com.gofreshco.app</code>
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-900 text-sm mb-8">
            This page explains how users of the <strong>gofreshco</strong> mobile app (Android &amp; iOS) and{' '}
            <strong>www.gofreshco.com</strong> can request permanent deletion of their account and associated personal
            data.
          </div>

          <div className="space-y-8 mb-12 text-gray-700 leading-relaxed">
            {/* Steps to request deletion */}
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                How to Request Account Deletion
              </h2>
              <ol className="list-decimal list-inside space-y-3 ml-2">
                <li>
                  <span className="font-medium text-gray-900">Submit a request below or by email:</span> Fill out the
                  form below, or send an email from your registered email address to{' '}
                  <a href="mailto:support@gofreshco.com" className="text-primary underline font-medium">
                    support@gofreshco.com
                  </a>{' '}
                  with the subject line <strong>&ldquo;Account Deletion Request - gofreshco&rdquo;</strong>.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Verify your identity:</span> Our support team will verify
                  that the request came from the owner of the registered email address or phone number.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Confirmation &amp; deletion:</span> Once verified, your
                  account and associated personal data will be permanently deleted within <strong>30 days</strong>, and
                  you will receive a confirmation email.
                </li>
              </ol>
            </section>

            {/* Quick request form */}
            <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-primary mb-2">Submit Account Deletion Request</h2>
              <p className="text-sm text-gray-600 mb-4">
                Enter the email address registered with your <strong>gofreshco</strong> account. Clicking submit will
                open a pre-filled deletion request email to <strong>support@gofreshco.com</strong>.
              </p>

              {submitted && (
                <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
                  <AlertDescription>
                    Your email client should open with a pre-filled deletion request. If it did not open, please email{' '}
                    <strong>support@gofreshco.com</strong> directly from <strong>{email}</strong> with subject{' '}
                    <strong>&ldquo;Account Deletion Request - gofreshco&rdquo;</strong>.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="delete-email">Registered Email Address *</Label>
                  <Input
                    id="delete-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="delete-reason">Reason for leaving (optional)</Label>
                  <Textarea
                    id="delete-reason"
                    placeholder="Optional feedback..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                  Request Permanent Account Deletion
                </Button>
              </form>
            </section>

            {/* Data deleted */}
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                Data That Will Be Permanently Deleted
              </h2>
              <p className="mb-2">
                Within <strong>30 days</strong> of verifying your request, we permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Your account profile (name, email address, phone number, login credentials).</li>
                <li>Saved delivery addresses and location preferences.</li>
                <li>Saved wishlist items and active shopping cart contents.</li>
                <li>Push notification tokens and device identifiers linked to your account.</li>
              </ul>
            </section>

            {/* Data retained & retention period */}
            <section>
              <h2 className="text-xl md:text-2xl font-semibold text-primary mb-3">
                Data That May Be Retained &amp; Retention Period
              </h2>
              <p className="mb-2">
                Certain minimal records may be retained strictly where required by law, tax regulations, accounting
                obligations, or fraud prevention:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>
                  <span className="font-medium text-gray-900">Order Invoices &amp; Transaction Records:</span> Order
                  IDs, purchase amounts, tax details, and payment transaction references (processed via Stripe) may be
                  retained for up to <strong>7 years</strong> as required by applicable tax and accounting laws, after
                  which they are permanently deleted or anonymized.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Security &amp; Fraud Logs:</span> Basic audit logs may be
                  retained for up to <strong>90 days</strong> for security and abuse prevention.
                </li>
              </ul>
            </section>

            <section className="text-sm text-gray-600 pt-2 border-t border-gray-200">
              For full details on how we handle personal data, see our{' '}
              <Link to="/privacy-policy" className="text-primary underline font-medium">
                Privacy Policy
              </Link>{' '}
              or contact{' '}
              <a href="mailto:support@gofreshco.com" className="text-primary underline font-medium">
                support@gofreshco.com
              </a>
              .
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default DeleteAccount;

