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
import Colors from '../theme/colors';

export default function HomeScreen({ navigation }) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [workLocation, setWorkLocation] = useState(null);
  const [pendingShifts, setPendingShifts] = useState([]);
  const [userId, setUserId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [enteredTime, setEnteredTime] = useState(null);
  const isFocused = useIsFocused();

  const confirmShift = useCallback(
    async (shiftData) => {
      try {
        await WorkShiftService.createShift(userId, shiftData);
        await GeofencingService.removePendingShift(
          pendingShifts.findIndex(
            (s) =>
              s.startTime === shiftData.startTime && s.endTime === shiftData.endTime
          )
        );
        await loadPendingShifts();
        Alert.alert('Success', 'Shift saved successfully!');
      } catch (error) {
        console.error('Error confirming shift:', error);
        Alert.alert('Error', 'Failed to save shift. Please try again.');
      }
    },
    [userId, pendingShifts]
  );

  const loadPendingShifts = useCallback(async () => {
    const pending = await GeofencingService.getPendingShifts();
    setPendingShifts(pending);
  }, []);

  const initializeScreen = useCallback(async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('user_id');
      if (!storedUserId) {
        const tempUserId = `user_${Date.now()}`;
        await AsyncStorage.setItem('user_id', tempUserId);
        setUserId(tempUserId);
      } else {
        setUserId(storedUserId);
      }

      const isActive = await GeofencingService.isGeofencingActive();
      setIsTracking(isActive);

      const settings = await UserSettingsService.getSettings(storedUserId);
      if (settings) setWorkLocation(settings);

      const status = await GeofencingService.getCurrentShiftStatus();
      setCurrentShift(status.currentShift);
      setEnteredTime(status.enteredTime);

      await loadPendingShifts();
      await NotificationService.requestPermissions();
    } catch (error) {
      console.error('Error initializing screen:', error);
    }
  }, [loadPendingShifts]);

  useEffect(() => {
    if (isFocused) initializeScreen();
  }, [isFocused, initializeScreen]);

  const toggleTracking = async () => {
    try {
      if (!workLocation) {
        Alert.alert('Setup Required', 'Please set your work location first.', [
          { text: 'Set Location', onPress: () => navigation.navigate('Settings') },
        ]);
        return;
      }

      const latitude =
        workLocation.work_location_lat ?? workLocation.latitude;
      const longitude =
        workLocation.work_location_lng ?? workLocation.longitude;
      const radius =
        workLocation.geofence_radius ?? workLocation.geofenceRadius ?? 150;

      if (isTracking) {
        await GeofencingService.stopGeofencing();
        setIsTracking(false);
        setCurrentShift(null);
        setEnteredTime(null);
        Alert.alert('Tracking Stopped', 'Location tracking disabled.');
      } else {
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          Alert.alert('Error', 'Work location missing coordinates.');
          return;
        }
        await GeofencingService.startGeofencing(latitude, longitude, radius);
        setIsTracking(true);
        const statusAfterStart = await GeofencingService.getCurrentShiftStatus();
        setCurrentShift(statusAfterStart.currentShift);
        setEnteredTime(statusAfterStart.enteredTime);
        Alert.alert('Tracking Started', 'Now tracking your work hours.');
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
                workLocation.address ??
                'Custom Location'
              }`
            : 'No work location set'}
        </Text>
      </View>

      {/* Tracking Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tracking Status</Text>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: isTracking ? Colors.success : Colors.error },
            ]}
          />
          <Text style={styles.statusText}>
            {isTracking ? 'Active' : 'Inactive'}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: isTracking ? Colors.error : Colors.success },
          ]}
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
                  onPress={() =>
                    navigation.navigate('EditShift', { shiftData: shift, index })
                  }
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
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.card,
    margin: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  currentShiftCard: {
    marginTop: 15,
    padding: 15,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  currentShiftTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accentAlt,
    marginBottom: 5,
  },
  currentShiftTime: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  pendingShiftCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  pendingShiftInfo: { flex: 1 },
  pendingShiftDate: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  pendingShiftTime: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  pendingShiftDuration: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pendingShiftActions: { flexDirection: 'row' },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  confirmButton: { backgroundColor: Colors.success },
  editButton: { backgroundColor: Colors.accent },
  actionButtonText: { color: Colors.buttonText, fontSize: 18, fontWeight: 'bold' },
  quickActionButton: {
    padding: 15,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 10,
  },
  quickActionText: {
    color: Colors.textPrimary,
    fontSize: 15,
  },
});