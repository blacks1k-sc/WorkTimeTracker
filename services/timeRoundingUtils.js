// Time Rounding Utilities for Shift Calculations

/**
 * Rounds minutes according to business rules:
 * - 0-15 minutes → 0 (round down to hour)
 * - 16-30 minutes → 30 (round to half hour)
 * - 31-45 minutes → 30 (round to half hour)
 * - 46-60 minutes → 60 (round up to next hour)
 * 
 * @param {Date} date - The date/time to round
 * @returns {Date} - New Date object with rounded time
 */
export function roundTime(date) {
    const rounded = new Date(date);
    const minutes = rounded.getMinutes();
    
    if (minutes <= 15) {
      // Round down to the hour
      rounded.setMinutes(0, 0, 0);
    } else if (minutes > 15 && minutes <= 45) {
      // Round to 30 minutes
      rounded.setMinutes(30, 0, 0);
    } else {
      // Round up to next hour
      rounded.setMinutes(0, 0, 0);
      rounded.setHours(rounded.getHours() + 1);
    }
    
    return rounded;
  }
  
  /**
   * Rounds entry time (typically rounds down to be fair to employee)
   * - 0-15 minutes → 0
   * - 16-45 minutes → 30
   * - 46-60 minutes → 60
   * 
   * @param {Date|string} dateTime - The entry time to round
   * @returns {Date} - Rounded entry time
   */
  export function roundEntryTime(dateTime) {
    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    return roundTime(date);
  }
  
  /**
   * Rounds exit time (typically rounds up to be fair to employee)
   * - 0-15 minutes → 0
   * - 16-45 minutes → 30
   * - 46-60 minutes → 60
   * 
   * @param {Date|string} dateTime - The exit time to round
   * @returns {Date} - Rounded exit time
   */
  export function roundExitTime(dateTime) {
    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
    return roundTime(date);
  }
  
  /**
   * Calculate duration in minutes between two times after rounding
   * 
   * @param {Date|string} startTime - Start time
   * @param {Date|string} endTime - End time
   * @returns {number} - Duration in minutes
   */
  export function calculateRoundedDuration(startTime, endTime) {
    const roundedStart = roundEntryTime(startTime);
    const roundedEnd = roundExitTime(endTime);
    
    const durationMs = roundedEnd - roundedStart;
    return Math.floor(durationMs / (1000 * 60));
  }
  
  /**
   * Format rounded time for display
   * 
   * @param {Date} date - The date to format
   * @returns {string} - Formatted time string (e.g., "9:00 AM")
   */
  export function formatRoundedTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  
  /**
   * Process shift data with rounded times
   * 
   * @param {Object} shiftData - Original shift data
   * @param {string} shiftData.startTime - ISO string of start time
   * @param {string} shiftData.endTime - ISO string of end time
   * @returns {Object} - Processed shift with rounded times
   */
  export function processShiftWithRounding(shiftData) {
    const originalStart = new Date(shiftData.startTime);
    const originalEnd = new Date(shiftData.endTime);
    
    const roundedStart = roundEntryTime(originalStart);
    const roundedEnd = roundExitTime(originalEnd);
    
    const roundedDuration = calculateRoundedDuration(originalStart, originalEnd);
    
    return {
      ...shiftData,
      startTime: roundedStart.toISOString(),
      endTime: roundedEnd.toISOString(),
      durationMinutes: roundedDuration,
      originalStartTime: shiftData.startTime,
      originalEndTime: shiftData.endTime,
      wasRounded: true,
    };
  }
  
  // Example usage and tests
  if (process.env.NODE_ENV === 'development') {
    console.log('=== Time Rounding Examples ===');
    
    // Test cases
    const testCases = [
      { time: '2024-01-15T09:05:00', expected: '09:00' },
      { time: '2024-01-15T09:15:00', expected: '09:00' },
      { time: '2024-01-15T09:16:00', expected: '09:30' },
      { time: '2024-01-15T09:30:00', expected: '09:30' },
      { time: '2024-01-15T09:45:00', expected: '09:30' },
      { time: '2024-01-15T09:46:00', expected: '10:00' },
      { time: '2024-01-15T09:59:00', expected: '10:00' },
    ];
    
    testCases.forEach(({ time, expected }) => {
      const rounded = roundTime(new Date(time));
      const formatted = formatRoundedTime(rounded);
      console.log(`${time.split('T')[1]} → ${formatted} (expected: ${expected})`);
    });
  }