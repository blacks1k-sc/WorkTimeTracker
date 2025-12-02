import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO } from 'date-fns';
import Colors from '../theme/colors';

export default function AddPaymentScreen({ navigation }) {
  const [datePaid, setDatePaid] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showDatePaidPicker, setShowDatePaidPicker] = useState(false);
  const [activePeriodField, setActivePeriodField] = useState(null); // 'start', 'end', or null

  const handleDatePaidChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePaidPicker(false);
    }
    if (selectedDate) {
      setDatePaid(selectedDate);
      if (Platform.OS === 'ios') {
        setShowDatePaidPicker(false);
      }
    }
  };

  const handlePeriodDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setActivePeriodField(null);
    }
    if (selectedDate && activePeriodField) {
      if (activePeriodField === 'start') {
        setStartDate(selectedDate);
        // Ensure end date is not before start date
        if (selectedDate > endDate) {
          setEndDate(selectedDate);
        }
      } else if (activePeriodField === 'end') {
        // Ensure end date is not before start date
        if (selectedDate >= startDate) {
          setEndDate(selectedDate);
        } else {
          Alert.alert('Invalid Date', 'End date must be on or after start date');
        }
      }
      if (Platform.OS === 'ios') {
        setActivePeriodField(null);
      }
    }
  };

  // Close other pickers when opening a new one
  const openDatePaidPicker = () => {
    setActivePeriodField(null);
    setShowDatePaidPicker(true);
  };

  const openStartDatePicker = () => {
    setShowDatePaidPicker(false);
    setActivePeriodField('start');
  };

  const openEndDatePicker = () => {
    setShowDatePaidPicker(false);
    setActivePeriodField('end');
  };

  const handleSave = async () => {
    try {
      if (endDate < startDate) {
        Alert.alert('Invalid Period', 'End date must be on or after start date');
        return;
      }

      const userId = await AsyncStorage.getItem('user_id');
      const paymentData = {
        datePaid: datePaid.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId: userId,
        createdAt: new Date().toISOString(),
      };

      // Save to AsyncStorage (you can later move this to Supabase)
      const paymentsStr = await AsyncStorage.getItem('payments');
      const payments = paymentsStr ? JSON.parse(paymentsStr) : [];
      payments.push(paymentData);
      await AsyncStorage.setItem('payments', JSON.stringify(payments));

      Alert.alert('Success', 'Payment record saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error saving payment:', error);
      Alert.alert('Error', 'Failed to save payment record. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Record Payment</Text>
        <Text style={styles.subtitle}>Track when you received payment</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Date Paid</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={openDatePaidPicker}
        >
          <Text style={styles.dateButtonText}>
            {format(datePaid, 'MMM dd, yyyy')}
          </Text>
        </TouchableOpacity>
        {showDatePaidPicker && (
          <DateTimePicker
            value={datePaid}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDatePaidChange}
            maximumDate={new Date()}
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Time Period</Text>
        <Text style={styles.sectionSubtitle}>
          Select the work period this payment covers
        </Text>

        <View style={styles.dateRow}>
          <View style={styles.dateColumn}>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity
              style={[
                styles.dateButton,
                activePeriodField === 'start' && styles.dateButtonActive,
              ]}
              onPress={openStartDatePicker}
            >
              <Text style={styles.dateButtonText}>
                {format(startDate, 'MMM dd, yyyy')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateColumn}>
            <Text style={styles.label}>End Date</Text>
            <TouchableOpacity
              style={[
                styles.dateButton,
                activePeriodField === 'end' && styles.dateButtonActive,
              ]}
              onPress={openEndDatePicker}
            >
              <Text style={styles.dateButtonText}>
                {format(endDate, 'MMM dd, yyyy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Single date picker for period dates */}
        {activePeriodField && (
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>
              Select {activePeriodField === 'start' ? 'Start' : 'End'} Date
            </Text>
            <DateTimePicker
              value={activePeriodField === 'start' ? startDate : endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handlePeriodDateChange}
              minimumDate={activePeriodField === 'end' ? startDate : undefined}
              maximumDate={
                activePeriodField === 'start' ? endDate : new Date()
              }
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setActivePeriodField(null)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.periodSummary}>
          <Text style={styles.periodSummaryText}>
            Period: {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')}
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Payment Record</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  dateButton: {
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateButtonActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.card,
  },
  dateButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  pickerContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  doneButton: {
    marginTop: 15,
    backgroundColor: Colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  dateColumn: {
    flex: 1,
  },
  periodSummary: {
    marginTop: 15,
    padding: 15,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  periodSummaryText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    padding: 15,
    paddingBottom: 40,
  },
  saveButton: {
    backgroundColor: Colors.success,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

