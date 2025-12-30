export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'client';
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  ai_config?: AIConfig;
  created_at: string;
}

export interface ConnectedGBP {
  id: string;
  user_id: string;
  google_account_id: string;
  google_email?: string;
  account_name?: string;
  location_name?: string;
  location_id?: string;
  place_id?: string;
  gbp_data?: Record<string, unknown>;
  audit_score?: number;
  last_audit_at?: string;
  last_synced_at?: string;
  created_at: string;
}

export interface AdminSettings {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updated_by?: string;
  updated_at: string;
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  website?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
  };
  categories?: string[];
  google_place_id?: string;
  gbp_connected?: boolean;
  gbp_location_id?: string;
  gbp_data?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface Location {
  id: string;
  business_id: string;
  gbp_place_id?: string;
  gbp_data?: Record<string, unknown>;
  audit_score?: number;
  created_at: string;
}

export interface Citation {
  id: string;
  business_id: string;
  directory_name: string;
  url?: string;
  status: 'found' | 'not_found' | 'pending' | 'claimed';
  nap_data?: {
    name?: string;
    address?: string;
    phone?: string;
  };
  is_consistent: boolean;
  created_at: string;
}

export interface Keyword {
  id: string;
  business_id: string;
  keyword: string;
  location_modifier?: string;
  search_volume?: number;
  difficulty?: number;
  created_at: string;
}

export interface Ranking {
  id: string;
  keyword_id: string;
  tracked_date: string;
  local_pack_position?: number;
  organic_position?: number;
  serp_features?: string[];
  created_at: string;
}

export interface GBPAudit {
  id: string;
  business_id: string;
  location_id?: string;
  audit_data: Record<string, unknown>;
  score: number;
  recommendations: string[];
  created_at: string;
}

export interface ContentPost {
  id: string;
  business_id: string;
  type: 'gbp_post' | 'blog' | 'social';
  title?: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_at?: string;
  created_at: string;
}

export interface OnPageAudit {
  id: string;
  business_id: string;
  page_url: string;
  audit_results: Record<string, unknown>;
  score: number;
  audited_at: string;
  created_at: string;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface GoogleConfig {
  placesApiKey?: string;
  searchConsoleCredentials?: string;
}

export interface SeoApiConfig {
  dataForSeoLogin?: string;
  dataForSeoPassword?: string;
  serpApiKey?: string;
}

export interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  ai?: AIConfig;
  google?: GoogleConfig;
  seoApi?: SeoApiConfig;
}

