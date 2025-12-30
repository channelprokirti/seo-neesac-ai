-- Migration: 006_fix_profiles_columns
-- Description: Comprehensive fix for profiles table, RLS policies, and admin settings
-- This migration fixes all issues with user registration, admin approval flow, and GBP OAuth

-- ============================================
-- STEP 1: Add missing columns to profiles table
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add constraints (ignore error if already exist)
DO $$ 
BEGIN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'client'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- STEP 2: Create is_admin() helper function (SECURITY DEFINER to bypass RLS)
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: Update handle_new_user function to set role/status
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_count INTEGER;
    new_role TEXT;
    new_status TEXT;
BEGIN
    -- Check if this is the first user
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    
    IF user_count = 0 THEN
        new_role := 'admin';
        new_status := 'approved';
    ELSE
        new_role := 'client';
        new_status := 'pending';
    END IF;
    
    INSERT INTO public.profiles (id, email, full_name, role, status)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', new_role, new_status);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Fix triggers
-- ============================================
-- Drop the conflicting trigger from migration 003
DROP TRIGGER IF EXISTS trigger_set_user_role ON profiles;

-- Recreate the main trigger for user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 5: Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================
-- STEP 6: Fix RLS policies on PROFILES table
-- ============================================
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Policy: Users can view their own profile OR admins can view all
CREATE POLICY "Users can view own profile or admins can view all"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id  -- User can always see their own profile
    OR is_admin()    -- Admins can see all profiles
  );

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Admins can update all profiles (for approve/reject)
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

-- ============================================
-- STEP 7: Fix RLS policies on ADMIN_SETTINGS table
-- ============================================
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view admin settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins can update admin settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins can insert admin settings" ON admin_settings;
DROP POLICY IF EXISTS "Authenticated users can read admin_settings" ON admin_settings;
DROP POLICY IF EXISTS "Anyone can read admin_settings" ON admin_settings;

-- Allow anyone to read admin_settings (needed for API routes and clients to check OAuth config)
-- Note: Write operations are still restricted to admins
CREATE POLICY "Anyone can read admin_settings" 
  ON admin_settings FOR SELECT
  USING (true);

-- Only admins can update admin settings
CREATE POLICY "Admins can update admin settings" 
  ON admin_settings FOR UPDATE
  USING (is_admin());

-- Only admins can insert admin settings
CREATE POLICY "Admins can insert admin settings" 
  ON admin_settings FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can delete admin settings
CREATE POLICY "Admins can delete admin settings" 
  ON admin_settings FOR DELETE
  USING (is_admin());

-- ============================================
-- STEP 8: Fix RLS policies on SEO_ACTIONS table (if exists)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'seo_actions') THEN
        -- Drop old policy that used non-existent is_admin()
        DROP POLICY IF EXISTS "Admins can view all seo_actions" ON seo_actions;
        
        -- Recreate with proper function
        CREATE POLICY "Admins can view all seo_actions"
          ON seo_actions FOR SELECT
          USING (is_admin());
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- STEP 9: Fix RLS policies on SCORE_HISTORY table (if exists)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'score_history') THEN
        -- Drop old policy that used non-existent is_admin()
        DROP POLICY IF EXISTS "Admins can view all score_history" ON score_history;
        
        -- Recreate with proper function
        CREATE POLICY "Admins can view all score_history"
          ON score_history FOR SELECT
          USING (is_admin());
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- STEP 10: Update existing admin user (if exists without role)
-- ============================================
-- This ensures any user created before this migration gets proper role/status
UPDATE profiles 
SET role = 'admin', status = 'approved' 
WHERE id = (SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1)
  AND (role IS NULL OR role = 'client');

-- Set default status for any profiles without status
UPDATE profiles 
SET status = 'pending' 
WHERE status IS NULL AND role = 'client';

UPDATE profiles 
SET status = 'approved' 
WHERE status IS NULL AND role = 'admin';
