import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { Platform } from 'react-native';
import { roundEntryTime, roundExitTime, calculateRoundedDuration, formatRoundedTime } from './timeRoundingUtils';

const GEOFENCE_TASK = 'WORK_GEOFENCE_TASK';
const LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

// Storage keys
const KEYS = {
  ENTERED_TIME: 'geofence_entered_time',
  IS_AT_WORK: 'is_at_work',
  CURRENT_SHIFT: 'current_shift',
  PENDING_SHIFTS: 'pending_shifts',
  WORK_LOCATION: 'work_location_coords',
  LAST_LOCATION_CHECK: 'last_location_check',
};

// 🍎 iOS-SPECIFIC: More aggressive exit detection
const IOS_EXIT_CHECK_SAMPLES = 3; // Require 3 consecutive "outside" readings
const IOS_EXIT_BUFFER = 1.2; // 20% buffer beyond radius before confirming exit

// ✅ Register geofence task (iOS relies on this for ENTRY only)
try {
  if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
    TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
      if (error) {
        console.error('❌ [iOS] Geofence task error:', error);
        return;
      }

      if (!data || !data.eventType) {
        console.error('❌ [iOS] Invalid geofence event data');
        return;
      }

      const { eventType } = data;
      const now = new Date().toISOString();

      console.log(`📍 [iOS] Geofence Event: ${eventType} at ${now}`);

      try {
        if (eventType === Location.GeofencingEventType.Enter) {
          // iOS is GOOD at detecting entries
          console.log('🟢 [iOS] Geofence ENTER - reliable detection');
          await handleWorkEntry(now);
        } else if (eventType === Location.GeofencingEventType.Exit) {
          // iOS is UNRELIABLE at detecting exits, but we'll handle it anyway
          console.log('🔴 [iOS] Geofence EXIT - may be delayed, validating...');
          await validateAndHandleExit(now);
        }
      } catch (err) {
        console.error('❌ [iOS] Error handling geofence event:', err);
      }
    });
    console.log('✅ [iOS] Geofence task registered');
  }
} catch (error) {
  console.error('❌ [iOS] Failed to register geofence task:', error);
}

// 🍎 CRITICAL FIX: Background location task with iOS-optimized exit detection
try {
  if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
    TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
      if (error) {
        console.error('❌ [iOS] Background location error:', error);
        return;
      }

      if (!data || !data.locations || !data.locations.length) {
        return;
      }

      const location = data.locations[0];
      const timestamp = new Date().toISOString();
      
      console.log(`📍 [iOS] Background location update: ${timestamp}`);
      
      try {
        // Get work location and current status
        const workLocationStr = await AsyncStorage.getItem(KEYS.WORK_LOCATION);
        const isAtWork = await AsyncStorage.getItem(KEYS.IS_AT_WORK);
        
        if (!workLocationStr) {
          console.log('⚠️ [iOS] No work location configured');
          return;
        }

        const workLocation = JSON.parse(workLocationStr);
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          workLocation.latitude,
          workLocation.longitude
        );

        const radius = workLocation.radius || 150;
        const exitThreshold = radius * IOS_EXIT_BUFFER; // 20% buffer

        console.log(`📏 [iOS] Distance: ${distance.toFixed(0)}m | Radius: ${radius}m | Exit threshold: ${exitThreshold.toFixed(0)}m`);

        // 🍎 ENTRY DETECTION (backup for geofence)
        if (distance <= radius && isAtWork !== 'true') {
          console.log('🟢 [iOS] ENTRY detected via background location');
          await handleWorkEntry(timestamp);
        }
        
        // 🍎 EXIT DETECTION (primary method for iOS!)
        else if (distance > exitThreshold && isAtWork === 'true') {
          console.log('🔴 [iOS] Potential EXIT detected - distance beyond threshold');
          await validateAndHandleExit(timestamp);
        }
        
        // Log status for debugging
        else if (isAtWork === 'true') {
          console.log(`✅ [iOS] Still at work - ${distance.toFixed(0)}m from center`);
        }
        
        // Store last check time for monitoring
        await AsyncStorage.setItem(KEYS.LAST_LOCATION_CHECK, timestamp);
        
      } catch (err) {
        console.error('❌ [iOS] Error in background location task:', err);
      }
    });
    console.log('✅ [iOS] Background location task registered (EXIT DETECTION ENABLED)');
  }
} catch (error) {
  console.error('❌ [iOS] Failed to register background location task:', error);
}

// 🍎 iOS-SPECIFIC: Validate exit with current location check
async function validateAndHandleExit(exitTime) {
  console.log('🔍 [iOS] Validating exit with fresh location check...');
  
  try {
    // Get current location to confirm exit
    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // Fast but accurate enough
      maximumAge: 5000, // Accept location up to 5 seconds old
    });
    
    const workLocationStr = await AsyncStorage.getItem(KEYS.WORK_LOCATION);
    if (!workLocationStr) {
      console.log('⚠️ [iOS] No work location for validation');
      return;
    }
    
    const workLocation = JSON.parse(workLocationStr);
    const distance = calculateDistance(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      workLocation.latitude,
      workLocation.longitude
    );
    
    const radius = workLocation.radius || 150;
    const exitThreshold = radius * IOS_EXIT_BUFFER;
    
    console.log(`🔍 [iOS] Validation distance: ${distance.toFixed(0)}m | Threshold: ${exitThreshold.toFixed(0)}m`);
    
    // Confirm user is actually outside
    if (distance > exitThreshold) {
      console.log('✅ [iOS] Exit CONFIRMED - processing shift end');
      await handleWorkExit(exitTime);
    } else {
      console.log('⚠️ [iOS] False alarm - user still within work area');
    }
    
  } catch (error) {
    console.error('❌ [iOS] Error validating exit:', error);
    // If we can't validate, trust the original exit signal
    console.log('⚠️ [iOS] Proceeding with exit anyway (validation failed)');
    await handleWorkExit(exitTime);
  }
}

// Handle work entry
async function handleWorkEntry(entryTime) {
  console.log('🟢 [iOS] Processing work entry at:', entryTime);
  
  try {
    const isAtWork = await AsyncStorage.getItem(KEYS.IS_AT_WORK);
    
    // Prevent duplicate entries
    if (isAtWork === 'true') {
      console.log('⚠️ [iOS] Already at work, ignoring duplicate entry');
      return;
    }
    
    await AsyncStorage.setItem(KEYS.ENTERED_TIME, entryTime);
    await AsyncStorage.setItem(KEYS.IS_AT_WORK, 'true');

    // Send entry notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎯 Arrived at Work',
        body: 'Your shift is being tracked...',
      },
      trigger: null,
    });

    console.log('✅ [iOS] Entry processed, scheduling confirmation check');

    // Schedule check to confirm they're still there (15 minutes)
    setTimeout(async () => {
      await checkStillAtWork();
    }, 15 * 60 * 1000); // Use 3000 for testing (3 seconds)
    
  } catch (error) {
    console.error('❌ [iOS] Error handling work entry:', error);
  }
}

// Check if user is still at work after 15 minutes
async function checkStillAtWork() {
  try {
    const isAtWork = await AsyncStorage.getItem(KEYS.IS_AT_WORK);
    const enteredTime = await AsyncStorage.getItem(KEYS.ENTERED_TIME);
    
    console.log('⏱️ [iOS] Checking if still at work...', { isAtWork, enteredTime });
    
    if (isAtWork === 'true' && enteredTime) {
      // Verify with current location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const workLocationStr = await AsyncStorage.getItem(KEYS.WORK_LOCATION);
      if (workLocationStr) {
        const workLocation = JSON.parse(workLocationStr);
        const distance = calculateDistance(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude,
          workLocation.latitude,
          workLocation.longitude
        );
        
        const radius = workLocation.radius || 150;
        
        if (distance <= radius) {
          // Still at work - confirm shift
          const currentShift = {
            startTime: enteredTime,
            confirmed: true,
          };
          await AsyncStorage.setItem(KEYS.CURRENT_SHIFT, JSON.stringify(currentShift));
          console.log('✅ [iOS] Shift confirmed - user still on-site');
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '✅ Shift Tracking Confirmed',
              body: 'Your work hours are being recorded',
            },
            trigger: null,
          });
        } else {
          // They left - trigger exit
          console.log('🔴 [iOS] User left during confirmation period');
          await handleWorkExit(new Date().toISOString());
        }
      }
    } else {
      console.log('⚠️ [iOS] No active work session to confirm');
    }
  } catch (error) {
    console.error('❌ [iOS] Error checking work status:', error);
  }
}

// 🍎 CRITICAL: Handle work exit (the main fix!)
async function handleWorkExit(exitTime) {
  console.log('🔴 [iOS] ===== PROCESSING WORK EXIT =====');
  console.log('🔴 [iOS] Exit time (original):', exitTime);
  
  try {
    const isAtWork = await AsyncStorage.getItem(KEYS.IS_AT_WORK);
    const currentShiftStr = await AsyncStorage.getItem(KEYS.CURRENT_SHIFT);
    const enteredTime = await AsyncStorage.getItem(KEYS.ENTERED_TIME);
    
    console.log('🔴 [iOS] Current state:', { isAtWork, hasShift: !!currentShiftStr, enteredTime });
    
    // Must be tracking to process exit
    if (isAtWork !== 'true') {
      console.log('⚠️ [iOS] Not tracking a shift, exit ignored');
      return;
    }
    
    // Use either confirmed shift or entered time
    const shiftStartTime = currentShiftStr 
      ? JSON.parse(currentShiftStr).startTime 
      : enteredTime;
    
    if (!shiftStartTime) {
      console.log('❌ [iOS] No shift start time found!');
      await clearWorkState();
      return;
    }
    
    // ⏰ ROUNDING LOGIC APPLIED HERE
    const originalStart = new Date(shiftStartTime);
    const originalEnd = new Date(exitTime);
    
    const roundedStart = roundEntryTime(originalStart);
    const roundedEnd = roundExitTime(originalEnd);
    
    console.log(`⏰ [iOS] Original: ${format(originalStart, 'h:mm a')} - ${format(originalEnd, 'h:mm a')}`);
    console.log(`⏰ [iOS] Rounded:  ${format(roundedStart, 'h:mm a')} - ${format(roundedEnd, 'h:mm a')}`);
    
    const durationMs = roundedEnd - roundedStart;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    console.log(`⏱️ [iOS] Shift duration (rounded): ${durationMinutes} minutes`);
    
    // Record shift if long enough
    if (durationMinutes >= 15) {
      const shiftData = {
        startTime: roundedStart.toISOString(), // ✅ Using rounded time
        endTime: roundedEnd.toISOString(),     // ✅ Using rounded time
        durationMinutes,
        date: format(roundedStart, 'yyyy-MM-dd'),
        originalStartTime: shiftStartTime,     // Keep original for reference
        originalEndTime: exitTime,             // Keep original for reference
        wasRounded: true,
      };
      
      // Add to pending shifts
      const pendingStr = await AsyncStorage.getItem(KEYS.PENDING_SHIFTS);
      const pending = pendingStr ? JSON.parse(pendingStr) : [];
      pending.push(shiftData);
      await AsyncStorage.setItem(KEYS.PENDING_SHIFTS, JSON.stringify(pending));
      
      console.log('✅ [iOS] Shift saved to pending queue (with rounded times)');
      console.log('✅ [iOS] Shift data:', shiftData);
      
      // Send notification with rounded times
      await sendShiftConfirmationNotification(shiftData);
    } else {
      console.log(`⚠️ [iOS] Shift too short (${durationMinutes} min), not recording`);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏱️ Short Visit',
          body: `You were at work for ${durationMinutes} minutes. Shifts under 15 minutes are not tracked.`,
        },
        trigger: null,
      });
    }
    
    // ALWAYS clear state after processing
    await clearWorkState();
    
    console.log('🔴 [iOS] ===== EXIT PROCESSING COMPLETE =====');
    
  } catch (error) {
    console.error('❌ [iOS] Error handling work exit:', error);
    // Still try to clear state
    await clearWorkState();
  }
}

// Helper to clear work state
async function clearWorkState() {
  console.log('🧹 [iOS] Clearing work state...');
  try {
    await AsyncStorage.multiRemove([
      KEYS.CURRENT_SHIFT,
      KEYS.ENTERED_TIME,
    ]);
    await AsyncStorage.setItem(KEYS.IS_AT_WORK, 'false');
    console.log('✅ [iOS] Work state cleared');
  } catch (error) {
    console.error('❌ [iOS] Error clearing work state:', error);
  }
}

// Send shift confirmation notification
async function sendShiftConfirmationNotification(shiftData) {
  try {
    const startTime = new Date(shiftData.startTime);
    const endTime = new Date(shiftData.endTime);
    const hours = Math.floor(shiftData.durationMinutes / 60);
    const minutes = shiftData.durationMinutes % 60;
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎯 Work Shift Completed',
        body: `${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')} (${hours}h ${minutes}m). Confirm this shift?`,
        data: { shiftData, type: 'shift_confirmation' },
        categoryIdentifier: 'SHIFT_CONFIRMATION',
      },
      trigger: null,
    });
    
    console.log('✅ [iOS] Confirmation notification sent');
  } catch (error) {
    console.error('❌ [iOS] Error sending notification:', error);
  }
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
  // 🍎 iOS-optimized start with aggressive background updates
  async startGeofencing(latitude, longitude, radius = 150) {
    try {
      console.log('🚀 [iOS] Starting geofencing...', { latitude, longitude, radius });
      
      // Validate coordinates
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw new Error('Invalid coordinates provided');
      }

      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        throw new Error('Foreground location permission not granted');
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        throw new Error('Background location permission not granted. Go to Settings > Privacy > Location Services > [Your App] and select "Always"');
      }

      console.log('✅ [iOS] Location permissions granted');

      // Store work location
      await AsyncStorage.setItem(
        KEYS.WORK_LOCATION,
        JSON.stringify({ latitude, longitude, radius })
      );

      // Stop existing geofencing if any
      const isActive = await this.isGeofencingActive();
      if (isActive) {
        console.log('⚠️ [iOS] Stopping existing geofencing...');
        await this.stopGeofencing();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 🍎 Start geofencing (good for entry detection)
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

      console.log('✅ [iOS] Geofencing region registered');

      // 🍎 CRITICAL: Aggressive background location for EXIT detection
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced, // Good balance for iOS
        timeInterval: 60 * 1000, // Check every 1 minute (iOS will throttle to ~2-5 min)
        distanceInterval: 30, // Update every 30 meters movement
        showsBackgroundLocationIndicator: true, // iOS blue bar indicator
        pausesUpdatesAutomatically: false, // Don't pause!
        activityType: Location.ActivityType.Other, // Not fitness/automotive
        foregroundService: {
          notificationTitle: 'Work Time Tracker Active',
          notificationBody: 'Monitoring your work location',
          notificationColor: '#2196F3',
        },
      });

      console.log('✅ [iOS] Background location updates started (EXIT DETECTION ACTIVE)');
      console.log('🎉 [iOS] Geofencing fully active');
      
      return true;
    } catch (error) {
      console.error('❌ [iOS] Error starting geofencing:', error);
      throw error;
    }
  },

  // Stop geofencing
  async stopGeofencing() {
    try {
      console.log('🛑 [iOS] Stopping geofencing...');
      
      const isGeofencing = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
      if (isGeofencing) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
        console.log('✅ [iOS] Geofencing stopped');
      }

      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
      if (isTracking) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
        console.log('✅ [iOS] Location updates stopped');
      }

      await AsyncStorage.multiRemove([
        KEYS.IS_AT_WORK,
        KEYS.ENTERED_TIME,
        KEYS.CURRENT_SHIFT,
        KEYS.WORK_LOCATION,
      ]);
      
      console.log('🎉 [iOS] Geofencing fully stopped');
      return true;
    } catch (error) {
      console.error('❌ [iOS] Error stopping geofencing:', error);
      throw error;
    }
  },

  // Check if active
  async isGeofencingActive() {
    try {
      return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    } catch (error) {
      console.error('❌ [iOS] Error checking status:', error);
      return false;
    }
  },

  // Get current location
  async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return location;
    } catch (error) {
      console.error('❌ [iOS] Error getting location:', error);
      throw error;
    }
  },

  // Get pending shifts
  async getPendingShifts() {
    try {
      const pendingStr = await AsyncStorage.getItem(KEYS.PENDING_SHIFTS);
      return pendingStr ? JSON.parse(pendingStr) : [];
    } catch (error) {
      console.error('❌ [iOS] Error getting pending shifts:', error);
      return [];
    }
  },

  // Clear pending shifts
  async clearPendingShifts() {
    try {
      await AsyncStorage.removeItem(KEYS.PENDING_SHIFTS);
    } catch (error) {
      console.error('❌ [iOS] Error clearing pending shifts:', error);
    }
  },

  // Remove specific pending shift
  async removePendingShift(index) {
    try {
      const pending = await this.getPendingShifts();
      pending.splice(index, 1);
      await AsyncStorage.setItem(KEYS.PENDING_SHIFTS, JSON.stringify(pending));
    } catch (error) {
      console.error('❌ [iOS] Error removing pending shift:', error);
    }
  },

  // Get current shift status
  async getCurrentShiftStatus() {
    try {
      const isAtWork = await AsyncStorage.getItem(KEYS.IS_AT_WORK);
      const currentShiftStr = await AsyncStorage.getItem(KEYS.CURRENT_SHIFT);
      const currentShift = currentShiftStr ? JSON.parse(currentShiftStr) : null;
      const enteredTime = await AsyncStorage.getItem(KEYS.ENTERED_TIME);

      return {
        isAtWork: isAtWork === 'true',
        currentShift,
        enteredTime,
      };
    } catch (error) {
      console.error('❌ [iOS] Error getting shift status:', error);
      return {
        isAtWork: false,
        currentShift: null,
        enteredTime: null,
      };
    }
  },

  // 🍎 Manual force exit for testing
  async forceExit() {
    console.log('🔴 [iOS] MANUAL EXIT TRIGGERED FOR TESTING');
    await validateAndHandleExit(new Date().toISOString());
  },
  
  // 🍎 Get last location check (for debugging)
  async getLastLocationCheck() {
    try {
      const lastCheck = await AsyncStorage.getItem(KEYS.LAST_LOCATION_CHECK);
      return lastCheck ? new Date(lastCheck) : null;
    } catch (error) {
      return null;
    }
  },
};