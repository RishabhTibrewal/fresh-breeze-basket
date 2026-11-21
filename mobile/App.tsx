import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StripeProviderWrapper } from './src/components/StripeProviderWrapper';
import { RootNavigator } from './src/navigation/RootNavigator';
import { registerForPushNotificationsAsync } from './src/utils/notifications';

const queryClient = new QueryClient();

export default function App() {
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_sample_key';

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  return (
    <SafeAreaProvider
      style={
        Platform.OS === 'web'
          ? { flex: 1, height: '100vh' as any, maxHeight: '100vh' as any, overflow: 'hidden' }
          : { flex: 1 }
      }
    >
      <QueryClientProvider client={queryClient}>
        <StripeProviderWrapper
          publishableKey={stripePublishableKey}
          merchantIdentifier="merchant.com.freshbreeze.basket"
        >
          <StatusBar style="dark" />
          <RootNavigator />
        </StripeProviderWrapper>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
