import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkShiftService } from '../services/supabase';
import { GeofencingService } from '../services/geofencingService';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import Colors from '../theme/colors';

export default function EditShiftScreen({ route, navigation }) {
  const { shiftData, index } = route.params;
  
  const [startTime, setStartTime] = useState(new Date(shiftData.startTime));
  const [endTime, setEndTime] = useState(new Date(shiftData.endTime));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleStartTimeChange = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartTime(selectedDate);
    }
  };

  const handleEndTimeChange = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndTime(selectedDate);
    }
  };

  const calculateDuration = () => {
    return differenceInMinutes(endTime, startTime);
  };

  const handleSave = async () => {
    try {
      const durationMinutes = calculateDuration();
      
      if (durationMinutes <= 0) {
        Alert.alert('Invalid Time', 'End time must be after start time');
        return;
      }

      if (durationMinutes < 15) {
        Alert.alert('Invalid Duration', 'Shift must be at least 15 minutes');
        return;
      }

      const userId = await AsyncStorage.getItem('user_id');
      const updatedShiftData = {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes,
        date: format(startTime, 'yyyy-MM-dd'),
      };

      // Save to database
      await WorkShiftService.createShift(userId, updatedShiftData);

      // Remove from pending shifts if it came from there
      if (index !== undefined) {
        await GeofencingService.removePendingShift(index);
      }

      Alert.alert('Success', 'Shift saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error saving shift:', error);
      Alert.alert('Error', 'Failed to save shift. Please try again.');
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Edit Shift Time</Text>
        
        <View style={styles.section}>
          <Text style={styles.label}>Start Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowStartPicker(true)}
          >
            <Text style={styles.timeText}>{format(startTime, 'h:mm a')}</Text>
          </TouchableOpacity>
          {showStartPicker && (
            <DateTimePicker
              value={startTime}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={handleStartTimeChange}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>End Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowEndPicker(true)}
          >
            <Text style={styles.timeText}>{format(endTime, 'h:mm a')}</Text>
          </TouchableOpacity>
          {showEndPicker && (
            <DateTimePicker
              value={endTime}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={handleEndTimeChange}
            />
          )}
        </View>

        <View style={styles.durationCard}>
          <Text style={styles.durationLabel}>Total Duration</Text>
          <Text style={styles.durationValue}>
            {formatDuration(calculateDuration())}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.card,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  timeButton: {
    backgroundColor: Colors.surface,
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeText: {
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
  durationCard: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  durationLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  durationValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: Colors.success,
    marginLeft: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.buttonText,
  },
});