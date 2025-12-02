import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkShiftService, UserSettingsService } from '../services/supabase';
import { AnalyticsService } from '../services/analyticsService';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import Colors from '../theme/colors';

const screenWidth = Dimensions.get('window').width;

// Calendar Component
function CalendarView({ shifts }) {
  const [viewingDate, setViewingDate] = useState(new Date());
  const currentDate = new Date();
  
  const monthStart = startOfMonth(viewingDate);
  const monthEnd = endOfMonth(viewingDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get dates that have shifts
  const workedDates = new Set();
  shifts.forEach((shift) => {
    const shiftDate = parseISO(shift.date);
    workedDates.add(format(shiftDate, 'yyyy-MM-dd'));
  });

  // Get first day of month to calculate offset
  const firstDayOfWeek = getDay(monthStart); // 0 = Sunday, 1 = Monday, etc.
  const offsetDays = firstDayOfWeek; // Since week starts on Sunday

  // Create array with empty cells for days before month starts
  const calendarDays = [];
  for (let i = 0; i < offsetDays; i++) {
    calendarDays.push(null);
  }
  daysInMonth.forEach((day) => {
    calendarDays.push(day);
  });

  // Fill remaining cells to complete the grid (6 rows x 7 days = 42 cells)
  while (calendarDays.length < 42) {
    calendarDays.push(null);
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Navigation functions
  const goToPreviousMonth = () => {
    setViewingDate(new Date(viewingDate.getFullYear(), viewingDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewingDate(new Date(viewingDate.getFullYear(), viewingDate.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    setViewingDate(new Date());
  };

  // Check if viewing current month
  const isCurrentMonth = viewingDate.getMonth() === currentDate.getMonth() && 
                         viewingDate.getFullYear() === currentDate.getFullYear();

  return (
    <View style={styles.calendarContainer}>
      {/* Month Header with Navigation */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          style={styles.calendarNavButton}
          onPress={goToPreviousMonth}
        >
          <Text style={styles.calendarNavButtonText}>‹</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.calendarMonthButton}
          onPress={goToCurrentMonth}
        >
          <Text style={styles.calendarMonth}>
            {format(viewingDate, 'MMMM yyyy')}
          </Text>
          {!isCurrentMonth && (
            <Text style={styles.calendarCurrentMonthHint}>Tap to return to current month</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.calendarNavButton}
          onPress={goToNextMonth}
          disabled={isCurrentMonth} // Disable next month if viewing current month
        >
          <Text style={[
            styles.calendarNavButtonText,
            isCurrentMonth && styles.calendarNavButtonTextDisabled
          ]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Week Day Headers */}
      <View style={styles.calendarWeekHeader}>
        {weekDays.map((day, index) => (
          <View key={index} style={styles.calendarWeekDay}>
            <Text style={styles.calendarWeekDayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => {
          if (!day) {
            return <View key={index} style={styles.calendarDay} />;
          }

          const dayKey = format(day, 'yyyy-MM-dd');
          const isWorked = workedDates.has(dayKey);
          const isToday = isSameDay(day, currentDate) && isCurrentMonth;

          return (
            <View
              key={index}
              style={[
                styles.calendarDay,
                isToday && styles.calendarDayToday,
              ]}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  isToday && styles.calendarDayTextToday,
                  !isSameMonth(day, currentDate) && styles.calendarDayTextOtherMonth,
                ]}
              >
                {format(day, 'd')}
              </Text>
              {isWorked && <View style={styles.calendarDot} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function InsightsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState(null);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [allShifts, setAllShifts] = useState([]); // Store all shifts

  // View mode states
  const [viewMode, setViewMode] = useState('week'); // 'week', 'allTime', 'custom'
  const [showDateModal, setShowDateModal] = useState(false);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  const loadInsights = useCallback(async (mode = viewMode, customDates = null) => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('user_id');

      // Get settings
      const settings = await UserSettingsService.getSettings(userId);
      const rate = settings?.hourly_rate || 0;
      setHourlyRate(rate);

      // Get all shifts
      const shifts = await WorkShiftService.getAllShifts(userId);
      setAllShifts(shifts);

      // Calculate insights based on view mode
      const insightsData = AnalyticsService.getInsightsSummary(
        shifts,
        rate,
        settings?.payday,
        mode,
        customDates
      );
      setInsights(insightsData);

      setLoading(false);
    } catch (error) {
      console.error('Error loading insights:', error);
      setLoading(false);
    }
  }, [viewMode]);

  useFocusEffect(
    useCallback(() => {
      loadInsights();
    }, [loadInsights])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInsights();
    setRefreshing(false);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode === 'custom') {
      setShowDateModal(true);
    } else {
      loadInsights(mode);
    }
  };

  const handleCustomDateSubmit = () => {
    if (!customFromDate || !customToDate) {
      Alert.alert('Error', 'Please enter both start and end dates');
      return;
    }

    try {
      const from = parseISO(customFromDate);
      const to = parseISO(customToDate);

      if (from > to) {
        Alert.alert('Error', 'Start date must be before end date');
        return;
      }

      setShowDateModal(false);
      loadInsights('custom', { from: customFromDate, to: customToDate });
    } catch (error) {
      Alert.alert('Error', 'Invalid date format. Please use YYYY-MM-DD');
    }
  };

  const getViewModeTitle = () => {
    switch (viewMode) {
      case 'allTime':
        return 'All Time';
      case 'custom':
        return insights?.primary?.dateRange
          ? `${insights.primary.dateRange.from} - ${insights.primary.dateRange.to}`
          : 'Custom Range';
      case 'week':
      default:
        return 'This Week';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading insights...</Text>
      </View>
    );
  }

  if (!insights) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available yet</Text>
        <Text style={styles.emptySubtext}>
          Start tracking your work hours to see insights!
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* View Mode Selector */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'week' && styles.viewModeButtonActive,
            ]}
            onPress={() => handleViewModeChange('week')}
          >
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'week' && styles.viewModeTextActive,
              ]}
            >
              This Week
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'allTime' && styles.viewModeButtonActive,
            ]}
            onPress={() => handleViewModeChange('allTime')}
          >
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'allTime' && styles.viewModeTextActive,
              ]}
            >
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'custom' && styles.viewModeButtonActive,
            ]}
            onPress={() => handleViewModeChange('custom')}
          >
            <Text
              style={[
                styles.viewModeText,
                viewMode === 'custom' && styles.viewModeTextActive,
              ]}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* Primary Stats Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{getViewModeTitle()}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {insights.primary.hours.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Hours</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                ${insights.primary.earnings.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{insights.primary.daysWorked}</Text>
              <Text style={styles.statLabel}>Days</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{insights.primary.shifts}</Text>
              <Text style={styles.statLabel}>Shifts</Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        {insights.chartData && insights.chartData.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hours Worked</Text>
            <LineChart
              data={{
                labels: insights.chartData.map((d) => d.date),
                datasets: [
                  {
                    data: insights.chartData.map((d) => d.hours || 0.1), // Minimum value for chart
                  },
                ],
              }}
              width={screenWidth - 70}
              height={220}
              chartConfig={{
                backgroundColor: Colors.primary,
                backgroundGradientFrom: Colors.primary,
                backgroundGradientTo: Colors.primaryDark,
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: Colors.accentAlt,
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        )}

        {/* Calendar View */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Work Calendar</Text>
          <CalendarView shifts={allShifts} />
        </View>

        {/* Quick Stats Summary (Show when not in Week mode) */}
        {viewMode !== 'week' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Quick Stats</Text>
            <View style={styles.quickStatsContainer}>
              <View style={styles.quickStatRow}>
                <Text style={styles.quickStatLabel}>This Week:</Text>
                <Text style={styles.quickStatValue}>
                  {insights.weekly.hours.toFixed(1)}h • $
                  {insights.weekly.earnings.toFixed(2)}
                </Text>
              </View>
              <View style={styles.quickStatRow}>
                <Text style={styles.quickStatLabel}>This Month:</Text>
                <Text style={styles.quickStatValue}>
                  {insights.monthly.hours.toFixed(1)}h • $
                  {insights.monthly.earnings.toFixed(2)}
                </Text>
              </View>
              <View style={styles.quickStatRow}>
                <Text style={styles.quickStatLabel}>All Time:</Text>
                <Text style={styles.quickStatValue}>
                  {insights.allTime.hours.toFixed(1)}h • $
                  {insights.allTime.earnings.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Earnings Projection (Only show in week mode) */}
        {viewMode === 'week' && insights.projection && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💰 Earnings Projection</Text>
            <View style={styles.projectionContainer}>
              <View style={styles.projectionRow}>
                <Text style={styles.projectionLabel}>Current Earnings:</Text>
                <Text style={styles.projectionValue}>
                  ${insights.projection.current.toFixed(2)}
                </Text>
              </View>
              <View style={styles.projectionRow}>
                <Text style={styles.projectionLabel}>Projected Total:</Text>
                <Text style={[styles.projectionValue, styles.projectedTotal]}>
                  ${insights.projection.projected.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.projectionNote}>
                {insights.projection.daysRemaining} days remaining this month
              </Text>
            </View>
          </View>
        )}

        {/* Comparison with Last Month (Only show in week mode) */}
        {viewMode === 'week' && insights.comparison && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Month Comparison</Text>
            <View style={styles.comparisonContainer}>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Hours</Text>
                <View style={styles.comparisonValues}>
                  <Text style={styles.comparisonCurrent}>
                    {insights.comparison.thisMonth.hours.toFixed(1)}h
                  </Text>
                  <Text
                    style={[
                      styles.comparisonChange,
                      {
                        color:
                          insights.comparison.difference.hours >= 0
                            ? Colors.success
                            : Colors.error,
                      },
                    ]}
                  >
                    {insights.comparison.difference.hours >= 0 ? '+' : ''}
                    {insights.comparison.difference.hoursPercent}%
                  </Text>
                </View>
              </View>
              <View style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>Earnings</Text>
                <View style={styles.comparisonValues}>
                  <Text style={styles.comparisonCurrent}>
                    ${insights.comparison.thisMonth.earnings.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.comparisonChange,
                      {
                        color:
                          insights.comparison.difference.earnings >= 0
                            ? Colors.success
                            : Colors.error,
                      },
                    ]}
                  >
                    {insights.comparison.difference.earnings >= 0 ? '+' : ''}
                    {insights.comparison.difference.earningsPercent}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Streak and Records */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏆 Achievements</Text>
          <View style={styles.achievementItem}>
            <Text style={styles.achievementIcon}>🔥</Text>
            <View style={styles.achievementInfo}>
              <Text style={styles.achievementLabel}>Current Streak</Text>
              <Text style={styles.achievementValue}>
                {insights.streak} {insights.streak === 1 ? 'day' : 'days'}
              </Text>
            </View>
          </View>
          {insights.longestShift && (
            <View style={styles.achievementItem}>
              <Text style={styles.achievementIcon}>⏱️</Text>
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementLabel}>Longest Shift</Text>
                <Text style={styles.achievementValue}>
                  {(insights.longestShift.duration_minutes / 60).toFixed(1)}{' '}
                  hours
                </Text>
                <Text style={styles.achievementDate}>
                  {format(
                    new Date(insights.longestShift.date),
                    'MMM dd, yyyy'
                  )}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Work Pattern */}
        {insights.pattern && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 Work Pattern</Text>
            <Text style={styles.patternText}>
              You usually work on{' '}
              <Text style={styles.patternHighlight}>
                {insights.pattern.mostCommonDay}s
              </Text>{' '}
              around{' '}
              <Text style={styles.patternHighlight}>
                {insights.pattern.mostCommonHour}:00
              </Text>
            </Text>
          </View>
        )}

        {/* Payday Countdown */}
        {insights.daysToPayday !== null && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💵 Next Payday</Text>
            <Text style={styles.paydayText}>
              {insights.daysToPayday === 0 ? (
                'Today! 🎉'
              ) : (
                <>
                  <Text style={styles.paydayDays}>{insights.daysToPayday}</Text>{' '}
                  {insights.daysToPayday === 1 ? 'day' : 'days'} to go
                </>
              )}
            </Text>
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Custom Date Range Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date Range</Text>

            <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2024-01-01"
              value={customFromDate}
              onChangeText={setCustomFromDate}
              placeholderTextColor="#999"
            />

            <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2024-12-31"
              value={customToDate}
              onChangeText={setCustomToDate}
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowDateModal(false);
                  setViewMode('week');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleCustomDateSubmit}
              >
                <Text style={styles.submitButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 40,
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
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    margin: 15,
    borderRadius: 12,
    padding: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: Colors.primary,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  viewModeTextActive: {
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.card,
    margin: 15,
    marginTop: 0,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    padding: 15,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  quickStatsContainer: {
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickStatLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  quickStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  projectionContainer: {
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  projectionLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  projectionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  projectedTotal: {
    fontSize: 20,
    color: Colors.success,
  },
  projectionNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 5,
    textAlign: 'center',
  },
  comparisonContainer: {
    backgroundColor: Colors.surface,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  comparisonLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  comparisonValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonCurrent: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: 10,
  },
  comparisonChange: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Colors.card,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  achievementValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 2,
  },
  achievementDate: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  patternText: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  patternHighlight: {
    fontWeight: '600',
    color: Colors.primary,
  },
  paydayText: {
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  paydayDays: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.success,
  },
  spacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.primary,
  },
  submitButtonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  calendarContainer: {
    marginTop: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  calendarNavButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calendarNavButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  calendarNavButtonTextDisabled: {
    color: Colors.textTertiary,
    opacity: 0.5,
  },
  calendarMonthButton: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  calendarMonth: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  calendarCurrentMonthHint: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
    textAlign: 'center',
  },
  calendarWeekHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  calendarWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarWeekDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  calendarDayToday: {
    backgroundColor: Colors.primary + '20',
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  calendarDayTextToday: {
    fontWeight: 'bold',
    color: Colors.primary,
  },
  calendarDayTextOtherMonth: {
    color: Colors.textTertiary,
  },
  calendarDot: {
    position: 'absolute',
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
});