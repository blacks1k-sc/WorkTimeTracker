import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Colors from '../theme/colors';

export default function PaymentsMainScreen({ navigation }) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>Manage your payment records</Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => navigation.navigate('ViewPayments')}
        >
          <Text style={styles.optionButtonText}>View Payments</Text>
          <Text style={styles.optionButtonSubtext}>
            View payment history and export reports
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => navigation.navigate('AddPayment')}
        >
          <Text style={styles.optionButtonText}>Add Payment</Text>
          <Text style={styles.optionButtonSubtext}>
            Record a new payment
          </Text>
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
  optionButton: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 5,
  },
  optionButtonSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});

