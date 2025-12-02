import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkShiftService } from '../services/supabase';
import { format, parseISO } from 'date-fns';
import Colors from '../theme/colors';

export default function HistoryScreen({ navigation }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('user_id');
      const allShifts = await WorkShiftService.getAllShifts(userId);
      setShifts(allShifts);
      setLoading(false);
    } catch (error) {
      console.error('Error loading shifts:', error);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadShifts();
    setRefreshing(false);
  };

  const handleDeleteShift = (shift) => {
    Alert.alert(
      'Delete Shift',
      'Are you sure you want to delete this shift?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await WorkShiftService.deleteShift(shift.id);
              await loadShifts();
              Alert.alert('Success', 'Shift deleted successfully');
            } catch (error) {
              console.error('Error deleting shift:', error);
              Alert.alert('Error', 'Failed to delete shift');
            }
          },
        },
      ]
    );
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const renderShift = ({ item }) => {
    const startTime = parseISO(item.start_time);
    const endTime = parseISO(item.end_time);
    const date = parseISO(item.date);

    return (
      <TouchableOpacity
        style={styles.shiftCard}
        onLongPress={() => handleDeleteShift(item)}
      >
        <View style={styles.shiftHeader}>
          <Text style={styles.shiftDate}>{format(date, 'EEEE, MMM dd, yyyy')}</Text>
          <Text style={styles.shiftDuration}>{formatDuration(item.duration_minutes)}</Text>
        </View>
        <View style={styles.shiftTime}>
          <Text style={styles.timeText}>
            {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    if (shifts.length === 0) return null;

    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.duration_minutes, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Work History</Text>
        <View style={styles.summaryStats}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{shifts.length}</Text>
            <Text style={styles.summaryLabel}>Shifts</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalHours}</Text>
            <Text style={styles.summaryLabel}>Hours</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No work history yet</Text>
      <Text style={styles.emptySubtext}>
        Your work shifts will appear here once you start tracking
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={shifts}
        renderItem={renderShift}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={shifts.length === 0 ? styles.emptyList : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: Colors.primary,
    margin: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 15,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  shiftCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shiftDate: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  shiftDuration: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  shiftTime: {
    marginTop: 5,
  },
  timeText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});