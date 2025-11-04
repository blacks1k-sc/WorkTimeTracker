import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
  differenceInDays,
  subMonths,
  eachDayOfInterval,
  getDay,
} from 'date-fns';

export const AnalyticsService = {
  // Calculate total hours worked
  calculateTotalHours(shifts) {
    return shifts.reduce((total, shift) => total + (shift.duration_minutes || 0), 0) / 60;
  },

  // Calculate earnings
  calculateEarnings(shifts, hourlyRate) {
    const totalHours = this.calculateTotalHours(shifts);
    return totalHours * hourlyRate;
  },

  // ✅ NEW: Get all-time stats
  getAllTimeStats(shifts, hourlyRate) {
    const hours = this.calculateTotalHours(shifts);
    const earnings = this.calculateEarnings(shifts, hourlyRate);
    const daysWorked = new Set(shifts.map((s) => s.date)).size;

    return {
      hours,
      earnings,
      daysWorked,
      shifts: shifts.length,
    };
  },

  // Get weekly stats
  getWeeklyStats(shifts, hourlyRate) {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

    const weekShifts = shifts.filter((shift) => {
      const shiftDate = parseISO(shift.date);
      return shiftDate >= weekStart && shiftDate <= weekEnd;
    });

    const hours = this.calculateTotalHours(weekShifts);
    const earnings = this.calculateEarnings(weekShifts, hourlyRate);
    const daysWorked = new Set(weekShifts.map((s) => s.date)).size;

    return {
      hours,
      earnings,
      daysWorked,
      shifts: weekShifts.length,
    };
  },

  // Get monthly stats
  getMonthlyStats(shifts, hourlyRate) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const monthShifts = shifts.filter((shift) => {
      const shiftDate = parseISO(shift.date);
      return shiftDate >= monthStart && shiftDate <= monthEnd;
    });

    const hours = this.calculateTotalHours(monthShifts);
    const earnings = this.calculateEarnings(monthShifts, hourlyRate);
    const daysWorked = new Set(monthShifts.map((s) => s.date)).size;

    return {
      hours,
      earnings,
      daysWorked,
      shifts: monthShifts.length,
    };
  },

  // ✅ NEW: Custom Range Stats
  getCustomRangeStats(shifts, hourlyRate, fromDate, toDate) {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    // Set times to include full days
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const rangeShifts = shifts.filter((shift) => {
      const shiftDate = parseISO(shift.date);
      return shiftDate >= start && shiftDate <= end;
    });

    const hours = this.calculateTotalHours(rangeShifts);
    const earnings = this.calculateEarnings(rangeShifts, hourlyRate);
    const daysWorked = new Set(rangeShifts.map((s) => s.date)).size;

    return {
      hours,
      earnings,
      daysWorked,
      shifts: rangeShifts.length,
      dateRange: {
        from: format(start, 'MMM dd, yyyy'),
        to: format(end, 'MMM dd, yyyy'),
      },
    };
  },

  // Compare with last month
  compareWithLastMonth(shifts, hourlyRate) {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const thisMonthShifts = shifts.filter((shift) => {
      const shiftDate = parseISO(shift.date);
      return shiftDate >= thisMonthStart && shiftDate <= thisMonthEnd;
    });

    const lastMonthShifts = shifts.filter((shift) => {
      const shiftDate = parseISO(shift.date);
      return shiftDate >= lastMonthStart && shiftDate <= lastMonthEnd;
    });

    const thisMonthHours = this.calculateTotalHours(thisMonthShifts);
    const lastMonthHours = this.calculateTotalHours(lastMonthShifts);
    const thisMonthEarnings = this.calculateEarnings(thisMonthShifts, hourlyRate);
    const lastMonthEarnings = this.calculateEarnings(lastMonthShifts, hourlyRate);

    const hoursDiff = thisMonthHours - lastMonthHours;
    const earningsDiff = thisMonthEarnings - lastMonthEarnings;
    const hoursPercentChange =
      lastMonthHours > 0 ? ((hoursDiff / lastMonthHours) * 100).toFixed(1) : 0;
    const earningsPercentChange =
      lastMonthEarnings > 0 ? ((earningsDiff / lastMonthEarnings) * 100).toFixed(1) : 0;

    return {
      thisMonth: {
        hours: thisMonthHours,
        earnings: thisMonthEarnings,
      },
      lastMonth: {
        hours: lastMonthHours,
        earnings: lastMonthEarnings,
      },
      difference: {
        hours: hoursDiff,
        earnings: earningsDiff,
        hoursPercent: hoursPercentChange,
        earningsPercent: earningsPercentChange,
      },
    };
  },

  // Calculate streak
  calculateStreak(shifts) {
    if (shifts.length === 0) return 0;

    const sortedDates = [...new Set(shifts.map((s) => s.date))].sort().reverse();
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const dateStr of sortedDates) {
      const shiftDate = parseISO(dateStr);
      shiftDate.setHours(0, 0, 0, 0);
      const daysDiff = differenceInDays(currentDate, shiftDate);

      if (daysDiff === 0 || daysDiff === 1) {
        streak++;
        currentDate = shiftDate;
      } else {
        break;
      }
    }

    return streak;
  },

  // Find longest shift
  findLongestShift(shifts) {
    if (shifts.length === 0) return null;

    return shifts.reduce((longest, shift) => {
      return shift.duration_minutes > (longest?.duration_minutes || 0) ? shift : longest;
    }, null);
  },

  // Get chart data for last 7 days
  getWeeklyChartData(shifts) {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayShifts = shifts.filter((shift) => shift.date === dayStr);
      const hours = this.calculateTotalHours(dayShifts);

      return {
        date: format(day, 'EEE'),
        hours: parseFloat(hours.toFixed(2)),
      };
    });
  },

  // Get chart data for last 30 days
  getMonthlyChartData(shifts) {
    const now = new Date();
    const start = subMonths(now, 1);
    const end = now;
    const days = eachDayOfInterval({ start, end });

    return days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayShifts = shifts.filter((shift) => shift.date === dayStr);
      const hours = this.calculateTotalHours(dayShifts);

      return {
        date: format(day, 'MMM dd'),
        hours: parseFloat(hours.toFixed(2)),
      };
    });
  },

  // ✅ NEW: Get chart data for custom date range
  getCustomRangeChartData(shifts, fromDate, toDate) {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const days = eachDayOfInterval({ start, end });

    // Limit to 30 days for readability
    const limitedDays = days.length > 30 ? days.slice(-30) : days;

    return limitedDays.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayShifts = shifts.filter((shift) => shift.date === dayStr);
      const hours = this.calculateTotalHours(dayShifts);

      return {
        date: format(day, 'MMM dd'),
        hours: parseFloat(hours.toFixed(2)),
      };
    });
  },

  // Project monthly earnings
  projectMonthlyEarnings(shifts, hourlyRate) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const daysInMonth = endOfMonth(now).getDate();
    const daysPassed = now.getDate();

    const monthShifts = shifts.filter((shift) => {
      const shiftDate = parseISO(shift.date);
      return shiftDate >= monthStart;
    });

    const currentEarnings = this.calculateEarnings(monthShifts, hourlyRate);
    const avgDailyEarnings = currentEarnings / daysPassed;
    const projectedTotal = avgDailyEarnings * daysInMonth;

    return {
      current: currentEarnings,
      projected: projectedTotal,
      daysRemaining: daysInMonth - daysPassed,
    };
  },

  // Predict work patterns
  predictWorkPattern(shifts) {
    const dayFrequency = {};
    const timeFrequency = {};

    shifts.forEach((shift) => {
      const date = parseISO(shift.date);
      const dayOfWeek = getDay(date);
      const startTime = parseISO(shift.start_time);
      const hour = startTime.getHours();

      dayFrequency[dayOfWeek] = (dayFrequency[dayOfWeek] || 0) + 1;
      timeFrequency[hour] = (timeFrequency[hour] || 0) + 1;
    });

    const mostCommonDay = Object.entries(dayFrequency).reduce((a, b) =>
      b[1] > a[1] ? b : a
    )[0];
    const mostCommonHour = Object.entries(timeFrequency).reduce((a, b) =>
      b[1] > a[1] ? b : a
    )[0];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
      mostCommonDay: dayNames[mostCommonDay],
      mostCommonHour: parseInt(mostCommonHour),
      dayFrequency,
      timeFrequency,
    };
  },

  // Calculate days until payday
  daysUntilPayday(payday) {
    if (!payday) return null;

    const now = new Date();
    const payDate = new Date(payday);

    if (payDate < now) {
      // Next month's payday
      payDate.setMonth(payDate.getMonth() + 1);
    }

    return differenceInDays(payDate, now);
  },

  // Get insights summary - enhanced to support different view modes
  getInsightsSummary(shifts, hourlyRate, payday, viewMode = 'week', customDates = null) {
    let primaryStats;
    let chartData;

    // Determine which stats to show based on view mode
    switch (viewMode) {
      case 'allTime':
        primaryStats = this.getAllTimeStats(shifts, hourlyRate);
        chartData = this.getMonthlyChartData(shifts);
        break;
      case 'custom':
        if (customDates?.from && customDates?.to) {
          primaryStats = this.getCustomRangeStats(
            shifts,
            hourlyRate,
            customDates.from,
            customDates.to
          );
          chartData = this.getCustomRangeChartData(shifts, customDates.from, customDates.to);
        } else {
          primaryStats = this.getWeeklyStats(shifts, hourlyRate);
          chartData = this.getWeeklyChartData(shifts);
        }
        break;
      case 'week':
      default:
        primaryStats = this.getWeeklyStats(shifts, hourlyRate);
        chartData = this.getWeeklyChartData(shifts);
        break;
    }

    const weeklyStats = this.getWeeklyStats(shifts, hourlyRate);
    const monthlyStats = this.getMonthlyStats(shifts, hourlyRate);
    const allTimeStats = this.getAllTimeStats(shifts, hourlyRate);
    const comparison = this.compareWithLastMonth(shifts, hourlyRate);
    const streak = this.calculateStreak(shifts);
    const longestShift = this.findLongestShift(shifts);
    const projection = viewMode === 'week' ? this.projectMonthlyEarnings(shifts, hourlyRate) : null;
    const pattern = shifts.length > 5 ? this.predictWorkPattern(shifts) : null;
    const daysToPayday = this.daysUntilPayday(payday);

    return {
      primary: primaryStats, // The main stats to display (changes based on view mode)
      weekly: weeklyStats,
      monthly: monthlyStats,
      allTime: allTimeStats,
      comparison,
      streak,
      longestShift,
      projection,
      pattern,
      daysToPayday,
      chartData,
      viewMode,
    };
  },
};