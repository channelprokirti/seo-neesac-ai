import { createBrowserClient } from '@supabase/ssr';

function getSupabaseCredentials() {
  // Check env vars first
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  
  // Then check localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('localseo-supabase');
      if (stored) {
        const config = JSON.parse(stored);
        return { url: config.url, anonKey: config.anonKey };
      }
    } catch (e) {
      console.error('Failed to parse stored config:', e);
    }
  }
  
  return { url: '', anonKey: '' };
}

export function createClient() {
  const { url, anonKey } = getSupabaseCredentials();
  
  if (!url || !anonKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createBrowserClient(url, anonKey);
}





