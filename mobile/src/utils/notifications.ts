import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

// Configure how incoming notifications are presented when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and register the Expo push token with our backend.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notification device tokens are for native mobile devices (iOS / Android).
  // On web, remote push requires Web Push VAPID keys in app.json; skip remote token registration gracefully on web.
  if (Platform.OS === 'web') {
    return null;
  }

  let token: string | null = null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FreshBasket Orders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1B5E20',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission not granted for push notifications.');
      return null;
    }

    // Get the device token
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    token = tokenResponse.data;

    if (token) {
      console.log('Expo Push Token obtained:', token);
      // Register with backend
      try {
        await apiClient.post('/notifications/register-token', {
          token,
          platform: Platform.OS,
        });
      } catch (err: any) {
        console.log('Push token registration with backend:', err?.message || err);
      }
    }
  } catch (error) {
    console.log('Error acquiring push notification token:', error);
  }

  return token;
}

/**
 * Triggers a local rich alert for order status events
 */
export async function sendLocalOrderNotification(
  title: string,
  body: string,
  orderId?: string
) {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
        return;
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { orderId },
        sound: true,
      },
      trigger: null, // deliver immediately
    });
  } catch (error) {
    console.log('Error sending local notification:', error);
  }
}

