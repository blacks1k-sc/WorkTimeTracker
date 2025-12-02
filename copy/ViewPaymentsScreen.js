import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { format, parseISO, differenceInDays } from 'date-fns';
import { WorkShiftService } from '../services/supabase';
import Colors from '../theme/colors';

// Lazy load print modules to prevent crashes if not available
let Print = null;
let shareAsync = null;

try {
  Print = require('expo-print').default || require('expo-print');
  const sharing = require('expo-sharing');
  shareAsync = sharing.shareAsync;
} catch (error) {
  console.warn('Print/Sharing modules not available:', error);
}

export default function ViewPaymentsScreen({ navigation }) {
  const [payments, setPayments] = useState([]);
  const [userId, setUserId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [allShifts, setAllShifts] = useState([]);
  const isFocused = useIsFocused();

  const loadPayments = useCallback(async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('user_id');
      setUserId(storedUserId);

      const paymentsStr = await AsyncStorage.getItem('payments');
      const paymentsData = paymentsStr ? JSON.parse(paymentsStr) : [];
      
      // Sort by date paid (newest first)
      paymentsData.sort((a, b) => new Date(b.datePaid) - new Date(a.datePaid));
      setPayments(paymentsData);

      // Load all shifts to calculate hours
      if (storedUserId) {
        const shifts = await WorkShiftService.getAllShifts(storedUserId);
        setAllShifts(shifts);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadPayments();
    }
  }, [isFocused, loadPayments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  const calculateHoursForPeriod = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const shiftsInPeriod = allShifts.filter((shift) => {
      const shiftDate = parseISO(shift.date);
      return shiftDate >= start && shiftDate <= end;
    });

    const totalMinutes = shiftsInPeriod.reduce(
      (sum, shift) => sum + (shift.duration_minutes || 0),
      0
    );

    return (totalMinutes / 60).toFixed(2);
  };

  const generatePDF = async (payment) => {
    if (!Print || !shareAsync) {
      Alert.alert(
        'PDF Export Unavailable',
        'PDF export requires rebuilding the app. Please rebuild the app in Xcode to enable this feature.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const startDate = new Date(payment.startDate);
      const endDate = new Date(payment.endDate);
      const datePaid = new Date(payment.datePaid);
      const hoursWorked = calculateHoursForPeriod(payment.startDate, payment.endDate);

      // Get shifts for this period
      const shiftsInPeriod = allShifts.filter((shift) => {
        const shiftDate = parseISO(shift.date);
        return shiftDate >= startDate && shiftDate <= endDate;
      });

      // Calculate summaries
      const sortedPayments = [...payments].sort((a, b) => new Date(b.datePaid) - new Date(a.datePaid));
      const lastPayment = sortedPayments.length > 1 ? sortedPayments[1] : null;
      const totalPayments = sortedPayments.length;
      const totalHoursAllTime = allShifts.reduce(
        (sum, shift) => sum + (shift.duration_minutes || 0),
        0
      ) / 60;

      // Generate HTML for PDF
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #6366F1;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #6366F1;
              margin: 0;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #6366F1;
              margin-bottom: 15px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #eee;
            }
            .info-label {
              font-weight: 600;
              color: #666;
            }
            .info-value {
              color: #333;
            }
            .timeline {
              margin-top: 15px;
            }
            .timeline-item {
              padding: 10px;
              margin-bottom: 10px;
              background-color: #f5f5f5;
              border-left: 3px solid #6366F1;
            }
            .summary-box {
              background-color: #f0f0f0;
              padding: 15px;
              border-radius: 5px;
              margin-top: 15px;
            }
            .summary-title {
              font-weight: bold;
              margin-bottom: 10px;
              color: #6366F1;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #6366F1;
              color: white;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payment Report</h1>
            <p>Generated on ${format(new Date(), 'MMMM dd, yyyy')}</p>
          </div>

          <div class="section">
            <div class="section-title">Payment Details</div>
            <div class="info-row">
              <span class="info-label">Date Paid:</span>
              <span class="info-value">${format(datePaid, 'MMMM dd, yyyy')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Payment Period:</span>
              <span class="info-value">${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Hours Worked:</span>
              <span class="info-value">${hoursWorked} hours</span>
            </div>
            <div class="info-row">
              <span class="info-label">Days in Period:</span>
              <span class="info-value">${differenceInDays(endDate, startDate) + 1} days</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Work Timeline</div>
            ${shiftsInPeriod.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  ${shiftsInPeriod.map(shift => `
                    <tr>
                      <td>${format(parseISO(shift.date), 'MMM dd, yyyy')}</td>
                      <td>${format(parseISO(shift.start_time), 'h:mm a')}</td>
                      <td>${format(parseISO(shift.end_time), 'h:mm a')}</td>
                      <td>${(shift.duration_minutes / 60).toFixed(2)} hours</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p>No shifts recorded for this period.</p>'}
          </div>

          <div class="section">
            <div class="section-title">Payment Summary</div>
            <div class="summary-box">
              <div class="summary-title">Last Payment</div>
              ${lastPayment ? `
                <div class="info-row">
                  <span class="info-label">Date:</span>
                  <span class="info-value">${format(new Date(lastPayment.datePaid), 'MMMM dd, yyyy')}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Period:</span>
                  <span class="info-value">${format(new Date(lastPayment.startDate), 'MMM dd')} - ${format(new Date(lastPayment.endDate), 'MMM dd, yyyy')}</span>
                </div>
              ` : '<p>This is your first payment.</p>'}
            </div>
            <div class="summary-box" style="margin-top: 15px;">
              <div class="summary-title">All-Time Summary</div>
              <div class="info-row">
                <span class="info-label">Total Payments:</span>
                <span class="info-value">${totalPayments}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Total Hours Worked:</span>
                <span class="info-value">${totalHoursAllTime.toFixed(2)} hours</span>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (shareAsync) {
        await shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      } else {
        Alert.alert('Success', 'PDF generated successfully!');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    }
  };

  const formatDuration = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Payment History</Text>
        <Text style={styles.subtitle}>
          {payments.length} payment{payments.length !== 1 ? 's' : ''} recorded
        </Text>
      </View>

      {payments.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No payments recorded yet.</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddPayment')}
          >
            <Text style={styles.addButtonText}>Add First Payment</Text>
          </TouchableOpacity>
        </View>
      ) : (
        payments.map((payment, index) => {
          const hoursWorked = calculateHoursForPeriod(payment.startDate, payment.endDate);
          return (
            <View key={index} style={styles.card}>
              <View style={styles.paymentHeader}>
                <View>
                  <Text style={styles.paymentDate}>
                    {format(parseISO(payment.datePaid), 'MMM dd, yyyy')}
                  </Text>
                  <Text style={styles.paymentPeriod}>
                    {format(parseISO(payment.startDate), 'MMM dd')} -{' '}
                    {format(parseISO(payment.endDate), 'MMM dd, yyyy')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.exportButton}
                  onPress={() => generatePDF(payment)}
                >
                  <Text style={styles.exportButtonText}>Export PDF</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.paymentDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hours Worked:</Text>
                  <Text style={styles.detailValue}>{hoursWorked} hours</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
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
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  paymentDate: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 5,
  },
  paymentPeriod: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  exportButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  exportButtonText: {
    color: Colors.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
  paymentDetails: {
    marginTop: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: Colors.success,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
});

