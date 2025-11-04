import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const GEOFENCE_TASK = 'WORK_GEOFENCE_TASK';
const LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

// Storage keys
const KEYS = {
  ENTERED_TIME: 'geofence_entered_time',
  IS_AT_WORK: 'is_at_work',
  CURRENT_SHIFT: 'current_shift',
  PENDING_SHIFTS: 'pending_shifts',
};

// Define the geofence task (guarded so it doesn't re-register on fast refresh)
if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data: { eventType }, error }) => {
    if (error) {
      console.error('Geofence task error:', error);
      return;
    }

    const now = new Date().toISOString();

    if (eventType === Location.GeofencingEventType.Enter) {
      console.log('Entered work geofence at:', now);
      await AsyncStorage.setItem(KEYS.ENTERED_TIME, now);
      await AsyncStorage.setItem(KEYS.IS_AT_WORK, 'true');

      // Schedule a quick check (shortened to 3s for testing) to confirm they're still there
      setTimeout(async () => {
        await checkStillAtWork();
      }, 3 * 1000);
    } else if (eventType === Location.GeofencingEventType.Exit) {
      console.log('Exited work geofence at:', now);
      await handleWorkExit(now);
    }
  });
}

// Define background location task for battery optimization
if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('Background location error:', error);
      return;
    }

    if (data) {
      const { locations } = data;
      const location = locations[0];

      // Check if at work location
      const settings = await AsyncStorage.getItem('user_settings');
      if (settings) {
        const { workLocationLat, workLocationLng, geofenceRadius } = JSON.parse(settings);
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          workLocationLat,
          workLocationLng
        );

        if (distance <= geofenceRadius) {
          await handleAtWorkLocation();
        }
      }
    }
  });
}

// Check if user is still at work after 15 minutes
async function checkStillAtWork() {
  const isAtWork = await AsyncStorage.getItem(KEYS.IS_AT_WORK);
  const enteredTime = await AsyncStorage.getItem(KEYS.ENTERED_TIME);
  
  if (isAtWork === 'true' && enteredTime) {
    // User has been at work for 15+ minutes, start tracking
    const currentShift = {
      startTime: enteredTime,
      confirmed: false,
    };
    await AsyncStorage.setItem(KEYS.CURRENT_SHIFT, JSON.stringify(currentShift));
    console.log('Started tracking work shift');
  }
}

// Handle when user exits work
async function handleWorkExit(exitTime) {
  const currentShiftStr = await AsyncStorage.getItem(KEYS.CURRENT_SHIFT);
  
  if (currentShiftStr) {
    const currentShift = JSON.parse(currentShiftStr);
    const startTime = new Date(currentShift.startTime);
    const endTime = new Date(exitTime);
    
    const durationMs = endTime - startTime;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    // Only log if they worked for more than 15 minutes
    if (durationMinutes >= 15) {
      const shiftData = {
        startTime: currentShift.startTime,
        endTime: exitTime,
        durationMinutes,
        date: format(startTime, 'yyyy-MM-dd'),
      };
      
      // Add to pending shifts
      const pendingStr = await AsyncStorage.getItem(KEYS.PENDING_SHIFTS);
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      pending.push(shiftData);
      await AsyncStorage.setItem(KEYS.PENDING_SHIFTS, JSON.stringify(pending));
      
      // Send notification to confirm
      await sendShiftConfirmationNotification(shiftData);
    }
    
    // Clear current shift
    await AsyncStorage.removeItem(KEYS.CURRENT_SHIFT);
  }
  
  await AsyncStorage.setItem(KEYS.IS_AT_WORK, 'false');
  await AsyncStorage.removeItem(KEYS.ENTERED_TIME);
}

// Handle at work location
async function handleAtWorkLocation() {
  const isAtWork = await AsyncStorage.getItem(KEYS.IS_AT_WORK);
  if (isAtWork !== 'true') {
    const now = new Date().toISOString();
    await AsyncStorage.setItem(KEYS.ENTERED_TIME, now);
    await AsyncStorage.setItem(KEYS.IS_AT_WORK, 'true');
    
    setTimeout(async () => {
      await checkStillAtWork();
    }, 3 * 1000);
  }
}

// Send shift confirmation notification
async function sendShiftConfirmationNotification(shiftData) {
  const startTime = new Date(shiftData.startTime);
  const endTime = new Date(shiftData.endTime);
  const hours = Math.floor(shiftData.durationMinutes / 60);
  const minutes = shiftData.durationMinutes % 60;
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Work Shift Detected',
      body: `Did you work from ${format(startTime, 'h:mm a')} to ${format(endTime, 'h:mm a')} (${hours}h ${minutes}m)?`,
      data: { shiftData, type: 'shift_confirmation' },
      categoryIdentifier: 'SHIFT_CONFIRMATION',
    },
    trigger: null,
  });
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export const GeofencingService = {
  // Start geofencing
  async startGeofencing(latitude, longitude, radius = 150) {
    try {
      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        throw new Error('Foreground location permission not granted');
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        throw new Error('Background location permission not granted');
      }

      // Start geofencing
      await Location.startGeofencingAsync(GEOFENCE_TASK, [
        {
          identifier: 'work-location',
          latitude,
          longitude,
          radius,
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ]);

      // Start background location updates (less frequent for battery optimization)
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5 * 60 * 1000, // 5 minutes
        distanceInterval: 100, // 100 meters
        foregroundService: {
          notificationTitle: 'Work Time Tracker',
          notificationBody: 'Tracking your work location',
        },
      });

      console.log('Geofencing started successfully');
      return true;
    } catch (error) {
      console.error('Error starting geofencing:', error);
      throw error;
    }
  },

  // Stop geofencing
  async stopGeofencing() {
    try {
      const isGeofencing = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
      if (isGeofencing) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
      }

      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
      if (isTracking) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }

      // Clear storage
      await AsyncStorage.removeItem(KEYS.IS_AT_WORK);
      await AsyncStorage.removeItem(KEYS.ENTERED_TIME);
      await AsyncStorage.removeItem(KEYS.CURRENT_SHIFT);

      console.log('Geofencing stopped successfully');
      return true;
    } catch (error) {
      console.error('Error stopping geofencing:', error);
      throw error;
    }
  },

  // Check if geofencing is active
  async isGeofencingActive() {
    try {
      return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    } catch (error) {
      console.error('Error checking geofencing status:', error);
      return false;
    }
  },

  // Get current location
  async getCurrentLocation() {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return location;
  },

  // Get pending shifts
  async getPendingShifts() {
    const pendingStr = await AsyncStorage.getItem(KEYS.PENDING_SHIFTS);
    return pendingStr ? JSON.parse(pendingStr) : [];
  },

  // Clear pending shifts
  async clearPendingShifts() {
    await AsyncStorage.removeItem(KEYS.PENDING_SHIFTS);
  },

  // Remove specific pending shift
  async removePendingShift(index) {
    const pending = await this.getPendingShifts();
    pending.splice(index, 1);
    await AsyncStorage.setItem(KEYS.PENDING_SHIFTS, JSON.stringify(pending));
  },

  // Get current shift status
  async getCurrentShiftStatus() {
    const isAtWork = await AsyncStorage.getItem(KEYS.IS_AT_WORK);
    const currentShiftStr = await AsyncStorage.getItem(KEYS.CURRENT_SHIFT);
    const currentShift = currentShiftStr ? JSON.parse(currentShiftStr) : null;
    const enteredTime = await AsyncStorage.getItem(KEYS.ENTERED_TIME);

    return {
      isAtWork: isAtWork === 'true',
      currentShift,
      enteredTime,
    };
  },
};
