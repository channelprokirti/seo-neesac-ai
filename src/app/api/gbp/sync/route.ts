import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, createBrowserClient } from '@supabase/ssr';

function getSupabaseCredentials() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  return { url: '', anonKey: '' };
}

async function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { gbpId } = await request.json();
    const { url, anonKey } = getSupabaseCredentials();

    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 400 });
    }

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

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get connected GBP
    const { data: gbpConnection } = await supabase
      .from('connected_gbp')
      .select('*')
      .eq('id', gbpId)
      .eq('user_id', user.id)
      .single();

    if (!gbpConnection) {
      return NextResponse.json({ error: 'GBP connection not found' }, { status: 404 });
    }

    // Get OAuth config
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'gbp_oauth')
      .single();

    if (!settings?.value) {
      return NextResponse.json({ error: 'OAuth not configured' }, { status: 400 });
    }

    const config = settings.value as { client_id: string; client_secret: string };
    let accessToken = gbpConnection.access_token;

    // Check if token needs refresh
    if (new Date(gbpConnection.token_expires_at) < new Date()) {
      const newTokens = await refreshAccessToken(
        gbpConnection.refresh_token,
        config.client_id,
        config.client_secret
      );

      if (newTokens.error) {
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 400 });
      }

      accessToken = newTokens.access_token;

      // Update stored tokens
      await supabase
        .from('connected_gbp')
        .update({
          access_token: newTokens.access_token,
          token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq('id', gbpId);
    }

    // Fetch GBP data
    let gbpData: Record<string, unknown> = {};
    let auditScore = 0;

    // If we have a place_id, use Places API for public data
    if (gbpConnection.place_id) {
      const googleConfig = request.headers.get('x-google-config');
      let placesApiKey = '';

      if (googleConfig) {
        try {
          const parsed = JSON.parse(googleConfig);
          placesApiKey = parsed.placesApiKey;
        } catch {}
      }

      // Check user's localStorage config (passed in body)
      if (!placesApiKey) {
        const { placesApiKey: bodyKey } = await request.json().catch(() => ({}));
        placesApiKey = bodyKey || '';
      }

      if (placesApiKey) {
        const placeResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${gbpConnection.place_id}&fields=name,formatted_address,international_phone_number,website,photos,rating,user_ratings_total,opening_hours,business_status&key=${placesApiKey}`
        );
        const placeData = await placeResponse.json();

        if (placeData.status === 'OK') {
          const place = placeData.result;
          gbpData = {
            name: place.name,
            address: place.formatted_address,
            phone: place.international_phone_number,
            website: place.website,
            rating: place.rating,
            reviewCount: place.user_ratings_total,
            photoCount: place.photos?.length || 0,
            hasHours: !!place.opening_hours,
            isOperational: place.business_status === 'OPERATIONAL',
          };

          // Calculate audit score
          let score = 0;
          if (place.name) score += 10;
          if (place.formatted_address) score += 10;
          if (place.international_phone_number) score += 10;
          if (place.website) score += 10;
          if (place.photos?.length >= 10) score += 15;
          else if (place.photos?.length >= 5) score += 10;
          else if (place.photos?.length > 0) score += 5;
          if (place.rating >= 4.0) score += 15;
          else if (place.rating >= 3.5) score += 10;
          else if (place.rating > 0) score += 5;
          if (place.user_ratings_total >= 50) score += 15;
          else if (place.user_ratings_total >= 10) score += 10;
          else if (place.user_ratings_total > 0) score += 5;
          if (place.opening_hours) score += 10;
          if (place.business_status === 'OPERATIONAL') score += 5;

          auditScore = score;
        }
      }
    }

    // Fetch from GBP API using OAuth token
    if (gbpConnection.location_id) {
      const locationResponse = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpConnection.location_id}?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,categories`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (locationResponse.ok) {
        const locationData = await locationResponse.json();
        gbpData = {
          ...gbpData,
          title: locationData.title,
          categories: locationData.categories?.primaryCategory?.displayName,
          hasRegularHours: !!locationData.regularHours,
        };
      }
    }

    // Update connected_gbp record
    await supabase
      .from('connected_gbp')
      .update({
        gbp_data: gbpData,
        audit_score: auditScore,
        last_audit_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', gbpId);

    return NextResponse.json({
      success: true,
      gbpData,
      auditScore,
    });
  } catch (error) {
    console.error('GBP sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync GBP data' },
      { status: 500 }
    );
  }
}





