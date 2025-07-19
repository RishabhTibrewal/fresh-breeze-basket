import { useState, useEffect } from 'react';
import { PaymentForm } from './PaymentForm';
import { StripeProvider } from './StripeProvider';
import { API_BASE_URL } from '../config';

export const TestPayment = () => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/payments/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: 10.00 }),
        });

        if (!response.ok) {
          throw new Error('Failed to create payment intent');
        }

        const { clientSecret: secret } = await response.json();
        setClientSecret(secret);
      } catch (error) {
        console.error('Error creating payment intent:', error);
        setError('Failed to initialize payment');
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  }, []);

  const handlePaymentSuccess = () => {
    console.log('Payment successful!');
    alert('Payment successful!');
  };

  const handlePaymentFailure = () => {
    console.log('Payment failed!');
    alert('Payment failed! Please try again.');
    // Reset the component state to try again
    setClientSecret(null);
    setIsLoading(true);
    setError(null);
    
    // Retry creating payment intent
    const createPaymentIntent = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/payments/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: 10.00 }),
        });

        if (!response.ok) {
          throw new Error('Failed to create payment intent');
        }

        const { clientSecret: secret } = await response.json();
        setClientSecret(secret);
      } catch (error) {
        console.error('Error creating payment intent:', error);
        setError('Failed to initialize payment');
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md">
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing payment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md">
          <div className="p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Test Payment
          </h2>
          {clientSecret && (
            <StripeProvider clientSecret={clientSecret}>
              <PaymentForm 
                amount={10.00} 
                clientSecret={clientSecret}
                onSuccess={handlePaymentSuccess} 
                onFailure={handlePaymentFailure}
              />
            </StripeProvider>
          )}
        </div>
      </div>
    </div>
  );
}; 