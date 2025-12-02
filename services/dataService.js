import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkShiftService, UserSettingsService } from './supabase';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';

/**
 * Data Service for AI Chat Assistant
 * Fetches and formats work data to provide context to the AI
 */
export const DataService = {
  /**
   * Get user ID from AsyncStorage
   */
  async getUserId() {
    try {
      return await AsyncStorage.getItem('user_id');
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  },

  /**
   * Get recent shifts (last 30 days)
   */
  async getRecentShifts(userId) {
    try {
      if (!userId) return [];
      
      const endDate = new Date();
      const startDate = subDays(endDate, 30);
      
      const shifts = await WorkShiftService.getShifts(
        userId,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );
      
      return shifts || [];
    } catch (error) {
      console.error('Error fetching recent shifts:', error);
      return [];
    }
  },

  /**
   * Get shifts for a specific period
   */
  async getShiftsForPeriod(userId, period) {
    try {
      if (!userId) return [];
      
      let startDate, endDate;
      const now = new Date();
      
      switch (period) {
        case 'today':
          startDate = now;
          endDate = now;
          break;
        case 'thisWeek':
          startDate = startOfWeek(now, { weekStartsOn: 0 }); // 0 = Sunday
          endDate = endOfWeek(now, { weekStartsOn: 0 });
          break;
        case 'lastWeek':
          startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }); // 0 = Sunday
          endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
          break;
        case 'thisMonth':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'lastMonth':
          startDate = startOfMonth(subMonths(now, 1));
          endDate = endOfMonth(subMonths(now, 1));
          break;
        default:
          startDate = subDays(now, 7);
          endDate = now;
      }
      
      const shifts = await WorkShiftService.getShifts(
        userId,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );
      
      return shifts || [];
    } catch (error) {
      console.error('Error fetching shifts for period:', error);
      return [];
    }
  },

  /**
   * Get all shifts
   */
  async getAllShifts(userId) {
    try {
      if (!userId) return [];
      return await WorkShiftService.getAllShifts(userId);
    } catch (error) {
      console.error('Error fetching all shifts:', error);
      return [];
    }
  },

  /**
   * Get payments from AsyncStorage
   */
  async getPayments() {
    try {
      const paymentsStr = await AsyncStorage.getItem('payments');
      return paymentsStr ? JSON.parse(paymentsStr) : [];
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  },

  /**
   * Get user settings
   */
  async getUserSettings(userId) {
    try {
      if (!userId) return null;
      return await UserSettingsService.getSettings(userId);
    } catch (error) {
      console.error('Error fetching user settings:', error);
      return null;
    }
  },

  /**
   * Calculate total hours from shifts
   */
  calculateTotalHours(shifts) {
    if (!shifts || shifts.length === 0) return 0;
    const totalMinutes = shifts.reduce((sum, shift) => sum + (shift.duration_minutes || 0), 0);
    return (totalMinutes / 60).toFixed(2);
  },

  /**
   * Format shifts data for AI context
   */
  formatShiftsForAI(shifts) {
    if (!shifts || shifts.length === 0) {
      return 'No shifts recorded.';
    }

    const totalHours = this.calculateTotalHours(shifts);
    const shiftList = shifts.slice(0, 10).map((shift, index) => {
      const date = format(parseISO(shift.date), 'MMM dd, yyyy');
      const startTime = format(parseISO(shift.start_time), 'h:mm a');
      const endTime = format(parseISO(shift.end_time), 'h:mm a');
      const hours = (shift.duration_minutes / 60).toFixed(2);
      return `${index + 1}. ${date}: ${startTime} - ${endTime} (${hours} hours)`;
    }).join('\n');

    return `Total shifts: ${shifts.length}\nTotal hours: ${totalHours}\n\nRecent shifts:\n${shiftList}${shifts.length > 10 ? `\n... and ${shifts.length - 10} more shifts` : ''}`;
  },

  /**
   * Format payments data for AI context
   */
  formatPaymentsForAI(payments) {
    if (!payments || payments.length === 0) {
      return 'No payments recorded.';
    }

    const sortedPayments = [...payments].sort((a, b) => new Date(b.datePaid) - new Date(a.datePaid));
    const paymentList = sortedPayments.slice(0, 5).map((payment, index) => {
      const datePaid = format(parseISO(payment.datePaid), 'MMM dd, yyyy');
      const startDate = format(parseISO(payment.startDate), 'MMM dd');
      const endDate = format(parseISO(payment.endDate), 'MMM dd, yyyy');
      return `${index + 1}. Paid on ${datePaid} for period ${startDate} - ${endDate}`;
    }).join('\n');

    return `Total payments: ${payments.length}\n\nRecent payments:\n${paymentList}`;
  },

  /**
   * Build comprehensive context for AI
   */
  async buildContext(userId, query) {
    try {
      const [recentShifts, payments, settings] = await Promise.all([
        this.getRecentShifts(userId),
        this.getPayments(),
        this.getUserSettings(userId),
      ]);

      const context = {
        recentShifts: this.formatShiftsForAI(recentShifts),
        payments: this.formatPaymentsForAI(payments),
        totalShifts: recentShifts.length,
        totalHours: this.calculateTotalHours(recentShifts),
        settings: settings ? {
          hourlyRate: settings.hourly_rate,
          workLocation: settings.work_location_address,
        } : null,
      };

      return context;
    } catch (error) {
      console.error('Error building context:', error);
      return {
        recentShifts: 'Error loading shifts.',
        payments: 'Error loading payments.',
        totalShifts: 0,
        totalHours: 0,
        settings: null,
      };
    }
  },
};

