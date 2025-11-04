import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Set notification categories
Notifications.setNotificationCategoryAsync('SHIFT_CONFIRMATION', [
  {
    identifier: 'CONFIRM_YES',
    buttonTitle: 'Yes',
    options: {
      opensAppToForeground: false,
    },
  },
  {
    identifier: 'CONFIRM_NO',
    buttonTitle: 'Edit',
    options: {
      opensAppToForeground: true,
    },
  },
]);

export const NotificationService = {
  // Request permissions
  async requestPermissions() {
    // Check if running on physical device (simplified without expo-device)
    if (Platform.OS === 'web') {
      console.log('Notifications not supported on web');
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  },

  // Send shift confirmation notification
  async sendShiftConfirmation(shiftData) {
    try {
      const { startTime, endTime, durationMinutes } = shiftData;
      const start = new Date(startTime);
      const end = new Date(endTime);
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎯 Work Shift Detected',
          body: `Did you work from ${start.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })} to ${end.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })} (${hours}h ${minutes}m)?`,
          data: { shiftData, type: 'shift_confirmation' },
          categoryIdentifier: 'SHIFT_CONFIRMATION',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending shift confirmation:', error);
    }
  },

  // Send earnings summary
  async sendEarningsSummary(earnings, hours) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💰 Weekly Earnings Update',
          body: `You've earned $${earnings.toFixed(2)} this week working ${hours.toFixed(1)} hours!`,
          data: { type: 'earnings_summary' },
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending earnings summary:', error);
    }
  },

  // Send predictive notification
  async sendPredictiveNotification(dayOfWeek, time) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Time to Work?',
          body: `You usually work on ${dayOfWeek}s at ${time}. Enable tracking?`,
          data: { type: 'predictive' },
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending predictive notification:', error);
    }
  },

  // Send payday notification
  async sendPaydayNotification(amount) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 Payday Approaching!',
          body: `Expected earnings: $${amount.toFixed(2)}`,
          data: { type: 'payday' },
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error sending payday notification:', error);
    }
  },

  // Schedule weekly summary
  async scheduleWeeklySummary() {
    try {
      // Schedule for Friday evening
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📊 Your Weekly Summary',
          body: 'Check out your work stats for this week!',
          data: { type: 'weekly_summary' },
        },
        trigger: {
          weekday: 6, // Friday
          hour: 18,
          minute: 0,
          repeats: true,
        },
      });
    } catch (error) {
      console.error('Error scheduling weekly summary:', error);
    }
  },

  // Cancel all notifications
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling notifications:', error);
    }
  },

  // Add notification listener
  addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
  },

  // Add notification response listener
  addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },
};