-- ==========================================
-- Work Time Tracker Database Schema
-- Supabase PostgreSQL
-- ==========================================

-- Drop existing tables if they exist (use carefully!)
-- DROP TABLE IF EXISTS sync_queue CASCADE;
-- DROP TABLE IF EXISTS work_shifts CASCADE;
-- DROP TABLE IF EXISTS user_settings CASCADE;

-- ==========================================
-- Table: user_settings
-- Stores user configuration and preferences
-- ==========================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  work_location_lat DOUBLE PRECISION,
  work_location_lng DOUBLE PRECISION,
  work_location_address TEXT,
  hourly_rate DECIMAL(10, 2),
  payday TEXT,
  geofence_radius INTEGER DEFAULT 150 CHECK (geofence_radius >= 50 AND geofence_radius <= 500),
  tracking_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE user_settings IS 'Stores user settings including work location, hourly rate, and tracking preferences';

-- Add comments to columns
COMMENT ON COLUMN user_settings.user_id IS 'Unique identifier for the user';
COMMENT ON COLUMN user_settings.work_location_lat IS 'Latitude of work location';
COMMENT ON COLUMN user_settings.work_location_lng IS 'Longitude of work location';
COMMENT ON COLUMN user_settings.work_location_address IS 'Formatted address of work location';
COMMENT ON COLUMN user_settings.hourly_rate IS 'User hourly pay rate in CAD';
COMMENT ON COLUMN user_settings.payday IS 'Description of when user gets paid (e.g., "15th of each month")';
COMMENT ON COLUMN user_settings.geofence_radius IS 'Radius of geofence in meters (50-500)';
COMMENT ON COLUMN user_settings.tracking_enabled IS 'Whether automatic tracking is enabled';

-- ==========================================
-- Table: work_shifts
-- Stores completed work shifts
-- ==========================================
CREATE TABLE IF NOT EXISTS work_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  date DATE NOT NULL,
  synced BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: end_time must be after start_time
  CONSTRAINT valid_shift_times CHECK (end_time > start_time)
);

-- Add comment to table
COMMENT ON TABLE work_shifts IS 'Stores all work shifts with start/end times and duration';

-- Add comments to columns
COMMENT ON COLUMN work_shifts.user_id IS 'Reference to the user who worked this shift';
COMMENT ON COLUMN work_shifts.start_time IS 'When the shift started';
COMMENT ON COLUMN work_shifts.end_time IS 'When the shift ended';
COMMENT ON COLUMN work_shifts.duration_minutes IS 'Total duration of shift in minutes';
COMMENT ON COLUMN work_shifts.date IS 'Date of the shift (for grouping/filtering)';
COMMENT ON COLUMN work_shifts.synced IS 'Whether this shift has been synced from offline queue';
COMMENT ON COLUMN work_shifts.notes IS 'Optional notes about the shift';

-- ==========================================
-- Table: sync_queue
-- Stores shifts waiting to be synced
-- ==========================================
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  shift_data JSONB NOT NULL,
  synced BOOLEAN DEFAULT false,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- Add comment to table
COMMENT ON TABLE sync_queue IS 'Queue for offline shifts waiting to be synced to work_shifts table';

-- Add comments to columns
COMMENT ON COLUMN sync_queue.user_id IS 'User who owns this queued shift';
COMMENT ON COLUMN sync_queue.shift_data IS 'JSON data containing shift information';
COMMENT ON COLUMN sync_queue.synced IS 'Whether this item has been successfully synced';
COMMENT ON COLUMN sync_queue.retry_count IS 'Number of sync attempts';
COMMENT ON COLUMN sync_queue.error_message IS 'Last error message if sync failed';
COMMENT ON COLUMN sync_queue.synced_at IS 'When this item was successfully synced';

-- ==========================================
-- Indexes for Performance
-- ==========================================

-- Index on user_id for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_work_shifts_user_id ON work_shifts(user_id);

-- Index on date for date range queries
CREATE INDEX IF NOT EXISTS idx_work_shifts_date ON work_shifts(date);

-- Composite index for user and date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_work_shifts_user_date ON work_shifts(user_id, date DESC);

-- Index for finding unsynced queue items
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_synced ON sync_queue(user_id, synced) WHERE synced = false;

-- Index on user_id in sync_queue
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_id ON sync_queue(user_id);

-- ==========================================
-- Functions and Triggers
-- ==========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_settings
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for work_shifts
DROP TRIGGER IF EXISTS update_work_shifts_updated_at ON work_shifts;
CREATE TRIGGER update_work_shifts_updated_at
    BEFORE UPDATE ON work_shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate shift statistics
CREATE OR REPLACE FUNCTION get_user_shift_stats(p_user_id TEXT, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    total_shifts BIGINT,
    total_hours NUMERIC,
    total_days BIGINT,
    avg_shift_duration NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_shifts,
        ROUND(SUM(duration_minutes) / 60.0, 2) as total_hours,
        COUNT(DISTINCT date)::BIGINT as total_days,
        ROUND(AVG(duration_minutes), 2) as avg_shift_duration
    FROM work_shifts
    WHERE user_id = p_user_id
        AND date >= p_start_date
        AND date <= p_end_date;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can view their own shifts" ON work_shifts;
DROP POLICY IF EXISTS "Users can insert their own shifts" ON work_shifts;
DROP POLICY IF EXISTS "Users can update their own shifts" ON work_shifts;
DROP POLICY IF EXISTS "Users can delete their own shifts" ON work_shifts;
DROP POLICY IF EXISTS "Users can view their own queue items" ON sync_queue;
DROP POLICY IF EXISTS "Users can manage their own queue items" ON sync_queue;

-- Policies for user_settings
CREATE POLICY "Users can view their own settings"
    ON user_settings FOR SELECT
    USING (true); -- For demo purposes; in production, add proper auth check

CREATE POLICY "Users can update their own settings"
    ON user_settings FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can insert their own settings"
    ON user_settings FOR INSERT
    WITH CHECK (true);

-- Policies for work_shifts
CREATE POLICY "Users can view their own shifts"
    ON work_shifts FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own shifts"
    ON work_shifts FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own shifts"
    ON work_shifts FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can delete their own shifts"
    ON work_shifts FOR DELETE
    USING (true);

-- Policies for sync_queue
CREATE POLICY "Users can view their own queue items"
    ON sync_queue FOR SELECT
    USING (true);

CREATE POLICY "Users can manage their own queue items"
    ON sync_queue FOR ALL
    USING (true)
    WITH CHECK (true);

-- ==========================================
-- Sample Data (Optional - for testing)
-- ==========================================

-- Insert a sample user setting (uncomment to use)
/*
INSERT INTO user_settings (user_id, work_location_lat, work_location_lng, work_location_address, hourly_rate, payday, geofence_radius)
VALUES ('test_user_123', 43.7615, -79.4111, '123 Main St, Toronto, ON', 25.00, '15th of each month', 150);
*/

-- Insert sample shifts (uncomment to use)
/*
INSERT INTO work_shifts (user_id, start_time, end_time, duration_minutes, date)
VALUES 
    ('test_user_123', '2025-10-28 09:00:00+00', '2025-10-28 17:00:00+00', 480, '2025-10-28'),
    ('test_user_123', '2025-10-27 08:30:00+00', '2025-10-27 16:30:00+00', 480, '2025-10-27'),
    ('test_user_123', '2025-10-26 09:15:00+00', '2025-10-26 17:45:00+00', 510, '2025-10-26');
*/

-- ==========================================
-- Useful Queries
-- ==========================================

-- Get user shift statistics for current month
/*
SELECT * FROM get_user_shift_stats('test_user_123', DATE_TRUNC('month', CURRENT_DATE)::DATE, CURRENT_DATE);
*/

-- Find shifts for a specific user in date range
/*
SELECT * FROM work_shifts 
WHERE user_id = 'test_user_123' 
    AND date >= '2025-10-01' 
    AND date <= '2025-10-31'
ORDER BY date DESC;
*/

-- Get daily hours worked
/*
SELECT 
    date,
    SUM(duration_minutes) / 60.0 as hours_worked,
    COUNT(*) as shifts_count
FROM work_shifts
WHERE user_id = 'test_user_123'
    AND date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date
ORDER BY date DESC;
*/

-- ==========================================
-- Maintenance Queries
-- ==========================================

-- Clean up old synced queue items (older than 30 days)
/*
DELETE FROM sync_queue 
WHERE synced = true 
    AND synced_at < NOW() - INTERVAL '30 days';
*/

-- Find users with most shifts
/*
SELECT 
    user_id,
    COUNT(*) as total_shifts,
    SUM(duration_minutes) / 60.0 as total_hours
FROM work_shifts
GROUP BY user_id
ORDER BY total_shifts DESC
LIMIT 10;
*/