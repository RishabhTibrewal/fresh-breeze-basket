import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

export function StripeProviderWrapper({
  children,
  publishableKey,
  merchantIdentifier,
}: {
  children: React.ReactElement | React.ReactElement[];
  publishableKey: string;
  merchantIdentifier?: string;
}) {
  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier={merchantIdentifier}
    >
      {children}
    </StripeProvider>
  );
}
