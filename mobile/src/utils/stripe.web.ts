export function useStripe() {
  return {
    initPaymentSheet: async (_options?: any) => ({ error: null }),
    presentPaymentSheet: async () => ({ error: null }),
    confirmPayment: async () => ({ error: null }),
  };
}

