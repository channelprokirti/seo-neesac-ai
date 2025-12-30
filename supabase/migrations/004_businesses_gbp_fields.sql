-- Add GBP-related columns to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS gbp_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gbp_location_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_businesses_gbp_location_id ON public.businesses(gbp_location_id);
CREATE INDEX IF NOT EXISTS idx_businesses_google_place_id ON public.businesses(google_place_id);

-- Update RLS policies for businesses table to allow users to manage their own businesses
DROP POLICY IF EXISTS "Users can view their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can create their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can update their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can delete their own businesses" ON public.businesses;

CREATE POLICY "Users can view their own businesses" ON public.businesses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own businesses" ON public.businesses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own businesses" ON public.businesses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own businesses" ON public.businesses
    FOR DELETE USING (auth.uid() = user_id);

-- Ensure RLS is enabled
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;




