import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

async function getSupabaseFromCookie() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      businessId,
      content,
      title,
      callToAction,
      topicType = 'STANDARD'
    } = body;

    if (!businessId || !content) {
      return NextResponse.json(
        { error: 'Business ID and content are required' },
        { status: 400 }
      );
    }

    const { url, anonKey } = await getSupabaseFromCookie();
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(url, anonKey);

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (!business) {
      return NextResponse.json({ error: 'Business not found', details: businessError }, { status: 404 });
    }

    if (!business.gbp_connected || !business.gbp_location_id) {
      return NextResponse.json({ error: 'Business is not connected to GBP' }, { status: 400 });
    }

    // Get the connected GBP record with tokens
    const { data: gbpConnection, error: gbpError } = await supabase
      .from('connected_gbp')
      .select('*')
      .eq('location_id', business.gbp_location_id)
      .single();

    if (!gbpConnection?.access_token) {
      return NextResponse.json({ 
        error: 'No GBP tokens found. Please reconnect your Google Business Profile.' 
      }, { status: 401 });
    }

    let accessToken = gbpConnection.access_token;
    const locationId = gbpConnection.location_id;
    const accountName = gbpConnection.gbp_account_name;

    // Check if token is expired and refresh if needed
    if (gbpConnection.token_expires_at && new Date(gbpConnection.token_expires_at) < new Date()) {
      console.log('Access token expired, attempting refresh...');
      
      if (!gbpConnection.refresh_token) {
        return NextResponse.json({ 
          error: 'GBP access token expired. Please reconnect your Google Business Profile.',
          needsReconnect: true 
        }, { status: 401 });
      }

      // Get OAuth credentials from admin_settings
      const { data: gbpSettings } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'gbp_oauth')
        .single();

      if (!gbpSettings?.value) {
        return NextResponse.json({ error: 'OAuth credentials not configured' }, { status: 500 });
      }

      const oauthConfig = gbpSettings.value as { client_id: string; client_secret: string };

      // Refresh the access token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: oauthConfig.client_id,
          client_secret: oauthConfig.client_secret,
          refresh_token: gbpConnection.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok || !refreshData.access_token) {
        return NextResponse.json({ 
          error: 'Failed to refresh access token. Please reconnect your Google Business Profile.',
          needsReconnect: true 
        }, { status: 401 });
      }

      accessToken = refreshData.access_token;

      // Save the new token
      await supabase
        .from('connected_gbp')
        .update({
          access_token: refreshData.access_token,
          token_expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', gbpConnection.id);
    }

    // Build the post payload
    const postPayload: Record<string, unknown> = {
      languageCode: 'en',
      summary: content,
      topicType: topicType,
    };

    if (callToAction) {
      postPayload.callToAction = {
        actionType: callToAction.type || 'LEARN_MORE',
        url: callToAction.url,
      };
    }

    // Create the post via GBP API
    const postsPath = accountName 
      ? `${accountName}/${locationId}/localPosts`
      : `${locationId}/localPosts`;

    console.log('Creating post at:', `https://mybusiness.googleapis.com/v4/${postsPath}`);

    const postResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/${postsPath}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postPayload),
      }
    );

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error('Post creation failed:', postResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to create post: ${errorText}` },
        { status: postResponse.status }
      );
    }

    const postData = await postResponse.json();
    console.log('Post created successfully:', postData.name);

    // Log the action (if seo_actions table exists)
    try {
      await supabase.from('seo_actions').insert({
        business_id: businessId,
        action_type: 'create_post',
        action_data: {
          content: content,
          topicType: topicType,
          postName: postData.name,
        },
        ai_generated: body.ai_generated || false,
        performed_at: new Date().toISOString(),
        result: 'success',
      });
    } catch (e) {
      // Table might not exist yet
      console.log('Could not log action (table may not exist)');
    }

    return NextResponse.json({
      success: true,
      post: postData,
    });

  } catch (error) {
    console.error('Post creation error:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}



