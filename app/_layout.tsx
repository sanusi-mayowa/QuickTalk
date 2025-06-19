import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import Toast from 'react-native-toast-message';
import { NotificationService } from '@/lib/notifications';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    //Initialize Notifications
    initializeNotifications();
  }, []);

  const initializeNotifications = async () => {
    //Register for Push Notifications
    await NotificationService.registerForPushNotifications();

    //set up Notification listners
    const { remove } = NotificationService.setupNotificationListeners(
      (notification) => {
        // Handle received notification
        console.log('Notification received:', notification);
      },
      (response) => {
        // Handle notification response (user tapped notification)
        console.log('Notification response:', response);
        const data = response.notification.request.content.data;
        
        // Navigate based on notification data
        if (data?.type === 'message' && data?.chatId) {
          // Navigate to chat screen
          // router.push(`/chat/${data.chatId}`);
        }
      }
    );

    // Cleanup listeners on unmount
    return remove;
  };

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
      <Toast />
    </>
  );
}
