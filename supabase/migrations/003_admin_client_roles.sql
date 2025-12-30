-- Migration: Add admin/client roles and approval workflow
-- Updated to work with existing 'profiles' table
-- Run this in your Supabase SQL Editor

-- Add role column to profiles (admin or client)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'client'));

-- Add status column for approval workflow
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add approval tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Create table for connected Google Business Profiles
CREATE TABLE IF NOT EXISTS connected_gbp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    google_account_id TEXT NOT NULL,
    google_email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    account_name TEXT,
    gbp_account_name TEXT, -- Resource name like "accounts/123456789"
    location_name TEXT,
    location_id TEXT,
    place_id TEXT,
    gbp_data JSONB DEFAULT '{}',
    audit_score INTEGER,
    last_audit_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, location_id)
);

-- Add column if table already exists
ALTER TABLE connected_gbp ADD COLUMN IF NOT EXISTS gbp_account_name TEXT;

-- Add gbp_data column to businesses table to persist synced GBP data
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS gbp_data JSONB DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_connected_gbp_user_id ON connected_gbp(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Create table for admin settings (system-wide config)
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin settings
INSERT INTO admin_settings (key, value) VALUES 
    ('gbp_oauth', '{"client_id": "", "client_secret": ""}'),
    ('default_ai', '{"provider": "openai", "model": "gpt-4o-mini"}')
ON CONFLICT (key) DO NOTHING;

-- RLS Policies for connected_gbp
ALTER TABLE connected_gbp ENABLE ROW LEVEL SECURITY;

-- Users can only see their own connected GBP
CREATE POLICY "Users can view own connected GBP" ON connected_gbp
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connected GBP" ON connected_gbp
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connected GBP" ON connected_gbp
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connected GBP" ON connected_gbp
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for admin_settings
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view/edit admin settings
CREATE POLICY "Admins can view admin settings" ON admin_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update admin settings" ON admin_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert admin settings" ON admin_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Function to set role/status for new users
-- First user becomes admin (auto-approved), others are pending clients
CREATE OR REPLACE FUNCTION set_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is the first user
    IF (SELECT COUNT(*) FROM profiles WHERE id != NEW.id) = 0 THEN
        NEW.role := 'admin';
        NEW.status := 'approved';
    ELSE
        NEW.role := 'client';
        NEW.status := 'pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set role on new profile creation
DROP TRIGGER IF EXISTS trigger_set_user_role ON profiles;
CREATE TRIGGER trigger_set_user_role
    BEFORE INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_new_user_role();
