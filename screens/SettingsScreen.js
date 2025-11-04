import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested inside plain ScrollViews',
]);

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSettingsService } from '../services/supabase';
import { GeofencingService } from '../services/geofencingService';

const GOOGLE_PLACES_API_KEY = 'AIzaSyAMt7DavYfCkVq-_PeMlPtV1O5lwYIj_68';

export default function SettingsScreen({ navigation }) {
  const [userId, setUserId] = useState(null);
  const [workLocation, setWorkLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null); // ✅ NEW: User's live location
  const [locationLoading, setLocationLoading] = useState(true); // ✅ NEW: Loading state
  const [hourlyRate, setHourlyRate] = useState('');
  const [payday, setPayday] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState('150');
  const [region, setRegion] = useState({
    latitude: 43.7615,
    longitude: -79.4111,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const mapRef = useRef(null);
  const placesRef = useRef(null);
  const locationSubscription = useRef(null); // ✅ NEW: Store location subscription

  useEffect(() => {
    loadSettings();
    startLocationTracking(); // ✅ NEW: Start tracking user location

    // ✅ NEW: Cleanup on unmount
    return () => {
      stopLocationTracking();
    };
  }, []);

  // ✅ NEW: Start tracking user's live location
  const startLocationTracking = async () => {
    try {
      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to show your current location'
        );
        setLocationLoading(false);
        return;
      }

      // Get initial location
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const initialCoords = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
      };

      setCurrentLocation(initialCoords);
      setLocationLoading(false);

      // Set initial region to user's location if no work location is set
      if (!workLocation) {
        setRegion({
          latitude: initialCoords.latitude,
          longitude: initialCoords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }

      // ✅ NEW: Watch position for real-time updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or when user moves 10 meters
        },
        (location) => {
          const newCoords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrentLocation(newCoords);
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setLocationLoading(false);
      Alert.alert('Location Error', 'Failed to get your current location');
    }
  };

  // ✅ NEW: Stop location tracking
  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  // ✅ NEW: Center map on user's current location
  const centerOnCurrentLocation = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else {
      Alert.alert('Location Unavailable', 'Cannot find your current location');
    }
  };

  const loadSettings = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('user_id');
      setUserId(storedUserId);

      if (storedUserId) {
        const settings = await UserSettingsService.getSettings(storedUserId);
        if (settings) {
          if (settings.work_location_lat && settings.work_location_lng) {
            const location = {
              latitude: settings.work_location_lat,
              longitude: settings.work_location_lng,
              address: settings.work_location_address,
            };
            setWorkLocation(location);
            if (placesRef.current) {
              placesRef.current.setAddressText(location.address || '');
            }
            setRegion({
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
          setHourlyRate(settings.hourly_rate?.toString() || '');
          setPayday(settings.payday || '');
          setGeofenceRadius(settings.geofence_radius?.toString() || '150');
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const formatAddress = (components = {}) => {
    const {
      name,
      streetNumber,
      street,
      city,
      district,
      region: state,
      postalCode,
    } = components;

    const parts = [
      name,
      [streetNumber, street].filter(Boolean).join(' ').trim(),
      city || district,
      state,
      postalCode,
    ]
      .map((part) => (part && part.length ? part : null))
      .filter(Boolean);

    return parts.length ? parts.join(', ') : null;
  };

  const reverseGeocodeAddress = async (latitude, longitude) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results?.length) {
        const entry = results[0];
        const formatted =
          formatAddress({
            streetNumber: entry?.streetNumber,
            street: entry?.street,
            city: entry?.city,
            district: entry?.district,
            region: entry?.region,
            postalCode: entry?.postalCode,
          }) || entry?.name;
        return formatted || 'Dropped Pin';
      }
    } catch (err) {
      console.error('Error reverse geocoding location:', err);
    }
    return 'Dropped Pin';
  };

  const handlePlaceSelect = (data, details) => {
    const lat = details?.geometry?.location?.lat;
    const lng = details?.geometry?.location?.lng;
    if (!lat || !lng) return;

    const location = {
      latitude: lat,
      longitude: lng,
      address: details?.formatted_address || data?.description || 'Selected place',
    };

    setWorkLocation(location);
    if (placesRef.current) {
      placesRef.current.setAddressText(location.address || '');
    }
    setRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleMapPress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const address = await reverseGeocodeAddress(latitude, longitude);
    setWorkLocation({
      latitude,
      longitude,
      address,
    });
    if (placesRef.current) {
      placesRef.current.setAddressText(address || '');
    }
  };

  // ✅ NEW: Set current location as work location
  const useCurrentLocationAsWork = async () => {
    if (!currentLocation) {
      Alert.alert('Location Unavailable', 'Cannot find your current location');
      return;
    }

    const address = await reverseGeocodeAddress(
      currentLocation.latitude,
      currentLocation.longitude
    );

    setWorkLocation({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      address,
    });

    if (placesRef.current) {
      placesRef.current.setAddressText(address || '');
    }

    Alert.alert('Success', 'Current location set as work location');
  };

  const saveSettings = async () => {
    try {
      if (!workLocation) {
        Alert.alert('Error', 'Please set your work location');
        return;
      }

      const rate = parseFloat(hourlyRate);
      if (isNaN(rate) || rate <= 0) {
        Alert.alert('Error', 'Please enter a valid hourly rate');
        return;
      }

      const radius = parseInt(geofenceRadius);
      if (isNaN(radius) || radius < 50 || radius > 500) {
        Alert.alert('Error', 'Geofence radius must be between 50 and 500 meters');
        return;
      }

      await UserSettingsService.upsertSettings(userId, {
        workLocationLat: workLocation.latitude,
        workLocationLng: workLocation.longitude,
        workLocationAddress: workLocation.address,
        hourlyRate: rate,
        payday: payday,
        geofenceRadius: radius,
        trackingEnabled: true,
      });

      await AsyncStorage.setItem(
        'user_settings',
        JSON.stringify({
          workLocationLat: workLocation.latitude,
          workLocationLng: workLocation.longitude,
          workLocationAddress: workLocation.address,
          hourlyRate: rate,
          geofenceRadius: radius,
        })
      );

      try {
        const isActive = await GeofencingService.isGeofencingActive();

        if (isActive) {
          console.log('Restarting geofencing with updated location...');
          await GeofencingService.stopGeofencing();
        }

        console.log('Starting geofencing with new settings...');
        await GeofencingService.startGeofencing(
          workLocation.latitude,
          workLocation.longitude,
          radius
        );

        console.log('✅ Geofencing active and tracking initialized.');
      } catch (geoError) {
        console.error('⚠️ Failed to start geofencing:', geoError);
        Alert.alert('Tracking Error', 'Failed to activate tracking. Check permissions.');
      }

      Alert.alert('Success', 'Settings saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const handleManualAddressSubmit = async (text) => {
    const query = text?.trim();
    if (!query) {
      return;
    }

    try {
      const results = await Location.geocodeAsync(query);
      if (!results?.length) {
        Alert.alert('Location Not Found', 'Please refine the address and try again.');
        return;
      }

      const { latitude, longitude } = results[0];
      const resolvedAddress = await reverseGeocodeAddress(latitude, longitude);
      const location = {
        latitude,
        longitude,
        address: resolvedAddress || query,
      };

      setWorkLocation(location);
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (err) {
      console.error('Error geocoding manual address:', err);
      Alert.alert('Location Error', 'Could not locate that address. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Work Location</Text>
        <GooglePlacesAutocomplete
          ref={placesRef}
          placeholder="Search for your work location"
          onPress={handlePlaceSelect}
          query={{
            key: GOOGLE_PLACES_API_KEY,
            language: 'en',
            components: 'country:ca',
          }}
          fetchDetails={true}
          debounce={200}
          styles={{
            container: styles.autocompleteContainer,
            textInput: styles.autocompleteInput,
            listView: styles.autocompleteList,
          }}
          enablePoweredByContainer={false}
          predefinedPlaces={[]}
          textInputProps={{
            returnKeyType: 'search',
            onSubmitEditing: ({ nativeEvent }) =>
              handleManualAddressSubmit(nativeEvent?.text),
          }}
        />

        {/* ✅ NEW: Quick action buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={useCurrentLocationAsWork}
            disabled={!currentLocation}
          >
            <Text style={styles.quickActionText}>📍 Use My Location</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={centerOnCurrentLocation}
            disabled={!currentLocation}
          >
            <Text style={styles.quickActionText}>🎯 Center on Me</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          onPress={handleMapPress}
          showsUserLocation={false} // We'll use custom marker
          showsMyLocationButton={false}
        >
          {/* ✅ NEW: Current location marker (blue dot) */}
          {currentLocation && (
            <Marker
              coordinate={currentLocation}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.currentLocationMarker}>
                <View style={styles.currentLocationDot} />
              </View>
            </Marker>
          )}

          {/* Work location marker (red pin) */}
          {workLocation && (
            <>
              <Marker
                coordinate={{
                  latitude: workLocation.latitude,
                  longitude: workLocation.longitude,
                }}
                title="Work Location"
                pinColor="red"
              />
              <Circle
                center={{
                  latitude: workLocation.latitude,
                  longitude: workLocation.longitude,
                }}
                radius={parseInt(geofenceRadius) || 150}
                fillColor="rgba(33, 150, 243, 0.2)"
                strokeColor="rgba(33, 150, 243, 0.8)"
                strokeWidth={2}
              />
            </>
          )}
        </MapView>

        {/* ✅ NEW: Location loading indicator */}
        {locationLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Finding your location...</Text>
          </View>
        )}

        {workLocation && (
          <View style={styles.locationInfo}>
            <Text style={styles.locationText}>📍 {workLocation.address}</Text>
          </View>
        )}

        {/* ✅ NEW: Current location info */}
        {currentLocation && (
          <View style={styles.currentLocationInfo}>
            <View style={styles.currentLocationIndicator} />
            <Text style={styles.currentLocationText}>Your location</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Geofence Radius</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="150"
            value={geofenceRadius}
            onChangeText={setGeofenceRadius}
            keyboardType="numeric"
          />
          <Text style={styles.inputSuffix}>meters</Text>
        </View>
        <Text style={styles.helperText}>Recommended: 100-200m</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hourly Rate</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputPrefix}>$</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            keyboardType="decimal-pad"
          />
          <Text style={styles.inputSuffix}>CAD/hour</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payday (Optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g., 15th of each month"
          value={payday}
          onChangeText={setPayday}
        />
        <Text style={styles.helperText}>When do you get paid?</Text>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
        <Text style={styles.saveButtonText}>Save Settings</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  autocompleteContainer: {
    flex: 0,
  },
  autocompleteInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  autocompleteList: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginTop: 5,
  },
  // ✅ NEW: Quick action buttons
  quickActions: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickActionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  mapContainer: {
    height: 300,
    backgroundColor: '#FFF',
    marginVertical: 8,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  // ✅ NEW: Current location marker styles
  currentLocationMarker: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  // ✅ NEW: Loading overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  locationInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
  },
  // ✅ NEW: Current location indicator
  currentLocationInfo: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  currentLocationIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    marginRight: 6,
  },
  currentLocationText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 50,
  },
  inputPrefix: {
    fontSize: 18,
    color: '#666',
    marginRight: 5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  inputSuffix: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  spacer: {
    height: 40,
  },
});