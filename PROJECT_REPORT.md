# Work Time Tracker - Complete Project Documentation

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Core Concepts](#core-concepts)
5. [App Architecture](#app-architecture)
6. [Database Schema](#database-schema)
7. [Screens Explained](#screens-explained)
8. [Services Explained](#services-explained)
9. [Key Features](#key-features)
10. [How It All Works Together](#how-it-all-works-together)

---

## Project Overview

**Work Time Tracker** is a React Native mobile application that automatically tracks when you arrive at and leave your workplace using GPS location (geofencing). It calculates your work hours, earnings, and provides insights about your work patterns.

### What is Geofencing?
Geofencing is like drawing an invisible circle around a location. When you enter or exit that circle, the app gets notified. Think of it like a security system that knows when you're "home" or "away."

### Main Purpose
- **Automatically track work hours** without manually clocking in/out
- **Calculate earnings** based on your hourly rate
- **View work history** and statistics
- **Get insights** about your work patterns

---

## Technology Stack

### Frontend Framework
- **React Native** (v0.81.5) - Cross-platform mobile app framework
- **Expo** (~54.0.0) - Development platform for React Native

### Navigation
- **@react-navigation/native** - Navigation library
- **@react-navigation/bottom-tabs** - Bottom tab navigation
- **@react-navigation/native-stack** - Stack navigation

### Database & Backend
- **Supabase** - PostgreSQL database with real-time capabilities
- **@supabase/supabase-js** - JavaScript client for Supabase

### Location Services
- **expo-location** - Access device GPS and location services
- **expo-task-manager** - Run tasks in the background
- **react-native-maps** - Display interactive maps
- **react-native-google-places-autocomplete** - Search for locations

### Utilities
- **date-fns** - Date manipulation and formatting
- **@react-native-async-storage/async-storage** - Local storage on device
- **react-native-chart-kit** - Display charts and graphs
- **expo-notifications** - Send push notifications

---

## Project Structure

```
trackerapp/
├── App.js                    # Main app entry point
├── package.json             # Dependencies and scripts
├── app.json                 # Expo configuration
├── database_schema.sql      # Database structure
├── screens/                 # All app screens
│   ├── HomeScreen.js       # Main dashboard
│   ├── HistoryScreen.js    # View past shifts
│   ├── InsightsScreen.js   # Analytics and stats
│   ├── SettingsScreen.js   # Configure app settings
│   └── EditShiftScreen.js   # Edit shift times
├── services/                # Business logic
│   ├── supabase.js         # Database operations
│   ├── geofencingService.js # Location tracking
│   ├── notificationService.js # Push notifications
│   ├── analyticsService.js  # Calculate statistics
│   └── timeRoundingUtils.js # Round time to nearest intervals
└── theme/
    └── colors.js           # Color scheme
```

---

## Core Concepts

### 1. Geofencing
The app creates a virtual boundary (geofence) around your workplace. When you cross this boundary:
- **Entering**: App records your arrival time
- **Exiting**: App records your departure time and calculates hours worked

### 2. Time Rounding
To make time tracking fair, the app rounds times:
- **0-15 minutes** → Rounds down to the hour (e.g., 9:05 AM → 9:00 AM)
- **16-45 minutes** → Rounds to half hour (e.g., 9:20 AM → 9:30 AM)
- **46-60 minutes** → Rounds up to next hour (e.g., 9:50 AM → 10:00 AM)

### 3. Pending Shifts
When you leave work, the app creates a "pending shift" that needs your confirmation. You can:
- ✅ Confirm it (save as-is)
- ✏️ Edit it (adjust times)
- ❌ Delete it (if it was a mistake)

---

## App Architecture

### Navigation Structure

The app uses a **Tab Navigator** with a **Stack Navigator** overlay:

```
App (NavigationContainer)
└── Stack Navigator
    ├── MainTabs (Tab Navigator)
    │   ├── Home Tab
    │   ├── History Tab
    │   ├── Insights Tab
    │   └── Settings Tab
    └── EditShift (Modal Screen)
```

**Code from `App.js`:**
```javascript
// Create navigators
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator with 4 main screens
function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Main App wraps everything in NavigationContainer
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="EditShift" component={EditShiftScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## Database Schema

The app uses **Supabase** (PostgreSQL) with three main tables:

### 1. `user_settings` Table
Stores user configuration:
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  work_location_lat DOUBLE PRECISION,      -- Work location latitude
  work_location_lng DOUBLE PRECISION,      -- Work location longitude
  work_location_address TEXT,               -- Formatted address
  hourly_rate DECIMAL(10, 2),               -- Pay per hour
  payday TEXT,                              -- When user gets paid
  geofence_radius INTEGER DEFAULT 150,      -- Size of geofence (meters)
  tracking_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 2. `work_shifts` Table
Stores completed work shifts:
```sql
CREATE TABLE work_shifts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,           -- When shift started
  end_time TIMESTAMP NOT NULL,              -- When shift ended
  duration_minutes INTEGER NOT NULL,        -- Total minutes worked
  date DATE NOT NULL,                       -- Date of shift
  synced BOOLEAN DEFAULT true,              -- Whether synced from offline
  notes TEXT,                               -- Optional notes
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 3. `sync_queue` Table
Stores shifts waiting to be synced (offline support):
```sql
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  shift_data JSONB NOT NULL,                -- Shift data as JSON
  synced BOOLEAN DEFAULT false,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP,
  synced_at TIMESTAMP
);
```

---

## Screens Explained

### 1. HomeScreen (`screens/HomeScreen.js`)

**Purpose**: Main dashboard where users start/stop tracking and see current status.

**Key Features**:
- Toggle tracking on/off
- View current shift status
- Confirm pending shifts
- Quick navigation to other screens

**Code Snippet - Tracking Toggle**:
```javascript
const toggleTracking = async () => {
  // Check if work location is set
  if (!workLocation) {
    Alert.alert('Setup Required', 'Please set your work location first.');
    return;
  }

  if (isTracking) {
    // Stop tracking
    await GeofencingService.stopGeofencing();
    setIsTracking(false);
  } else {
    // Start tracking with work location coordinates
    await GeofencingService.startGeofencing(
      workLocation.latitude,
      workLocation.longitude,
      workLocation.geofence_radius
    );
    setIsTracking(true);
  }
};
```

**Code Snippet - Displaying Current Shift**:
```javascript
{currentShift && (
  <View style={styles.currentShiftCard}>
    <Text>🎯 Currently At Work</Text>
    <Text>
      Started: {format(parseISO(currentShift.startTime), 'h:mm a')}
    </Text>
  </View>
)}
```

**Code Snippet - Confirming Pending Shifts**:
```javascript
const confirmShift = async (shiftData) => {
  // Save shift to database
  await WorkShiftService.createShift(userId, shiftData);
  
  // Remove from pending list
  await GeofencingService.removePendingShift(index);
  
  Alert.alert('Success', 'Shift saved successfully!');
};
```

---

### 2. HistoryScreen (`screens/HistoryScreen.js`)

**Purpose**: View all past work shifts in a list.

**Key Features**:
- Display all shifts with dates and times
- Show total hours and shift count
- Delete shifts (long press)
- Pull to refresh

**Code Snippet - Loading Shifts**:
```javascript
const loadShifts = async () => {
  const userId = await AsyncStorage.getItem('user_id');
  const allShifts = await WorkShiftService.getAllShifts(userId);
  setShifts(allShifts);
};
```

**Code Snippet - Displaying Shift Card**:
```javascript
const renderShift = ({ item }) => {
  const startTime = parseISO(item.start_time);
  const endTime = parseISO(item.end_time);
  
  return (
    <TouchableOpacity style={styles.shiftCard}>
      <Text>{format(startTime, 'EEEE, MMM dd, yyyy')}</Text>
      <Text>
        {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
      </Text>
      <Text>{formatDuration(item.duration_minutes)}</Text>
    </TouchableOpacity>
  );
};
```

**Code Snippet - Summary Statistics**:
```javascript
const totalMinutes = shifts.reduce(
  (sum, shift) => sum + shift.duration_minutes, 
  0
);
const totalHours = (totalMinutes / 60).toFixed(1);

// Display: "X Shifts" and "Y Hours"
```

---

### 3. InsightsScreen (`screens/InsightsScreen.js`)

**Purpose**: Display analytics, charts, and insights about work patterns.

**Key Features**:
- View stats for week/month/all-time/custom range
- Line chart showing hours worked
- Earnings projections
- Work pattern analysis
- Streaks and achievements

**Code Snippet - Loading Insights**:
```javascript
const loadInsights = async () => {
  const userId = await AsyncStorage.getItem('user_id');
  const shifts = await WorkShiftService.getAllShifts(userId);
  const settings = await UserSettingsService.getSettings(userId);
  
  // Calculate insights using AnalyticsService
  const insights = AnalyticsService.getInsightsSummary(
    shifts,
    settings.hourly_rate,
    settings.payday,
    viewMode // 'week', 'allTime', or 'custom'
  );
  
  setInsights(insights);
};
```

**Code Snippet - Displaying Chart**:
```javascript
<LineChart
  data={{
    labels: insights.chartData.map(d => d.date),
    datasets: [{
      data: insights.chartData.map(d => d.hours)
    }]
  }}
  width={screenWidth - 70}
  height={220}
/>
```

**Code Snippet - Primary Stats Display**:
```javascript
<View style={styles.statsGrid}>
  <View style={styles.statItem}>
    <Text>{insights.primary.hours.toFixed(1)}</Text>
    <Text>Hours</Text>
  </View>
  <View style={styles.statItem}>
    <Text>${insights.primary.earnings.toFixed(2)}</Text>
    <Text>Earned</Text>
  </View>
  <View style={styles.statItem}>
    <Text>{insights.primary.daysWorked}</Text>
    <Text>Days</Text>
  </View>
  <View style={styles.statItem}>
    <Text>{insights.primary.shifts}</Text>
    <Text>Shifts</Text>
  </View>
</View>
```

---

### 4. SettingsScreen (`screens/SettingsScreen.js`)

**Purpose**: Configure work location, hourly rate, and other settings.

**Key Features**:
- Search for work location using Google Places
- Interactive map to set location
- Set geofence radius (50-500 meters)
- Set hourly rate
- Set payday information

**Code Snippet - Setting Work Location**:
```javascript
const handlePlaceSelect = (data, details) => {
  const lat = details.geometry.location.lat;
  const lng = details.geometry.location.lng;
  
  setWorkLocation({
    latitude: lat,
    longitude: lng,
    address: details.formatted_address
  });
  
  // Update map to show location
  mapRef.current.animateToRegion({
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01
  });
};
```

**Code Snippet - Saving Settings**:
```javascript
const saveSettings = async () => {
  // Validate inputs
  if (!workLocation) {
    Alert.alert('Error', 'Please set your work location');
    return;
  }
  
  // Save to database
  await UserSettingsService.upsertSettings(userId, {
    workLocationLat: workLocation.latitude,
    workLocationLng: workLocation.longitude,
    workLocationAddress: workLocation.address,
    hourlyRate: parseFloat(hourlyRate),
    geofenceRadius: parseInt(geofenceRadius),
    payday: payday,
    trackingEnabled: true
  });
  
  // Restart geofencing with new location
  await GeofencingService.startGeofencing(
    workLocation.latitude,
    workLocation.longitude,
    parseInt(geofenceRadius)
  );
};
```

**Code Snippet - Map Display**:
```javascript
<MapView
  provider={PROVIDER_GOOGLE}
  region={region}
  onPress={handleMapPress}  // Tap map to set location
>
  {/* Work location marker (red pin) */}
  {workLocation && (
    <>
      <Marker
        coordinate={{
          latitude: workLocation.latitude,
          longitude: workLocation.longitude
        }}
        title="Work Location"
      />
      {/* Geofence circle */}
      <Circle
        center={{
          latitude: workLocation.latitude,
          longitude: workLocation.longitude
        }}
        radius={geofenceRadius}
        fillColor="rgba(33, 150, 243, 0.2)"
      />
    </>
  )}
</MapView>
```

---

### 5. EditShiftScreen (`screens/EditShiftScreen.js`)

**Purpose**: Edit start/end times of a pending shift before confirming.

**Key Features**:
- Change start time
- Change end time
- See calculated duration
- Save or cancel

**Code Snippet - Editing Shift Times**:
```javascript
const handleSave = async () => {
  const durationMinutes = differenceInMinutes(endTime, startTime);
  
  if (durationMinutes <= 0) {
    Alert.alert('Invalid Time', 'End time must be after start time');
    return;
  }
  
  const updatedShiftData = {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMinutes,
    date: format(startTime, 'yyyy-MM-dd')
  };
  
  // Save to database
  await WorkShiftService.createShift(userId, updatedShiftData);
  
  // Remove from pending shifts
  await GeofencingService.removePendingShift(index);
  
  navigation.goBack();
};
```

---

## Services Explained

### 1. Supabase Service (`services/supabase.js`)

**Purpose**: Handle all database operations (CRUD - Create, Read, Update, Delete).

**Key Functions**:

#### WorkShiftService
```javascript
// Create a new shift
async createShift(userId, data) {
  const { data: shift, error } = await supabase
    .from('work_shifts')
    .insert([{
      user_id: userId,
      start_time: data.startTime,
      end_time: data.endTime,
      duration_minutes: data.durationMinutes,
      date: data.date
    }])
    .select()
    .single();
  
  if (error) throw error;
  return shift;
}

// Get all shifts for a user
async getAllShifts(userId) {
  const { data, error } = await supabase
    .from('work_shifts')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data;
}

// Delete a shift
async deleteShift(shiftId) {
  const { error } = await supabase
    .from('work_shifts')
    .delete()
    .eq('id', shiftId);
  
  if (error) throw error;
}
```

#### UserSettingsService
```javascript
// Get user settings
async getSettings(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  return data; // null if not found
}

// Save or update settings
async upsertSettings(userId, settings) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      work_location_lat: settings.workLocationLat,
      work_location_lng: settings.workLocationLng,
      hourly_rate: settings.hourlyRate,
      geofence_radius: settings.geofenceRadius
    }, { onConflict: 'user_id' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

---

### 2. Geofencing Service (`services/geofencingService.js`)

**Purpose**: Handle all location tracking and geofencing logic. This is the most complex service!

**Key Concepts**:
- **Background Tasks**: Run even when app is closed
- **Geofence Events**: Triggered when entering/exiting the geofence
- **Location Updates**: Periodic location checks to confirm exit (iOS-specific)

**How It Works**:

1. **Start Geofencing**:
```javascript
async startGeofencing(latitude, longitude, radius) {
  // Request permissions
  await Location.requestForegroundPermissionsAsync();
  await Location.requestBackgroundPermissionsAsync();
  
  // Register geofence region
  await Location.startGeofencingAsync(GEOFENCE_TASK, [{
    identifier: 'work-location',
    latitude,
    longitude,
    radius,
    notifyOnEnter: true,
    notifyOnExit: true
  }]);
  
  // Start background location updates (for iOS exit detection)
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 60 * 1000,  // Check every minute
    distanceInterval: 30       // Or when moving 30 meters
  });
}
```

2. **Geofence Task** (runs in background):
```javascript
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  const { eventType } = data;
  
  if (eventType === Location.GeofencingEventType.Enter) {
    // User entered work area
    await handleWorkEntry(new Date().toISOString());
  } else if (eventType === Location.GeofencingEventType.Exit) {
    // User exited work area
    await validateAndHandleExit(new Date().toISOString());
  }
});
```

3. **Handle Work Entry**:
```javascript
async function handleWorkEntry(entryTime) {
  // Store entry time
  await AsyncStorage.setItem(KEYS.ENTERED_TIME, entryTime);
  await AsyncStorage.setItem(KEYS.IS_AT_WORK, 'true');
  
  // Send notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🎯 Arrived at Work',
      body: 'Your shift is being tracked...'
    }
  });
  
  // Check after 15 minutes if still at work
  setTimeout(async () => {
    await checkStillAtWork();
  }, 15 * 60 * 1000);
}
```

4. **Handle Work Exit** (with time rounding):
```javascript
async function handleWorkExit(exitTime) {
  const enteredTime = await AsyncStorage.getItem(KEYS.ENTERED_TIME);
  
  // Apply time rounding
  const roundedStart = roundEntryTime(enteredTime);
  const roundedEnd = roundExitTime(exitTime);
  
  const durationMinutes = Math.floor(
    (roundedEnd - roundedStart) / (1000 * 60)
  );
  
  // Create shift data
  const shiftData = {
    startTime: roundedStart.toISOString(),
    endTime: roundedEnd.toISOString(),
    durationMinutes,
    date: format(roundedStart, 'yyyy-MM-dd'),
    wasRounded: true
  };
  
  // Add to pending shifts (requires user confirmation)
  const pending = await this.getPendingShifts();
  pending.push(shiftData);
  await AsyncStorage.setItem(KEYS.PENDING_SHIFTS, JSON.stringify(pending));
  
  // Send notification to confirm
  await sendShiftConfirmationNotification(shiftData);
  
  // Clear work state
  await clearWorkState();
}
```

5. **Get Pending Shifts**:
```javascript
async getPendingShifts() {
  const pendingStr = await AsyncStorage.getItem(KEYS.PENDING_SHIFTS);
  return pendingStr ? JSON.parse(pendingStr) : [];
}
```

---

### 3. Time Rounding Utils (`services/timeRoundingUtils.js`)

**Purpose**: Round times to nearest 15-minute intervals for fair time tracking.

**Rounding Rules**:
- **0-15 minutes** → Round down to hour (9:05 → 9:00)
- **16-45 minutes** → Round to half hour (9:20 → 9:30)
- **46-60 minutes** → Round up to next hour (9:50 → 10:00)

**Code**:
```javascript
export function roundTime(date) {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  
  if (minutes <= 15) {
    // Round down to hour
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

export function roundEntryTime(dateTime) {
  // Entry time: round down (favor employee)
  return roundTime(dateTime);
}

export function roundExitTime(dateTime) {
  // Exit time: round up (favor employee)
  return roundTime(dateTime);
}

export function calculateRoundedDuration(startTime, endTime) {
  const roundedStart = roundEntryTime(startTime);
  const roundedEnd = roundExitTime(endTime);
  
  const durationMs = roundedEnd - roundedStart;
  return Math.floor(durationMs / (1000 * 60)); // Convert to minutes
}
```

**Example**:
- Employee arrives at **9:07 AM** → Rounds to **9:00 AM**
- Employee leaves at **5:52 PM** → Rounds to **6:00 PM**
- Total time: **9 hours** (instead of 8h 45m)

---

### 4. Analytics Service (`services/analyticsService.js`)

**Purpose**: Calculate statistics, insights, and analytics from shift data.

**Key Functions**:

#### Calculate Total Hours
```javascript
calculateTotalHours(shifts) {
  return shifts.reduce(
    (total, shift) => total + (shift.duration_minutes || 0), 
    0
  ) / 60; // Convert minutes to hours
}
```

#### Calculate Earnings
```javascript
calculateEarnings(shifts, hourlyRate) {
  const totalHours = this.calculateTotalHours(shifts);
  return totalHours * hourlyRate;
}
```

#### Get Weekly Stats
```javascript
getWeeklyStats(shifts, hourlyRate) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  
  // Filter shifts for this week
  const weekShifts = shifts.filter(shift => {
    const shiftDate = parseISO(shift.date);
    return shiftDate >= weekStart && shiftDate <= weekEnd;
  });
  
  return {
    hours: this.calculateTotalHours(weekShifts),
    earnings: this.calculateEarnings(weekShifts, hourlyRate),
    daysWorked: new Set(weekShifts.map(s => s.date)).size,
    shifts: weekShifts.length
  };
}
```

#### Calculate Streak
```javascript
calculateStreak(shifts) {
  // Sort dates in descending order
  const sortedDates = [...new Set(shifts.map(s => s.date))]
    .sort()
    .reverse();
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  // Count consecutive days from today backwards
  for (const dateStr of sortedDates) {
    const shiftDate = parseISO(dateStr);
    shiftDate.setHours(0, 0, 0, 0);
    const daysDiff = differenceInDays(currentDate, shiftDate);
    
    if (daysDiff === 0 || daysDiff === 1) {
      streak++;
      currentDate = shiftDate;
    } else {
      break; // Streak broken
    }
  }
  
  return streak;
}
```

#### Predict Work Pattern
```javascript
predictWorkPattern(shifts) {
  const dayFrequency = {};
  const timeFrequency = {};
  
  shifts.forEach(shift => {
    const date = parseISO(shift.date);
    const dayOfWeek = getDay(date); // 0-6 (Sunday-Saturday)
    const startTime = parseISO(shift.start_time);
    const hour = startTime.getHours(); // 0-23
    
    dayFrequency[dayOfWeek] = (dayFrequency[dayOfWeek] || 0) + 1;
    timeFrequency[hour] = (timeFrequency[hour] || 0) + 1;
  });
  
  // Find most common day
  const mostCommonDay = Object.entries(dayFrequency)
    .reduce((a, b) => b[1] > a[1] ? b : a)[0];
  
  // Find most common hour
  const mostCommonHour = Object.entries(timeFrequency)
    .reduce((a, b) => b[1] > a[1] ? b : a)[0];
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 
                   'Thursday', 'Friday', 'Saturday'];
  
  return {
    mostCommonDay: dayNames[mostCommonDay],
    mostCommonHour: parseInt(mostCommonHour)
  };
}
```

#### Project Monthly Earnings
```javascript
projectMonthlyEarnings(shifts, hourlyRate) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const daysInMonth = endOfMonth(now).getDate();
  const daysPassed = now.getDate();
  
  // Get shifts this month
  const monthShifts = shifts.filter(shift => {
    const shiftDate = parseISO(shift.date);
    return shiftDate >= monthStart;
  });
  
  const currentEarnings = this.calculateEarnings(monthShifts, hourlyRate);
  const avgDailyEarnings = currentEarnings / daysPassed;
  const projectedTotal = avgDailyEarnings * daysInMonth;
  
  return {
    current: currentEarnings,
    projected: projectedTotal,
    daysRemaining: daysInMonth - daysPassed
  };
}
```

---

### 5. Notification Service (`services/notificationService.js`)

**Purpose**: Send push notifications to the user.

**Key Functions**:

#### Request Permissions
```javascript
async requestPermissions() {
  const { status } = await Notifications.getPermissionsAsync();
  
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === 'granted';
  }
  
  return true;
}
```

#### Send Shift Confirmation
```javascript
async sendShiftConfirmation(shiftData) {
  const start = new Date(shiftData.startTime);
  const end = new Date(shiftData.endTime);
  const hours = Math.floor(shiftData.durationMinutes / 60);
  const minutes = shiftData.durationMinutes % 60;
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🎯 Work Shift Detected',
      body: `Did you work from ${format(start, 'h:mm a')} to ${format(end, 'h:mm a')} (${hours}h ${minutes}m)?`,
      data: { shiftData, type: 'shift_confirmation' }
    }
  });
}
```

---

## Key Features

### 1. Automatic Time Tracking
- **Geofencing**: Detects when you enter/exit work area
- **Background Processing**: Works even when app is closed
- **iOS-Specific**: Uses background location updates for reliable exit detection

### 2. Time Rounding
- **Fair Rounding**: Rounds to nearest 15-minute intervals
- **Employee-Friendly**: Rounds entry down, exit up
- **Configurable**: Can be adjusted in `timeRoundingUtils.js`

### 3. Pending Shift Confirmation
- **User Review**: All shifts require confirmation before saving
- **Edit Capability**: Adjust times if incorrect
- **Delete Option**: Remove false positives

### 4. Analytics & Insights
- **Multiple Time Periods**: Week, month, all-time, custom range
- **Visual Charts**: Line charts showing hours worked
- **Earnings Projections**: Predict monthly earnings
- **Pattern Recognition**: Identifies work habits

### 5. Offline Support
- **Local Storage**: Shifts stored locally first
- **Sync Queue**: Queues shifts when offline
- **Auto-Sync**: Syncs when connection restored

---

## How It All Works Together

### Complete Flow Example: User Works a Shift

1. **User Opens App** (`HomeScreen`)
   - App loads user settings from Supabase
   - Checks if geofencing is active
   - Displays current status

2. **User Starts Tracking** (`HomeScreen`)
   - Clicks "Start Tracking"
   - `GeofencingService.startGeofencing()` is called
   - App requests location permissions
   - Geofence region is registered
   - Background location updates start

3. **User Arrives at Work**
   - Device GPS detects entry into geofence
   - `GEOFENCE_TASK` fires with `Enter` event
   - `handleWorkEntry()` runs:
     - Stores entry time in AsyncStorage
     - Sets `is_at_work = true`
     - Sends notification: "Arrived at Work"
     - Schedules 15-minute confirmation check

4. **15 Minutes Later**
   - `checkStillAtWork()` runs
   - Verifies user is still within geofence
   - Confirms shift is valid
   - Updates `current_shift` status

5. **User Leaves Work**
   - Device GPS detects exit from geofence
   - `GEOFENCE_TASK` fires with `Exit` event
   - `handleWorkExit()` runs:
     - Gets entry time from AsyncStorage
     - Applies time rounding:
       - Entry: 9:07 AM → 9:00 AM
       - Exit: 5:52 PM → 6:00 PM
     - Calculates duration: 9 hours
     - Creates shift data object
     - Adds to `pending_shifts` array
     - Sends notification: "Shift Completed - Confirm?"
     - Clears work state

6. **User Confirms Shift** (`HomeScreen`)
   - Sees pending shift in "Pending Confirmations"
   - Clicks ✓ to confirm
   - `confirmShift()` runs:
     - Calls `WorkShiftService.createShift()`
     - Saves to Supabase `work_shifts` table
     - Removes from pending list
     - Shows success message

7. **User Views Insights** (`InsightsScreen`)
   - Loads all shifts from database
   - Calls `AnalyticsService.getInsightsSummary()`
   - Calculates:
     - Total hours worked
     - Total earnings
     - Work patterns
     - Streaks
   - Displays charts and statistics

### Data Flow Diagram

```
User Action
    ↓
Screen Component
    ↓
Service Layer (geofencingService, supabase, etc.)
    ↓
AsyncStorage (local) OR Supabase (cloud)
    ↓
Background Task (geofencing)
    ↓
Notification Service
    ↓
User Notification
```

---

## Important Concepts for Beginners

### 1. React Native Basics
- **Components**: Reusable UI pieces (like `HomeScreen`, `HistoryScreen`)
- **State**: Data that changes (like `isTracking`, `shifts`)
- **Props**: Data passed between components
- **Hooks**: Functions like `useState`, `useEffect` for managing state

### 2. Async/Await
- **Async Functions**: Functions that can wait for operations to complete
- **Await**: Waits for a promise to resolve before continuing
- **Example**:
```javascript
async function loadData() {
  const data = await fetchDataFromAPI(); // Wait for API
  setData(data); // Then use the data
}
```

### 3. AsyncStorage
- **Local Storage**: Stores data on the device
- **Key-Value Pairs**: Like a dictionary
- **Async**: All operations are asynchronous
- **Example**:
```javascript
// Save
await AsyncStorage.setItem('key', 'value');

// Load
const value = await AsyncStorage.getItem('key');
```

### 4. Database Operations (Supabase)
- **CRUD**: Create, Read, Update, Delete
- **Queries**: Filter and sort data
- **Example**:
```javascript
// Create (Insert)
await supabase.from('table').insert([{ field: 'value' }]);

// Read (Select)
await supabase.from('table').select('*').eq('user_id', userId);

// Update
await supabase.from('table').update({ field: 'new value' }).eq('id', id);

// Delete
await supabase.from('table').delete().eq('id', id);
```

### 5. Background Tasks
- **Task Manager**: Runs code even when app is closed
- **Geofencing Task**: Triggers on enter/exit events
- **Location Task**: Periodically checks location
- **Example**:
```javascript
TaskManager.defineTask('MY_TASK', async ({ data }) => {
  // This code runs in the background
  console.log('Background task running!');
});
```

---

## Common Patterns

### 1. Loading Data on Screen Focus
```javascript
useEffect(() => {
  if (isFocused) {
    loadData(); // Reload when screen is focused
  }
}, [isFocused]);
```

### 2. Error Handling
```javascript
try {
  await someAsyncOperation();
  Alert.alert('Success', 'Operation completed!');
} catch (error) {
  console.error('Error:', error);
  Alert.alert('Error', 'Something went wrong');
}
```

### 3. Conditional Rendering
```javascript
{isTracking ? (
  <Text>Tracking Active</Text>
) : (
  <Text>Tracking Inactive</Text>
)}
```

### 4. Formatting Dates
```javascript
import { format, parseISO } from 'date-fns';

const date = parseISO('2024-01-15T09:00:00');
const formatted = format(date, 'MMM dd, yyyy h:mm a');
// Result: "Jan 15, 2024 9:00 AM"
```

---

## Testing the App

### Development Setup
1. Install dependencies: `npm install`
2. Start Expo: `npm start`
3. Run on device: `npm run ios` or `npm run android`

### Testing Geofencing
1. Set work location in Settings
2. Start tracking
3. Physically move to/from work location
4. Check notifications and pending shifts

### Testing Offline
1. Turn off WiFi/cellular
2. Create a shift
3. Turn connection back on
4. Verify shift syncs to database

---

## Future Enhancements

Potential improvements:
- **Multi-location support**: Track multiple work locations
- **Break time tracking**: Deduct break times from shifts
- **Export reports**: PDF/CSV export of work history
- **Calendar integration**: Sync with device calendar
- **Team features**: Shared work schedules
- **Wearable support**: Apple Watch/Android Wear integration

---

## Conclusion

This Work Time Tracker app demonstrates:
- **React Native** development
- **Location services** and geofencing
- **Background tasks** and notifications
- **Database operations** with Supabase
- **Data analytics** and visualization
- **Offline-first** architecture

The app is designed to be user-friendly while handling complex location tracking in the background. All code is well-organized into services for maintainability and reusability.

---

## Additional Resources

- **React Native Docs**: https://reactnative.dev/docs/getting-started
- **Expo Docs**: https://docs.expo.dev/
- **Supabase Docs**: https://supabase.com/docs
- **date-fns Docs**: https://date-fns.org/
- **React Navigation**: https://reactnavigation.org/

---

*This documentation was generated to help beginners understand the complete project structure and functionality.*

