-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    ai_config JSONB DEFAULT '{"provider": "openai", "model": "gpt-4-turbo-preview", "temperature": 0.7}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Businesses table
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    website TEXT,
    phone TEXT,
    address JSONB NOT NULL DEFAULT '{}'::jsonb,
    categories TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Locations table (for multi-location businesses)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT,
    gbp_place_id TEXT,
    gbp_data JSONB,
    audit_score DECIMAL(5,2),
    last_audit_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Directories table (geo-targeted)
CREATE TABLE IF NOT EXISTS public.directories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    country TEXT NOT NULL,
    da_score INTEGER DEFAULT 0,
    submission_type TEXT CHECK (submission_type IN ('free', 'paid', 'freemium')) DEFAULT 'free',
    submission_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Directory regions (for geo-targeting)
CREATE TABLE IF NOT EXISTS public.directory_regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    directory_id UUID NOT NULL REFERENCES public.directories(id) ON DELETE CASCADE,
    country TEXT NOT NULL,
    state TEXT,
    city TEXT,
    UNIQUE(directory_id, country, state, city)
);

-- Directory industries
CREATE TABLE IF NOT EXISTS public.directory_industries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    directory_id UUID NOT NULL REFERENCES public.directories(id) ON DELETE CASCADE,
    industry_category TEXT NOT NULL,
    UNIQUE(directory_id, industry_category)
);

-- Citations table
CREATE TABLE IF NOT EXISTS public.citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    directory_id UUID NOT NULL REFERENCES public.directories(id) ON DELETE CASCADE,
    url TEXT,
    status TEXT CHECK (status IN ('pending', 'submitted', 'live', 'rejected', 'not_found')) DEFAULT 'pending',
    nap_data JSONB,
    is_consistent BOOLEAN DEFAULT false,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Keywords table
CREATE TABLE IF NOT EXISTS public.keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    location_modifier TEXT,
    search_volume INTEGER,
    difficulty DECIMAL(5,2),
    intent TEXT CHECK (intent IN ('informational', 'navigational', 'transactional', 'local')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rankings table
CREATE TABLE IF NOT EXISTS public.rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword_id UUID NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
    tracked_date DATE NOT NULL DEFAULT CURRENT_DATE,
    local_pack_position INTEGER,
    organic_position INTEGER,
    serp_features TEXT[] DEFAULT '{}',
    competitor_positions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GBP Audits table
CREATE TABLE IF NOT EXISTS public.gbp_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    audit_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overall_score DECIMAL(5,2),
    sections JSONB NOT NULL,
    recommendations TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- On-Page Audits table
CREATE TABLE IF NOT EXISTS public.onpage_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    audit_results JSONB NOT NULL,
    score DECIMAL(5,2),
    audited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Posts table
CREATE TABLE IF NOT EXISTS public.content_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('gbp_post', 'location_page', 'service_page', 'faq', 'blog_idea')) NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    status TEXT CHECK (status IN ('draft', 'scheduled', 'published', 'failed')) DEFAULT 'draft',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_business_id ON public.locations(business_id);
CREATE INDEX IF NOT EXISTS idx_citations_business_id ON public.citations(business_id);
CREATE INDEX IF NOT EXISTS idx_citations_directory_id ON public.citations(directory_id);
CREATE INDEX IF NOT EXISTS idx_keywords_business_id ON public.keywords(business_id);
CREATE INDEX IF NOT EXISTS idx_rankings_keyword_id ON public.rankings(keyword_id);
CREATE INDEX IF NOT EXISTS idx_rankings_tracked_date ON public.rankings(tracked_date);
CREATE INDEX IF NOT EXISTS idx_directory_regions_country ON public.directory_regions(country);
CREATE INDEX IF NOT EXISTS idx_directory_regions_city ON public.directory_regions(city);
CREATE INDEX IF NOT EXISTS idx_content_posts_business_id ON public.content_posts(business_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_status ON public.content_posts(status);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onpage_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for businesses
CREATE POLICY "Users can view own businesses" ON public.businesses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own businesses" ON public.businesses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own businesses" ON public.businesses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own businesses" ON public.businesses
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for locations
CREATE POLICY "Users can view own locations" ON public.locations
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert own locations" ON public.locations
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update own locations" ON public.locations
    FOR UPDATE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can delete own locations" ON public.locations
    FOR DELETE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- RLS Policies for citations
CREATE POLICY "Users can view own citations" ON public.citations
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage own citations" ON public.citations
    FOR ALL USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- RLS Policies for keywords
CREATE POLICY "Users can view own keywords" ON public.keywords
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage own keywords" ON public.keywords
    FOR ALL USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- RLS Policies for rankings
CREATE POLICY "Users can view own rankings" ON public.rankings
    FOR SELECT USING (
        keyword_id IN (
            SELECT k.id FROM public.keywords k
            JOIN public.businesses b ON k.business_id = b.id
            WHERE b.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own rankings" ON public.rankings
    FOR ALL USING (
        keyword_id IN (
            SELECT k.id FROM public.keywords k
            JOIN public.businesses b ON k.business_id = b.id
            WHERE b.user_id = auth.uid()
        )
    );

-- RLS Policies for GBP audits
CREATE POLICY "Users can view own gbp_audits" ON public.gbp_audits
    FOR SELECT USING (
        location_id IN (
            SELECT l.id FROM public.locations l
            JOIN public.businesses b ON l.business_id = b.id
            WHERE b.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own gbp_audits" ON public.gbp_audits
    FOR ALL USING (
        location_id IN (
            SELECT l.id FROM public.locations l
            JOIN public.businesses b ON l.business_id = b.id
            WHERE b.user_id = auth.uid()
        )
    );

-- RLS Policies for on-page audits
CREATE POLICY "Users can view own onpage_audits" ON public.onpage_audits
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage own onpage_audits" ON public.onpage_audits
    FOR ALL USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- RLS Policies for content posts
CREATE POLICY "Users can view own content_posts" ON public.content_posts
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage own content_posts" ON public.content_posts
    FOR ALL USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- Directories are public (read-only for users)
ALTER TABLE public.directories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view directories" ON public.directories
    FOR SELECT USING (true);

ALTER TABLE public.directory_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view directory_regions" ON public.directory_regions
    FOR SELECT USING (true);

ALTER TABLE public.directory_industries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view directory_industries" ON public.directory_industries
    FOR SELECT USING (true);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_citations_updated_at BEFORE UPDATE ON public.citations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_posts_updated_at BEFORE UPDATE ON public.content_posts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


