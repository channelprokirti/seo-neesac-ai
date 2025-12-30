import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getSupabaseCredentials(request: NextRequest) {
  // Try environment variables first
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  
  // Try from cookie (set by client before redirect)
  const cookieStore = await cookies();
  const configCookie = cookieStore.get('supabase-config');
  if (configCookie?.value) {
    try {
      return JSON.parse(decodeURIComponent(configCookie.value));
    } catch (e) {
      console.error('Failed to parse supabase-config cookie:', e);
    }
  }
  
  return { url: '', anonKey: '' };
}

export async function GET(request: NextRequest) {
  console.log('=== Google OAuth Route ===');
  const { url, anonKey } = await getSupabaseCredentials(request);
  console.log('Supabase credentials:', { url: url ? 'set' : 'MISSING', anonKey: anonKey ? 'set' : 'MISSING' });
  
  if (!url || !anonKey) {
    console.log('ERROR: Supabase not configured');
    return NextResponse.redirect(new URL('/settings?error=supabase_not_configured', request.url));
  }

  const supabase = createClient(url, anonKey);

  // Get GBP OAuth config from admin settings
  const { data: gbpSettings, error: gbpError } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'gbp_oauth')
    .single();

  console.log('GBP Settings query:', { gbpSettings, gbpError });

  if (!gbpSettings?.value) {
    console.log('ERROR: GBP not configured (no settings)');
    return NextResponse.redirect(new URL('/settings?error=gbp_not_configured', request.url));
  }

  const config = gbpSettings.value as { client_id: string; client_secret: string };
  console.log('GBP Config:', { hasClientId: !!config.client_id, hasClientSecret: !!config.client_secret });

  if (!config.client_id) {
    console.log('ERROR: GBP not configured (no client_id)');
    return NextResponse.redirect(new URL('/settings?error=gbp_not_configured', request.url));
  }

  // Build OAuth URL
  const redirectUri = `${new URL(request.url).origin}/api/auth/google/callback`;
  const scope = [
    'https://www.googleapis.com/auth/business.manage',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', config.client_id);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('SUCCESS: Redirecting to Google OAuth:', authUrl.toString().substring(0, 100) + '...');
  return NextResponse.redirect(authUrl.toString());
}


