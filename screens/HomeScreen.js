import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { GeofencingService } from '../services/geofencingService';
import { WorkShiftService, UserSettingsService } from '../services/supabase';
import { NotificationService } from '../services/notificationService';
import { format, parseISO } from 'date-fns';

export default function HomeScreen({ navigation }) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [workLocation, setWorkLocation] = useState(null);
  const [pendingShifts, setPendingShifts] = useState([]);
  const [userId, setUserId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [enteredTime, setEnteredTime] = useState(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    const subscription = NotificationService.addNotificationResponseListener(
      async (response) => {
        const { notification } = response;
        const data = notification.request.content.data;

        if (data.type === 'shift_confirmation') {
          const actionIdentifier = response.actionIdentifier;

          if (actionIdentifier === 'CONFIRM_YES') {
            await confirmShift(data.shiftData);
          } else if (actionIdentifier === 'CONFIRM_NO') {
            navigation.navigate('EditShift', { shiftData: data.shiftData });
          }
        }
      }
    );

    return () => subscription.remove();
  }, [navigation, confirmShift]);

  const loadPendingShifts = useCallback(async () => {
    const pending = await GeofencingService.getPendingShifts();
    setPendingShifts(pending);
  }, []);

  const confirmShift = useCallback(
    async (shiftData) => {
      try {
        await WorkShiftService.createShift(userId, shiftData);
        await GeofencingService.removePendingShift(
          pendingShifts.findIndex(
            (s) => s.startTime === shiftData.startTime && s.endTime === shiftData.endTime
          )
        );
        await loadPendingShifts();
        Alert.alert('Success', 'Shift saved successfully!');
      } catch (error) {
        console.error('Error confirming shift:', error);
        Alert.alert('Error', 'Failed to save shift. Please try again.');
      }
    },
    [userId, pendingShifts, loadPendingShifts]
  );

  const initializeScreen = useCallback(async () => {
    try {
      // Get user ID (you should implement proper auth)
      const storedUserId = await AsyncStorage.getItem('user_id');
      if (!storedUserId) {
        // Generate a temporary user ID
        const tempUserId = `user_${Date.now()}`;
        await AsyncStorage.setItem('user_id', tempUserId);
        setUserId(tempUserId);
      } else {
        setUserId(storedUserId);
      }

      // Check tracking status
      const isActive = await GeofencingService.isGeofencingActive();
      setIsTracking(isActive);

      // Load work location
      const settings = await UserSettingsService.getSettings(storedUserId);
      if (settings) {
        setWorkLocation(settings);
      }

      // Get current shift status
      const status = await GeofencingService.getCurrentShiftStatus();
      setCurrentShift(status.currentShift);
      setEnteredTime(status.enteredTime);

      // Load pending shifts
      await loadPendingShifts();

      // Request notification permissions
      await NotificationService.requestPermissions();
    } catch (error) {
      console.error('Error initializing screen:', error);
    }
  }, [loadPendingShifts]);

  useEffect(() => {
    if (isFocused) {
      initializeScreen();
    }
  }, [isFocused, initializeScreen]);

  const toggleTracking = async () => {
    try {
      if (!workLocation) {
        Alert.alert(
          'Setup Required',
          'Please set up your work location first.',
          [{ text: 'Set Location', onPress: () => navigation.navigate('Settings') }]
        );
        return;
      }

      const latitude = workLocation.work_location_lat ?? workLocation.latitude;
      const longitude = workLocation.work_location_lng ?? workLocation.longitude;
      const radius =
        workLocation.geofence_radius ??
        workLocation.geofenceRadius ??
        150;

      if (isTracking) {
        await GeofencingService.stopGeofencing();
        setIsTracking(false);
        setCurrentShift(null);
        setEnteredTime(null);
        Alert.alert('Tracking Stopped', 'Location tracking has been disabled.');
      } else {
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          Alert.alert('Error', 'Work location is missing coordinates.');
          return;
        }
        await GeofencingService.startGeofencing(
          latitude,
          longitude,
          radius || 150
        );
        setIsTracking(true);
        const statusAfterStart = await GeofencingService.getCurrentShiftStatus();
        setCurrentShift(statusAfterStart.currentShift);
        setEnteredTime(statusAfterStart.enteredTime);
        Alert.alert('Tracking Started', 'Your work hours will now be tracked automatically.');
      }
    } catch (error) {
      console.error('Error toggling tracking:', error);
      Alert.alert('Error', error.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await initializeScreen();
    setRefreshing(false);
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Work Time Tracker</Text>
        <Text style={styles.subtitle}>
          {workLocation
            ? `📍 ${
                workLocation.work_location_address ??
                workLocation.workLocationAddress ??
                workLocation.address ??
                'Custom Location'
              }`
            : 'No work location set'}
        </Text>
      </View>

      {/* Tracking Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tracking Status</Text>
        <View style={styles.statusContainer}>
          <View
            style={[styles.statusIndicator, { backgroundColor: isTracking ? '#4CAF50' : '#F44336' }]}
          />
          <Text style={styles.statusText}>{isTracking ? 'Active' : 'Inactive'}</Text>
        </View>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: isTracking ? '#F44336' : '#4CAF50' }]}
          onPress={toggleTracking}
        >
          <Text style={styles.buttonText}>
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>

        {(currentShift || enteredTime) && (
          <View style={styles.currentShiftCard}>
            <Text style={styles.currentShiftTitle}>
              {currentShift ? '🎯 Currently At Work' : '⏱️ Tracking In Progress'}
            </Text>
            <Text style={styles.currentShiftTime}>
              Started:{' '}
              {format(
                parseISO(currentShift?.startTime ?? enteredTime),
                'h:mm a'
              )}
            </Text>
            {!currentShift && (
              <Text style={styles.currentShiftSubtext}>
                Confirming you’re still on site…
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Pending Shifts */}
      {pendingShifts.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pending Confirmations</Text>
          {pendingShifts.map((shift, index) => (
            <View key={index} style={styles.pendingShiftCard}>
              <View style={styles.pendingShiftInfo}>
                <Text style={styles.pendingShiftDate}>
                  {format(parseISO(shift.date), 'MMM dd, yyyy')}
                </Text>
                <Text style={styles.pendingShiftTime}>
                  {format(parseISO(shift.startTime), 'h:mm a')} -{' '}
                  {format(parseISO(shift.endTime), 'h:mm a')}
                </Text>
                <Text style={styles.pendingShiftDuration}>
                  {formatDuration(shift.durationMinutes)}
                </Text>
              </View>
              <View style={styles.pendingShiftActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.confirmButton]}
                  onPress={() => confirmShift(shift)}
                >
                  <Text style={styles.actionButtonText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => navigation.navigate('EditShift', { shiftData: shift, index })}
                >
                  <Text style={styles.actionButtonText}>✎</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.quickActionText}>📅 View Work History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Insights')}
        >
          <Text style={styles.quickActionText}>📊 View Insights</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.quickActionText}>⚙️ Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: '#2196F3',
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#E3F2FD',
  },
  card: {
    backgroundColor: '#FFF',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  currentShiftCard: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  currentShiftTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 5,
  },
  currentShiftTime: {
    fontSize: 14,
    color: '#558B2F',
  },
  currentShiftSubtext: {
    fontSize: 12,
    color: '#7CB342',
    marginTop: 4,
  },
  pendingShiftCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  pendingShiftInfo: {
    flex: 1,
  },
  pendingShiftDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  pendingShiftTime: {
    fontSize: 14,
    color: '#F57C00',
    marginTop: 2,
  },
  pendingShiftDuration: {
    fontSize: 12,
    color: '#FB8C00',
    marginTop: 2,
  },
  pendingShiftActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quickActionButton: {
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 10,
  },
  quickActionText: {
    fontSize: 16,
    color: '#333',
  },
});
