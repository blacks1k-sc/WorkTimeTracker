import 'react-native-get-random-values';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, Text} from 'react-native';
import Colors from './theme/colors';

// Screens
import HomeScreen from './screens/HomeScreen';
import HistoryScreen from './screens/HistoryScreen';
import InsightsScreen from './screens/InsightsScreen';
import SettingsScreen from './screens/SettingsScreen';
import EditShiftScreen from './screens/EditShiftScreen';
import PaymentsMainScreen from './screens/PaymentsMainScreen';
import AddPaymentScreen from './screens/AddPaymentScreen';
import ViewPaymentsScreen from './screens/ViewPaymentsScreen';
console.log('HistoryScreen import:', HistoryScreen);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          height: Platform.OS === 'ios' ? 80 : 60,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🏠</Text>,
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📅</Text>,
          headerStyle: {
            backgroundColor: Colors.card,
            borderBottomColor: Colors.border,
            borderBottomWidth: 1,
          },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
            color: Colors.textPrimary,
          },
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📊</Text>,
          headerStyle: {
            backgroundColor: Colors.card,
            borderBottomColor: Colors.border,
            borderBottomWidth: 1,
          },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
            color: Colors.textPrimary,
          },
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>⚙️</Text>,
          headerStyle: {
            backgroundColor: Colors.card,
            borderBottomColor: Colors.border,
            borderBottomWidth: 1,
          },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
            color: Colors.textPrimary,
          },
        }}
      />
    </Tab.Navigator>
  );
}

// Main App
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditShift"
          component={EditShiftScreen}
          options={{
            title: 'Edit Shift',
            headerStyle: {
              backgroundColor: Colors.card,
              borderBottomColor: Colors.border,
              borderBottomWidth: 1,
            },
            headerTintColor: Colors.textPrimary,
            headerTitleStyle: {
              fontWeight: 'bold',
              color: Colors.textPrimary,
            },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="Payments"
          component={PaymentsMainScreen}
          options={{
            title: 'Payments',
            headerStyle: {
              backgroundColor: Colors.card,
              borderBottomColor: Colors.border,
              borderBottomWidth: 1,
            },
            headerTintColor: Colors.textPrimary,
            headerTitleStyle: {
              fontWeight: 'bold',
              color: Colors.textPrimary,
            },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="AddPayment"
          component={AddPaymentScreen}
          options={{
            title: 'Add Payment',
            headerStyle: {
              backgroundColor: Colors.card,
              borderBottomColor: Colors.border,
              borderBottomWidth: 1,
            },
            headerTintColor: Colors.textPrimary,
            headerTitleStyle: {
              fontWeight: 'bold',
              color: Colors.textPrimary,
            },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="ViewPayments"
          component={ViewPaymentsScreen}
          options={{
            title: 'View Payments',
            headerStyle: {
              backgroundColor: Colors.card,
              borderBottomColor: Colors.border,
              borderBottomWidth: 1,
            },
            headerTintColor: Colors.textPrimary,
            headerTitleStyle: {
              fontWeight: 'bold',
              color: Colors.textPrimary,
            },
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}