import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

async function getSupabaseCredentials() {
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
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/settings?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=no_code', request.url));
  }

  const { url, anonKey } = await getSupabaseCredentials();

  if (!url || !anonKey) {
    return NextResponse.redirect(new URL('/settings?error=supabase_not_configured', request.url));
  }

  // Get current user
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Get GBP OAuth config
  const adminSupabase = createClient(url, anonKey);
  const { data: gbpSettings } = await adminSupabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'gbp_oauth')
    .single();

  if (!gbpSettings?.value) {
    return NextResponse.redirect(new URL('/settings?error=gbp_not_configured', request.url));
  }

  const config = gbpSettings.value as { client_id: string; client_secret: string };
  const redirectUri = `${new URL(request.url).origin}/api/auth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokens);
      return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url));
    }

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    // Get GBP accounts
    const accountsResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const accountsData = await accountsResponse.json();

    if (!accountsResponse.ok || !accountsData.accounts?.length) {
      // No GBP accounts found
      return NextResponse.redirect(new URL('/settings?error=no_gbp_accounts', request.url));
    }

    // Process ALL accounts and ALL locations with pagination
    const allLocations: Array<{ account: unknown; location: unknown }> = [];
    
    console.log(`Processing ${accountsData.accounts.length} GBP account(s)`);
    
    for (const account of accountsData.accounts) {
      console.log(`Fetching locations for account: ${account.name}`);
      
      // Fetch locations with pagination support
      let nextPageToken: string | null = null;
      let pageCount = 0;
      const maxPages = 50; // Safety limit (50 pages * 100 = 5000 max locations)
      
      do {
        const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`);
        url.searchParams.set('readMask', 'name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,categories,metadata');
        url.searchParams.set('pageSize', '100'); // Max allowed per request
        if (nextPageToken) {
          url.searchParams.set('pageToken', nextPageToken);
        }
        
        const locationsResponse = await fetch(url.toString(), { 
          headers: { Authorization: `Bearer ${tokens.access_token}` } 
        });
        
        if (!locationsResponse.ok) {
          console.error(`Failed to fetch locations for account ${account.name}:`, await locationsResponse.text());
          break;
        }
        
        const locationsData = await locationsResponse.json();
        pageCount++;
        
        const pageLocations = locationsData.locations || [];
        console.log(`  Page ${pageCount}: fetched ${pageLocations.length} locations`);
        
        // Add locations with their account reference
        for (const location of pageLocations) {
          allLocations.push({ account, location });
        }
        
        nextPageToken = locationsData.nextPageToken || null;
      } while (nextPageToken && pageCount < maxPages);
      
      console.log(`  Account total: ${allLocations.length} locations so far`);
    }

    console.log(`=== TOTAL: Found ${allLocations.length} locations across ${accountsData.accounts.length} account(s) ===`);

    // Process all locations
    for (const { account, location } of allLocations) {
      const accountData = account as { name: string; accountName?: string };
      const locationData = location as { 
        metadata?: { placeId?: string }; 
        storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string; regionCode?: string; postalCode?: string };
        title?: string;
        name?: string;
        phoneNumbers?: { primaryPhone?: string };
        websiteUri?: string;
        categories?: { primaryCategory?: { displayName?: string }; additionalCategories?: Array<{ displayName?: string }> };
      };
      
      const placeId = locationData?.metadata?.placeId;
      const address = locationData?.storefrontAddress;
      
      // Store connected GBP info
      await supabase.from('connected_gbp').upsert({
        user_id: user.id,
        google_account_id: userInfo.id,
        google_email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        account_name: accountData.accountName || accountData.name,
        gbp_account_name: accountData.name, // Resource name like "accounts/123456789"
        location_name: locationData?.title || 'Unknown Location',
        location_id: locationData?.name,
        place_id: placeId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,location_id',
      });

      // Also create/update entry in businesses table
      if (locationData?.title) {
        // Extract all categories (primary + additional)
        const categories: string[] = [];
        if (locationData?.categories?.primaryCategory?.displayName) {
          categories.push(locationData.categories.primaryCategory.displayName);
        }
        if (locationData?.categories?.additionalCategories) {
          for (const cat of locationData.categories.additionalCategories) {
            if (cat.displayName) {
              categories.push(cat.displayName);
            }
          }
        }

        const businessData = {
          user_id: user.id,
          name: locationData.title,
          google_place_id: placeId || null,
          address: {
            street: address?.addressLines?.join(', ') || '',
            city: address?.locality || '',
            state: address?.administrativeArea || '',
            country: address?.regionCode || '',
            postal_code: address?.postalCode || '',
          },
          phone: locationData?.phoneNumbers?.primaryPhone || null,
          website: locationData?.websiteUri || null,
          categories: categories,
          gbp_connected: true,
          gbp_location_id: locationData?.name,
          updated_at: new Date().toISOString(),
        };

        // Check if business with this GBP location already exists
        const { data: existingBusiness } = await supabase
          .from('businesses')
          .select('id')
          .eq('user_id', user.id)
          .eq('gbp_location_id', locationData?.name)
          .single();

        if (existingBusiness) {
          // Update existing
          await supabase
            .from('businesses')
            .update(businessData)
            .eq('id', existingBusiness.id);
        } else {
          // Insert new
          await supabase.from('businesses').insert(businessData);
        }
      }
    }

    const locationCount = allLocations.length;
    return NextResponse.redirect(new URL(`/businesses?success=gbp_connected&count=${locationCount}`, request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/settings?error=oauth_failed', request.url));
  }
}


