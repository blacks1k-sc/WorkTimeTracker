import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://fgudprhsqxtaxtsllsxg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZndWRwcmhzcXh0YXh0c2xsc3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2ODQxNTUsImV4cCI6MjA3NzI2MDE1NX0.X1xGi9HwpG4wBItCrcSDnbK4nL5Z21Kcq5Rs2iKL860'; // Replace with your Supabase anon key


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database helper functions
export const WorkShiftService = {
  // Create a work shift
  async createShift(userId, data) {
    const { data: shift, error } = await supabase
      .from('work_shifts')
      .insert([
        {
          user_id: userId,
          start_time: data.startTime,
          end_time: data.endTime,
          duration_minutes: data.durationMinutes,
          date: data.date,
          synced: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return shift;
  },

  // Update a work shift
  async updateShift(shiftId, data) {
    const { data: shift, error } = await supabase
      .from('work_shifts')
      .update({
        start_time: data.startTime,
        end_time: data.endTime,
        duration_minutes: data.durationMinutes,
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw error;
    return shift;
  },

  // Get shifts for a date range
  async getShifts(userId, startDate, endDate) {
    const { data, error } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get all shifts for a user
  async getAllShifts(userId) {
    const { data, error } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Delete a shift
  async deleteShift(shiftId) {
    const { error } = await supabase
      .from('work_shifts')
      .delete()
      .eq('id', shiftId);

    if (error) throw error;
  },
};

export const UserSettingsService = {
  // Get user settings
  async getSettings(userId) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Update or create user settings
  async upsertSettings(userId, settings) {
    const { data, error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          work_location_lat: settings.workLocationLat,
          work_location_lng: settings.workLocationLng,
          work_location_address: settings.workLocationAddress,
          hourly_rate: settings.hourlyRate,
          payday: settings.payday,
          geofence_radius: settings.geofenceRadius || 150,
          tracking_enabled: settings.trackingEnabled,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export const QueueService = {
  // Add shift to queue
  async addToQueue(userId, shiftData) {
    const { data, error } = await supabase
      .from('sync_queue')
      .insert([
        {
          user_id: userId,
          shift_data: shiftData,
          synced: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get unsynced items
  async getUnsyncedItems(userId) {
    const { data, error } = await supabase
      .from('sync_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('synced', false);

    if (error) throw error;
    return data;
  },

  // Mark as synced
  async markAsSynced(queueId) {
    const { error } = await supabase
      .from('sync_queue')
      .update({ synced: true })
      .eq('id', queueId);

    if (error) throw error;
  },

  // Delete synced items
  async deleteSyncedItems(userId) {
    const { error } = await supabase
      .from('sync_queue')
      .delete()
      .eq('user_id', userId)
      .eq('synced', true);

    if (error) throw error;
  },
};