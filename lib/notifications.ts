import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  type: 'message' | 'call' | 'status';
  chatId?: string;
  senderId?: string;
  senderName?: string;
  messageContent?: string;
}

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false; // Web doesn't support push notifications in this setup
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  static async registerForPushNotifications(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return null;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Push notification permissions not granted');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id', // Replace with your actual project ID
      });

      console.log('Push token:', token.data);

      // Save token to user profile
      const userId = await AsyncStorage.getItem('userID');
      if (userId) {
        await supabase
          .from('users')
          .update({ push_token: token.data })
          .eq('id', userId);
      }

      return token.data;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  static async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<void> {
    if (Platform.OS === 'web') {
      return; // Skip on web
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
      badge: 1,
    };

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  static async scheduleLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
    delay: number = 0
  ): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: delay > 0 ? { seconds: delay } : null,
    });
  }

  static setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ) {
    if (Platform.OS === 'web') {
      return { remove: () => {} };
    }

    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        onNotificationReceived?.(notification);
      }
    );

    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        onNotificationResponse?.(response);
      }
    );

    return {
      remove: () => {
        notificationListener.remove();
        responseListener.remove();
      },
    };
  }

  static async clearAllNotifications(): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.dismissAllNotificationsAsync();
  }

  static async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.setBadgeCountAsync(count);
  }
}