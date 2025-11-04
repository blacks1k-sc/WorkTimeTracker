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
import { format, parseISO } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';

const screenWidth = Dimensions.get('window').width;

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
                backgroundColor: '#2196F3',
                backgroundGradientFrom: '#42A5F5',
                backgroundGradientTo: '#2196F3',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: '#ffa726',
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        )}

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
                            ? '#4CAF50'
                            : '#F44336',
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
                            ? '#4CAF50'
                            : '#F44336',
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
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    margin: 15,
    borderRadius: 12,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#2196F3',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  viewModeTextActive: {
    color: '#FFF',
  },
  card: {
    backgroundColor: '#FFF',
    margin: 15,
    marginTop: 0,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  quickStatsContainer: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 8,
  },
  quickStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickStatLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  quickStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  projectionContainer: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 8,
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  projectionLabel: {
    fontSize: 14,
    color: '#2E7D32',
  },
  projectionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B5E20',
  },
  projectedTotal: {
    fontSize: 20,
    color: '#4CAF50',
  },
  projectionNote: {
    fontSize: 12,
    color: '#558B2F',
    marginTop: 5,
    textAlign: 'center',
  },
  comparisonContainer: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  comparisonLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  comparisonValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonCurrent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 10,
  },
  comparisonChange: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 10,
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
    color: '#666',
  },
  achievementValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 2,
  },
  achievementDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  patternText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  patternHighlight: {
    fontWeight: '600',
    color: '#2196F3',
  },
  paydayText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  paydayDays: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  spacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
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
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#2196F3',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});