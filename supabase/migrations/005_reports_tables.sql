-- Migration: 005_reports_tables
-- Description: Create tables for SEO actions log and score history

-- SEO Actions Log Table
CREATE TABLE IF NOT EXISTS seo_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'create_post', 'respond_review', 'update_profile', 'upload_photo', etc.
  action_data JSONB DEFAULT '{}',
  ai_generated BOOLEAN DEFAULT false,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  result TEXT DEFAULT 'pending', -- 'success', 'failed', 'pending'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Score History Table
CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  overall_score INTEGER,
  score_breakdown JSONB DEFAULT '{}',
  status TEXT, -- 'excellent', 'good', 'needs_work', 'poor'
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_seo_actions_business_id ON seo_actions(business_id);
CREATE INDEX IF NOT EXISTS idx_seo_actions_user_id ON seo_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_actions_performed_at ON seo_actions(performed_at);
CREATE INDEX IF NOT EXISTS idx_seo_actions_action_type ON seo_actions(action_type);

CREATE INDEX IF NOT EXISTS idx_score_history_business_id ON score_history(business_id);
CREATE INDEX IF NOT EXISTS idx_score_history_user_id ON score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_score_history_recorded_at ON score_history(recorded_at);

-- Enable RLS
ALTER TABLE seo_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seo_actions
-- Users can view their own actions
CREATE POLICY "Users can view own seo_actions"
  ON seo_actions FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own actions
CREATE POLICY "Users can insert own seo_actions"
  ON seo_actions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all actions
CREATE POLICY "Admins can view all seo_actions"
  ON seo_actions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Allow service role full access
CREATE POLICY "Service role full access to seo_actions"
  ON seo_actions FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for score_history
-- Users can view their own score history
CREATE POLICY "Users can view own score_history"
  ON score_history FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own score history
CREATE POLICY "Users can insert own score_history"
  ON score_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all score history
CREATE POLICY "Admins can view all score_history"
  ON score_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Allow service role full access
CREATE POLICY "Service role full access to score_history"
  ON score_history FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON seo_actions TO authenticated;
GRANT ALL ON score_history TO authenticated;

