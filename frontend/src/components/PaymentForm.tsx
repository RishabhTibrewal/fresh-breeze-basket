import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface PaymentFormProps {
  amount: number;
  clientSecret: string;
  onSuccess: () => void;
  onFailure: () => void;
}

export const PaymentForm = ({ amount, clientSecret, onSuccess, onFailure }: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!stripe || !elements) {
    return (
      <div className="w-full max-w-md mx-auto p-4 text-center">
        <p className="text-red-600">Stripe is not available. Please check your configuration.</p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="w-full max-w-md mx-auto p-4 text-center">
        <p className="text-red-600">Payment initialization failed. Please try again.</p>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Confirm the payment
      const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/thank-you`,
        },
        redirect: 'if_required',
      });

      if (paymentError) {
        if (paymentError.type === 'card_error' || paymentError.type === 'validation_error') {
          setError(paymentError.message || 'Payment failed');
          toast.error(paymentError.message || 'Payment failed');
        } else {
          setError('An unexpected error occurred');
          toast.error('An unexpected error occurred');
        }
        // Call onFailure to handle the failure
        onFailure();
        return;
      }

      if (paymentIntent) {
        console.log('Payment Intent Status:', paymentIntent.status);
        
        switch (paymentIntent.status) {
          case 'succeeded':
            toast.success('Payment successful!');
            onSuccess();
            // Navigate to thank you page
            navigate('/thank-you');
            break;
            
          case 'requires_action':
            // Handle 3D Secure authentication
            const { error: confirmError } = await stripe.confirmPayment({
              elements,
              confirmParams: {
                return_url: `${window.location.origin}/thank-you`,
              },
            });
            
            if (confirmError) {
              setError(confirmError.message || 'Payment authentication failed');
              toast.error(confirmError.message || 'Payment authentication failed');
              onFailure();
            } else {
              // If no error, the payment should be successful after authentication
              toast.success('Payment successful!');
              onSuccess();
              navigate('/thank-you');
            }
            break;
            
          case 'requires_payment_method':
            setError('Payment method failed. Please try a different card.');
            toast.error('Payment method failed. Please try a different card.');
            onFailure();
            break;
            
          case 'canceled':
            setError('Payment was canceled.');
            toast.error('Payment was canceled.');
            onFailure();
            break;
            
          case 'processing':
            toast.info('Payment is being processed. Please wait...');
            // Wait a moment and check again
            setTimeout(async () => {
              try {
                const { paymentIntent: updatedIntent } = await stripe.confirmPayment({
                  elements,
                  confirmParams: {
                    return_url: `${window.location.origin}/thank-you`,
                  },
                  redirect: 'if_required',
                });
                
                if (updatedIntent?.status === 'succeeded') {
                  toast.success('Payment successful!');
                  onSuccess();
                  navigate('/thank-you');
                } else {
                  setError('Payment is still processing. Please check your order status.');
                  onFailure();
                }
              } catch (error) {
                setError('Error checking payment status.');
                onFailure();
              }
            }, 2000);
            break;
            
          default:
            setError(`Payment status: ${paymentIntent.status}`);
            toast.error(`Payment status: ${paymentIntent.status}`);
            onFailure();
            break;
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError('An error occurred during payment');
      toast.error('An error occurred during payment');
      onFailure();
    } finally {
      setIsProcessing(false);
    }
  };

  const options = {
    layout: {
      type: 'tabs' as const,
      defaultCollapsed: false,
      spacedAccordionItems: false,
    },
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="mb-6">
        <PaymentElement 
          options={options}
        />
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing...
          </>
        ) : (
          `Pay AED ${amount.toFixed(2)}`
        )}
      </Button>
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>Your payment is secured by Stripe</p>
        <p>We never store your payment information</p>
      </div>
    </form>
  );
}; 