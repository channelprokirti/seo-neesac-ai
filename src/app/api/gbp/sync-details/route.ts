import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
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

// Create authenticated Supabase client that can bypass RLS
async function createAuthenticatedSupabase() {
  const { url, anonKey } = await getSupabaseFromCookie();
  if (!url || !anonKey) return null;
  
  const cookieStore = await cookies();
  
  return createServerClient(url, anonKey, {
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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    // Use authenticated client for database operations (respects RLS with user context)
    const supabase = await createAuthenticatedSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }
    
    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    console.log('Authenticated user:', user.id);

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    console.log('Business query:', { business, businessError, businessId });

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

    console.log('GBP Connection query:', { gbpConnection: gbpConnection ? 'found' : 'not found', gbpError });

    if (!gbpConnection?.access_token) {
      return NextResponse.json({ error: 'No GBP tokens found. Please reconnect your Google Business Profile.' }, { status: 401 });
    }

    let accessToken = gbpConnection.access_token;
    const locationId = gbpConnection.location_id;
    let accountName = gbpConnection.gbp_account_name; // e.g., "accounts/123456789"
    
    // Extract location number from location_id (e.g., "locations/123" -> "123")
    const locationNumber = locationId?.replace('locations/', '');

    // Check if token is expired and refresh if needed (MUST happen before any API calls)
    if (gbpConnection.token_expires_at && new Date(gbpConnection.token_expires_at) < new Date()) {
      console.log('Access token expired, attempting refresh...');
      
      if (!gbpConnection.refresh_token) {
        return NextResponse.json({ 
          error: 'GBP access token expired and no refresh token available. Please reconnect your Google Business Profile.',
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
      try {
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
        console.log('Token refresh response:', { ok: refreshResponse.ok, hasAccessToken: !!refreshData.access_token });

        if (!refreshResponse.ok || !refreshData.access_token) {
          console.error('Token refresh failed:', refreshData);
          return NextResponse.json({ 
            error: 'Failed to refresh access token. Please reconnect your Google Business Profile.',
            needsReconnect: true 
          }, { status: 401 });
        }

        // Update the access token
        accessToken = refreshData.access_token;

        // Save the new token to database
        await supabase
          .from('connected_gbp')
          .update({
            access_token: refreshData.access_token,
            token_expires_at: new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', gbpConnection.id);

        console.log('Access token refreshed and saved');
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError);
        return NextResponse.json({ 
          error: 'Failed to refresh access token. Please reconnect your Google Business Profile.',
          needsReconnect: true 
        }, { status: 401 });
      }
    }

    // If we don't have the account name stored, fetch it (AFTER token refresh)
    if (!accountName) {
      console.log('Account name not stored, fetching from API...');
      try {
        const accountsResponse = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          if (accountsData.accounts?.length > 0) {
            accountName = accountsData.accounts[0].name;
            console.log('Found account name:', accountName);
            
            // Save it for future use
            await supabase
              .from('connected_gbp')
              .update({ gbp_account_name: accountName })
              .eq('id', gbpConnection.id);
          }
        } else {
          console.error('Failed to fetch accounts:', await accountsResponse.text());
        }
      } catch (e) {
        console.error('Error fetching account name:', e);
      }
    }

    const results: {
      reviews?: unknown[];
      categories?: unknown;
      hours?: unknown;
      attributes?: unknown;
      photos?: unknown[];
      posts?: unknown[];
      products?: unknown[];
      services?: unknown[];
      questions?: unknown[];
      performance?: {
        totalInteractions?: number;
        calls?: number;
        directions?: number;
        websiteClicks?: number;
        bookings?: number;
        messageCount?: number;
        searchImpressions?: number;
        mapViews?: number;
        periodStart?: string;
        periodEnd?: string;
        timeSeries?: Record<string, Array<{date: string; value: number}>>;
      };
      description?: string;
      name?: string;
      phone?: string;
      website?: string;
      address?: unknown;
      error?: string;
    } = {};

    // Fetch reviews from GBP API with pagination to get ALL reviews
    // The correct endpoint format requires account name: accounts/{accountId}/locations/{locationId}/reviews
    try {
      const reviewsPath = accountName 
        ? `${accountName}/${locationId}/reviews`
        : `${locationId}/reviews`;
        
      console.log('Fetching reviews from:', `https://mybusiness.googleapis.com/v4/${reviewsPath}`);
      
      const allReviews: unknown[] = [];
      let nextPageToken: string | null = null;
      let pageCount = 0;
      const maxPages = 20; // Safety limit to prevent infinite loops
      
      do {
        const url = new URL(`https://mybusiness.googleapis.com/v4/${reviewsPath}`);
        url.searchParams.set('pageSize', '50'); // Max allowed per request
        if (nextPageToken) {
          url.searchParams.set('pageToken', nextPageToken);
        }
        
        const reviewsResponse = await fetch(url.toString(), { 
          headers: { Authorization: `Bearer ${accessToken}` } 
        });
        
        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json();
          if (reviewsData.reviews) {
            allReviews.push(...reviewsData.reviews);
          }
          nextPageToken = reviewsData.nextPageToken || null;
          pageCount++;
          console.log(`Reviews page ${pageCount}: fetched ${reviewsData.reviews?.length || 0}, total so far: ${allReviews.length}`);
        } else {
          const errorText = await reviewsResponse.text();
          console.error('Reviews fetch failed:', reviewsResponse.status, errorText);
          break;
        }
      } while (nextPageToken && pageCount < maxPages);
      
      results.reviews = allReviews;
      console.log('Total reviews fetched:', results.reviews?.length || 0);
    } catch (e) {
      console.error('Error fetching reviews:', e);
    }

    // Fetch location details (categories, hours, metadata with rating/review count)
    let googleAverageRating: number | null = null;
    let googleTotalReviewCount: number | null = null;
    
    try {
      const locationResponse = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=name,title,categories,regularHours,specialHours,moreHours,serviceArea,serviceItems,labels,adWordsLocationExtensions,latlng,openInfo,metadata,profile,relationshipData,storefrontAddress,websiteUri,phoneNumbers`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (locationResponse.ok) {
        const locationData = await locationResponse.json();
        console.log('=== LOCATION DATA ===');
        console.log('Has profile:', !!locationData.profile);
        console.log('Profile description:', locationData.profile?.description);
        console.log('Categories:', JSON.stringify(locationData.categories));
        
        // Extract core business info
        results.name = locationData.title;
        results.description = locationData.profile?.description || '';
        results.phone = locationData.phoneNumbers?.primaryPhone;
        results.website = locationData.websiteUri;
        results.address = locationData.storefrontAddress;
        results.categories = locationData.categories;
        results.hours = locationData.regularHours;
        results.attributes = {
          profile: locationData.profile,
          openInfo: locationData.openInfo,
          serviceItems: locationData.serviceItems,
          specialHours: locationData.specialHours,
          moreHours: locationData.moreHours,
        };
        
        // Google provides averageRating and totalReviewCount in metadata
        if (locationData.metadata) {
          console.log('Location metadata:', locationData.metadata);
        }
      } else {
        console.error('Location details fetch failed:', await locationResponse.text());
      }
    } catch (e) {
      console.error('Error fetching location details:', e);
    }

    // Get Google's official rating and review count from the reviews API
    // The v4 API returns totalReviewCount and averageRating in the reviews list response
    try {
      const reviewsPath = accountName 
        ? `${accountName}/${locationId}/reviews`
        : `${locationId}/reviews`;
      
      // Make a request to get the aggregate stats (returned with the list)
      const statsResponse = await fetch(
        `https://mybusiness.googleapis.com/v4/${reviewsPath}?pageSize=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        console.log('Reviews API response keys:', Object.keys(statsData));
        console.log('Reviews API full response:', JSON.stringify(statsData, null, 2).substring(0, 500));
        
        // Check various possible field names for the aggregate data
        // The API should return totalReviewCount and averageRating at the root level
        if (statsData.totalReviewCount !== undefined) {
          googleTotalReviewCount = statsData.totalReviewCount;
        } else if (statsData.total_review_count !== undefined) {
          googleTotalReviewCount = statsData.total_review_count;
        }
        
        if (statsData.averageRating !== undefined) {
          googleAverageRating = statsData.averageRating;
        } else if (statsData.average_rating !== undefined) {
          googleAverageRating = statsData.average_rating;
        }
        
        console.log('Google official stats - Rating:', googleAverageRating, 'Reviews:', googleTotalReviewCount);
      } else {
        console.error('Reviews stats fetch failed:', await statsResponse.text());
      }
    } catch (e) {
      console.error('Error fetching review stats:', e);
    }

    // Also try to get metrics from the location metadata endpoint
    // This provides official Google-calculated metrics
    try {
      const metricsPath = `https://mybusiness.googleapis.com/v4/${accountName}/${locationId}`;
      console.log('Fetching location metrics from:', metricsPath);
      
      const metricsResponse = await fetch(metricsPath, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        console.log('Location metrics response keys:', Object.keys(metricsData));
        
        // Check for rating in location data
        if (metricsData.metadata?.mapsUrl) {
          console.log('Maps URL:', metricsData.metadata.mapsUrl);
        }
        
        // Some APIs return rating directly on location object
        if (metricsData.starRating !== undefined && googleAverageRating === null) {
          googleAverageRating = metricsData.starRating;
        }
        if (metricsData.totalReviewCount !== undefined && googleTotalReviewCount === null) {
          googleTotalReviewCount = metricsData.totalReviewCount;
        }
      }
    } catch (e) {
      console.error('Error fetching location metrics:', e);
    }

    // Fetch media (photos) with pagination to get ALL photos
    try {
      const mediaPath = accountName 
        ? `${accountName}/${locationId}/media`
        : `${locationId}/media`;
        
      console.log('Fetching media from:', `https://mybusiness.googleapis.com/v4/${mediaPath}`);
      
      const allPhotos: unknown[] = [];
      let nextPageToken: string | null = null;
      let pageCount = 0;
      const maxPages = 20; // Safety limit
      
      do {
        const url = new URL(`https://mybusiness.googleapis.com/v4/${mediaPath}`);
        url.searchParams.set('pageSize', '100'); // Max allowed per request
        if (nextPageToken) {
          url.searchParams.set('pageToken', nextPageToken);
        }
        
        const mediaResponse = await fetch(url.toString(), { 
          headers: { Authorization: `Bearer ${accessToken}` } 
        });
        
        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json();
          if (mediaData.mediaItems) {
            allPhotos.push(...mediaData.mediaItems);
          }
          nextPageToken = mediaData.nextPageToken || null;
          pageCount++;
          console.log(`Photos page ${pageCount}: fetched ${mediaData.mediaItems?.length || 0}, total so far: ${allPhotos.length}`);
        } else {
          const errorText = await mediaResponse.text();
          console.error('Media fetch failed:', mediaResponse.status, errorText);
          break;
        }
      } while (nextPageToken && pageCount < maxPages);
      
      // Transform photos to include category at the root level for easier scoring
      results.photos = allPhotos.map((photo: unknown) => {
        const p = photo as { 
          name?: string; 
          mediaFormat?: string; 
          googleUrl?: string;
          locationAssociation?: { category?: string };
        };
        return {
          ...p,
          // GBP API puts category inside locationAssociation, extract it for scoring
          category: p.locationAssociation?.category,
        };
      });
      console.log('Total photos fetched:', results.photos?.length || 0);
      
      // Log photo categories for debugging
      const categories = results.photos.map((p: { category?: string }) => p.category).filter(Boolean);
      console.log('Photo categories found:', [...new Set(categories)]);
    } catch (e) {
      console.error('Error fetching media:', e);
    }

    // Fetch local posts
    try {
      const postsPath = accountName 
        ? `${accountName}/${locationId}/localPosts`
        : `${locationId}/localPosts`;
        
      console.log('Fetching posts from:', `https://mybusiness.googleapis.com/v4/${postsPath}`);
      
      const postsResponse = await fetch(
        `https://mybusiness.googleapis.com/v4/${postsPath}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        results.posts = postsData.localPosts || [];
        console.log('Posts fetched:', results.posts?.length || 0);
      } else {
        const errorText = await postsResponse.text();
        console.error('Posts fetch failed:', postsResponse.status, errorText);
      }
    } catch (e) {
      console.error('Error fetching posts:', e);
    }

    // Fetch products (if available for this business type)
    // Products in GBP are accessed via the Google My Business v4.9 API
    try {
      console.log('=== FETCHING PRODUCTS ===');
      let productsFetched = false;
      
      // Method 1: Try v4.9 API (products endpoint exists for service businesses)
      if (accountName) {
        // The correct endpoint format is: accounts/{accountId}/locations/{locationId}/products
        const accountId = accountName.replace('accounts/', '');
        const locationNumber = locationId?.replace('locations/', '');
        
        const productsUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationNumber}/products`;
        console.log('Method 1 - v4 products URL:', productsUrl);
        
        const productsResponse = await fetch(productsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          console.log('Products response:', JSON.stringify(productsData).substring(0, 1000));
          results.products = productsData.products || [];
          productsFetched = true;
          console.log('Products fetched:', results.products?.length || 0);
        } else {
          const errorText = await productsResponse.text();
          console.log('v4 products failed:', productsResponse.status, errorText.substring(0, 300));
        }
      }
      
      // Method 2: Try the newer Business Profile API products endpoint
      if (!productsFetched) {
        const locationNumber = locationId?.replace('locations/', '');
        const bpProductsUrl = `https://mybusinessproductcatalog.googleapis.com/v1/accounts/${accountName?.replace('accounts/', '')}/locations/${locationNumber}/products`;
        console.log('Method 2 - Business Profile Products Catalog URL:', bpProductsUrl);
        
        const bpProductsResponse = await fetch(bpProductsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (bpProductsResponse.ok) {
          const bpProductsData = await bpProductsResponse.json();
          console.log('BP Products response:', JSON.stringify(bpProductsData).substring(0, 1000));
          results.products = bpProductsData.products || bpProductsData.localProducts || [];
          productsFetched = true;
          console.log('Products fetched from BP API:', results.products?.length || 0);
        } else {
          const errorText = await bpProductsResponse.text();
          console.log('BP Products API failed:', bpProductsResponse.status, errorText.substring(0, 300));
        }
      }
      
      // Method 3: Try the local inventory/products endpoint (for retail)
      if (!productsFetched && accountName) {
        const accountId = accountName.replace('accounts/', '');
        const locationNumber = locationId?.replace('locations/', '');
        
        // Try the merchant products endpoint
        const merchantUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationNumber}/localPosts?filter=topicType=PRODUCT`;
        console.log('Method 3 - Looking for product posts:', merchantUrl);
        
        const merchantResponse = await fetch(merchantUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (merchantResponse.ok) {
          const merchantData = await merchantResponse.json();
          console.log('Product posts response:', JSON.stringify(merchantData).substring(0, 500));
          // Extract products from posts if they exist
          if (merchantData.localPosts) {
            const productPosts = merchantData.localPosts.filter(
              (post: { topicType?: string }) => post.topicType === 'PRODUCT'
            );
            if (productPosts.length > 0) {
              results.products = productPosts.map((post: { summary?: string; media?: Array<{ googleUrl?: string }> }) => ({
                name: post.summary,
                media: post.media,
              }));
              productsFetched = true;
              console.log('Products from posts:', results.products?.length || 0);
            }
          }
        }
      }
      
      if (!productsFetched) {
        console.log('Products not available via API - they may only be visible in the GBP dashboard');
        results.products = [];
      }
    } catch (e) {
      console.error('Error fetching products:', e);
      results.products = [];
    }

    // Fetch services - using multiple API approaches
    try {
      console.log('=== FETCHING SERVICES ===');
      let servicesFetched = false;
      let rawServices: unknown[] = [];
      
      // Method 1: Try the v4 API with full account path (most reliable)
      if (accountName) {
        const servicesPathV4 = `${accountName}/${locationId}/serviceList`;
        console.log('Method 1 - v4 API:', `https://mybusiness.googleapis.com/v4/${servicesPathV4}`);
        
        const servicesResponseV4 = await fetch(
          `https://mybusiness.googleapis.com/v4/${servicesPathV4}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (servicesResponseV4.ok) {
          const servicesData = await servicesResponseV4.json();
          console.log('Services v4 raw response:', JSON.stringify(servicesData).substring(0, 1500));
          
          // The response structure is: { serviceList: { services: [...] } } or { services: [...] }
          if (servicesData.serviceList?.services) {
            rawServices = servicesData.serviceList.services;
          } else if (servicesData.services) {
            rawServices = servicesData.services;
          } else if (Array.isArray(servicesData)) {
            rawServices = servicesData;
          }
          
          servicesFetched = rawServices.length > 0;
          console.log('Services fetched from v4:', rawServices.length);
        } else {
          console.log('v4 services failed:', servicesResponseV4.status, await servicesResponseV4.text().then(t => t.substring(0, 200)));
        }
      }
      
      // Method 2: Try the Business Profile API v1
      if (!servicesFetched) {
        const servicesUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}:getServiceList`;
        console.log('Method 2 - Business Profile API v1:', servicesUrl);
        
        const servicesResponse = await fetch(servicesUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (servicesResponse.ok) {
          const servicesData = await servicesResponse.json();
          console.log('Services v1 raw response:', JSON.stringify(servicesData).substring(0, 1500));
          
          if (servicesData.serviceList?.services) {
            rawServices = servicesData.serviceList.services;
          } else if (servicesData.services) {
            rawServices = servicesData.services;
          }
          
          servicesFetched = rawServices.length > 0;
          console.log('Services fetched from v1:', rawServices.length);
        } else {
          console.log('v1 services failed:', servicesResponse.status);
        }
      }
      
      // Method 3: Check if serviceItems from location data has services
      if (!servicesFetched) {
        const attrs = results.attributes as { serviceItems?: unknown[] } | undefined;
        if (attrs?.serviceItems && Array.isArray(attrs.serviceItems) && attrs.serviceItems.length > 0) {
          rawServices = attrs.serviceItems;
          servicesFetched = true;
          console.log('Using serviceItems from location data:', rawServices.length);
        }
      }
      
      // Normalize service data structure - extract actual names and descriptions
      // Services come in complex structures: structuredServiceItem or freeFormServiceItem
      results.services = rawServices.map((svc: unknown) => {
        const service = svc as {
          structuredServiceItem?: { 
            serviceTypeId?: string; 
            description?: string;
          };
          freeFormServiceItem?: { 
            category?: string;
            label?: { 
              displayName?: string; 
              description?: string;
              languageCode?: string;
            };
          };
          serviceName?: string;
          displayName?: string;
          description?: string;
          price?: unknown;
        };
        
        // Try to extract the service name from various possible fields
        let serviceName = 'Unknown Service';
        let serviceDescription = '';
        
        if (service.freeFormServiceItem?.label?.displayName) {
          serviceName = service.freeFormServiceItem.label.displayName;
          serviceDescription = service.freeFormServiceItem.label.description || '';
        } else if (service.structuredServiceItem?.serviceTypeId) {
          // Format the serviceTypeId to a readable name
          // e.g., "job_type_id:branding" -> "Branding"
          // e.g., "job_type_id:search_engine_optimization" -> "Search Engine Optimization"
          serviceName = service.structuredServiceItem.serviceTypeId
            .replace(/^job_type_id:/i, '') // Remove "job_type_id:" prefix
            .replace(/_/g, ' ') // Replace underscores with spaces
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          serviceDescription = service.structuredServiceItem.description || '';
        } else if (service.displayName) {
          serviceName = service.displayName;
          serviceDescription = service.description || '';
        } else if (service.serviceName) {
          serviceName = service.serviceName;
          serviceDescription = service.description || '';
        }
        
        return {
          serviceName,
          description: serviceDescription,
          price: service.price,
          raw: service, // Keep raw data for debugging
        };
      });
      
      console.log('Normalized services:', results.services?.length || 0);
      if (results.services && results.services.length > 0) {
        console.log('Sample service:', JSON.stringify(results.services[0]));
      }
      
      if (!servicesFetched) {
        console.log('No services found from any endpoint');
        results.services = [];
      }
    } catch (e) {
      console.error('Error fetching services:', e);
      results.services = [];
    }

    // Fetch Q&A (questions)
    try {
      const questionsPath = accountName 
        ? `${accountName}/${locationId}/questions`
        : `${locationId}/questions`;
        
      console.log('Fetching questions from:', `https://mybusiness.googleapis.com/v4/${questionsPath}`);
      
      const questionsResponse = await fetch(
        `https://mybusiness.googleapis.com/v4/${questionsPath}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json();
        results.questions = questionsData.questions || [];
        console.log('Questions fetched:', results.questions?.length || 0);
      } else {
        console.log('Questions fetch failed');
      }
    } catch (e) {
      console.error('Error fetching questions:', e);
    }

    // Fetch Performance/Insights data
    try {
      console.log('=== FETCHING PERFORMANCE DATA ===');
      
      // Calculate date range for last 6 months
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);
      
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      
      // Method 1: Fetch each metric separately using fetchMultiDailyMetricsTimeSeries (POST)
      // This is the correct endpoint that returns actual values
      const fetchMetricsUrl = `https://businessprofileperformance.googleapis.com/v1/${locationId}:fetchMultiDailyMetricsTimeSeries`;
      
      console.log('Fetching performance metrics from:', fetchMetricsUrl);
      
      const metricsBody = {
        dailyMetrics: [
          'WEBSITE_CLICKS',
          'CALL_CLICKS', 
          'BUSINESS_DIRECTION_REQUESTS',
          'BUSINESS_BOOKINGS',
          'BUSINESS_CONVERSATIONS',
          'BUSINESS_FOOD_ORDERS'
        ],
        dailyRange: {
          startDate: { 
            year: startDate.getFullYear(), 
            month: startDate.getMonth() + 1, 
            day: startDate.getDate() 
          },
          endDate: { 
            year: endDate.getFullYear(), 
            month: endDate.getMonth() + 1, 
            day: endDate.getDate() 
          }
        }
      };
      
      console.log('Request body:', JSON.stringify(metricsBody));
      
      const metricsResponse = await fetch(fetchMetricsUrl, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metricsBody)
      });
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        console.log('Performance metrics response:', JSON.stringify(metricsData).substring(0, 2000));
        
        let totalCalls = 0;
        let totalDirections = 0;
        let totalWebsiteClicks = 0;
        let totalBookings = 0;
        let totalConversations = 0;
        
        // Store time series data for charts
        const timeSeriesData: Record<string, Array<{date: string; value: number}>> = {};
        
        // Parse multiDailyMetricTimeSeries response
        if (metricsData.multiDailyMetricTimeSeries) {
          for (const metricSeries of metricsData.multiDailyMetricTimeSeries) {
            const metricName = metricSeries.dailyMetric;
            const values = metricSeries.dailyMetricTimeSeries?.timeSeries?.datedValues || [];
            
            const seriesData: Array<{date: string; value: number}> = [];
            let metricSum = 0;
            
            for (const entry of values) {
              const value = entry.value ? (typeof entry.value === 'string' ? parseInt(entry.value, 10) : entry.value) : 0;
              metricSum += value;
              
              if (entry.date) {
                const dateStr = `${entry.date.year}-${String(entry.date.month).padStart(2, '0')}-${String(entry.date.day).padStart(2, '0')}`;
                seriesData.push({ date: dateStr, value });
              }
            }
            
            timeSeriesData[metricName] = seriesData;
            console.log(`Metric ${metricName}: total = ${metricSum}, data points = ${seriesData.length}`);
            
            switch (metricName) {
              case 'WEBSITE_CLICKS': totalWebsiteClicks = metricSum; break;
              case 'CALL_CLICKS': totalCalls = metricSum; break;
              case 'BUSINESS_DIRECTION_REQUESTS': totalDirections = metricSum; break;
              case 'BUSINESS_BOOKINGS': totalBookings = metricSum; break;
              case 'BUSINESS_CONVERSATIONS': totalConversations = metricSum; break;
            }
          }
        }
        
        results.performance = {
          totalInteractions: totalCalls + totalDirections + totalWebsiteClicks + totalBookings + totalConversations,
          calls: totalCalls,
          directions: totalDirections,
          websiteClicks: totalWebsiteClicks,
          bookings: totalBookings,
          messageCount: totalConversations,
          periodStart: formatDate(startDate),
          periodEnd: formatDate(endDate),
          timeSeries: timeSeriesData,
        } as typeof results.performance & { timeSeries?: Record<string, Array<{date: string; value: number}>> };
        
        console.log('Performance data:', {
          ...results.performance,
          timeSeries: timeSeriesData ? `${Object.keys(timeSeriesData).length} metrics with time series` : 'none'
        });
      } else {
        const errorText = await metricsResponse.text();
        console.log('fetchMultiDailyMetricsTimeSeries failed:', metricsResponse.status, errorText.substring(0, 500));
        
        // Method 2: Try GET endpoint with single metric at a time
        console.log('Trying individual metric fetches...');
        
        let totalCalls = 0;
        let totalDirections = 0;
        let totalWebsiteClicks = 0;
        let totalBookings = 0;
        
        // Store time series data for charts
        const timeSeriesData: Record<string, Array<{date: string; value: number}>> = {};
        
        for (const metric of ['WEBSITE_CLICKS', 'CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'BUSINESS_BOOKINGS']) {
          const singleMetricUrl = `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries?dailyMetric=${metric}&dailyRange.startDate.year=${startDate.getFullYear()}&dailyRange.startDate.month=${startDate.getMonth() + 1}&dailyRange.startDate.day=${startDate.getDate()}&dailyRange.endDate.year=${endDate.getFullYear()}&dailyRange.endDate.month=${endDate.getMonth() + 1}&dailyRange.endDate.day=${endDate.getDate()}`;
          
          const singleResponse = await fetch(singleMetricUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          
          if (singleResponse.ok) {
            const singleData = await singleResponse.json();
            console.log(`Single metric ${metric} response:`, JSON.stringify(singleData).substring(0, 500));
            
            // Parse the response - values might be at different levels
            let metricSum = 0;
            const values = singleData.timeSeries?.datedValues || 
                          singleData.dailyMetricTimeSeries?.timeSeries?.datedValues || 
                          [];
            
            // Store time series for charts
            const seriesData: Array<{date: string; value: number}> = [];
            
            for (const entry of values) {
              const value = entry.value ? (typeof entry.value === 'string' ? parseInt(entry.value, 10) : entry.value) : 0;
              metricSum += value;
              
              // Store each data point for charts
              if (entry.date) {
                const dateStr = `${entry.date.year}-${String(entry.date.month).padStart(2, '0')}-${String(entry.date.day).padStart(2, '0')}`;
                seriesData.push({ date: dateStr, value });
              }
            }
            
            timeSeriesData[metric] = seriesData;
            console.log(`Metric ${metric}: ${metricSum} (${seriesData.length} data points)`);
            
            switch (metric) {
              case 'WEBSITE_CLICKS': totalWebsiteClicks = metricSum; break;
              case 'CALL_CLICKS': totalCalls = metricSum; break;
              case 'BUSINESS_DIRECTION_REQUESTS': totalDirections = metricSum; break;
              case 'BUSINESS_BOOKINGS': totalBookings = metricSum; break;
            }
          }
        }
        
        results.performance = {
          totalInteractions: totalCalls + totalDirections + totalWebsiteClicks + totalBookings,
          calls: totalCalls,
          directions: totalDirections,
          websiteClicks: totalWebsiteClicks,
          bookings: totalBookings,
          periodStart: formatDate(startDate),
          periodEnd: formatDate(endDate),
          timeSeries: timeSeriesData,
        };
        
        console.log('Performance data from individual fetches:', {
          ...results.performance,
          timeSeries: `${Object.keys(timeSeriesData).length} metrics with time series`
        });
      }
    } catch (e) {
      console.error('Error fetching performance data:', e);
    }

    // Calculate rating distribution from fetched reviews
    const ratingDistribution: Record<string, number> = { FIVE: 0, FOUR: 0, THREE: 0, TWO: 0, ONE: 0 };
    let calculatedRating = 0;
    let fetchedReviewsCount = 0;
    
    if (results.reviews && Array.isArray(results.reviews)) {
      fetchedReviewsCount = results.reviews.length;
      const ratingMap: Record<string, number> = { FIVE: 5, FOUR: 4, THREE: 3, TWO: 2, ONE: 1 };
      let totalScore = 0;
      
      for (const review of results.reviews as Array<{ starRating?: string }>) {
        const rating = review.starRating || 'FIVE';
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        totalScore += ratingMap[rating] || 5;
      }
      
      calculatedRating = fetchedReviewsCount > 0 ? Math.round((totalScore / fetchedReviewsCount) * 10) / 10 : 0;
    }

    // Try Google Places API as fallback (if configured and we have a Place ID)
    // Places API definitely returns the official rating and review count
    if ((googleAverageRating === null || googleTotalReviewCount === null) && business.google_place_id) {
      try {
        // Check if Places API key is configured
        const storedGoogle = typeof localStorage !== 'undefined' 
          ? null // Can't access localStorage in server
          : null;
        
        // Try getting Places API key from request or environment
        const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
        
        if (placesApiKey) {
          console.log('Trying Google Places API for official rating...');
          const placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${business.google_place_id}&fields=rating,user_ratings_total&key=${placesApiKey}`;
          
          const placesResponse = await fetch(placesUrl);
          if (placesResponse.ok) {
            const placesData = await placesResponse.json();
            if (placesData.result) {
              if (placesData.result.rating !== undefined && googleAverageRating === null) {
                googleAverageRating = placesData.result.rating;
                console.log('Places API rating:', googleAverageRating);
              }
              if (placesData.result.user_ratings_total !== undefined && googleTotalReviewCount === null) {
                googleTotalReviewCount = placesData.result.user_ratings_total;
                console.log('Places API review count:', googleTotalReviewCount);
              }
            }
          }
        }
      } catch (e) {
        console.error('Error fetching from Places API:', e);
      }
    }

    // Use Google's official values if available, otherwise use calculated
    const averageRating = googleAverageRating !== null ? googleAverageRating : calculatedRating;
    const totalReviews = googleTotalReviewCount !== null ? googleTotalReviewCount : fetchedReviewsCount;
    
    console.log('=== FINAL VALUES ===');
    console.log('Rating:', averageRating, '(Google API:', googleAverageRating, ', Calculated from reviews:', calculatedRating, ')');
    console.log('Reviews:', totalReviews, '(Google API:', googleTotalReviewCount, ', Fetched count:', fetchedReviewsCount, ')');
    console.log('Photos:', results.photos?.length || 0);

    // Build the complete GBP data object
    const gbpData = {
      ...results,
      // Core business info
      name: results.name,
      description: results.description,
      phone: results.phone,
      website: results.website,
      address: results.address,
      // Metrics
      averageRating,
      totalReviews,
      ratingDistribution,
      totalPhotos: results.photos?.length || 0,
      totalPosts: results.posts?.length || 0,
      totalProducts: results.products?.length || 0,
      totalServices: results.services?.length || 0,
      totalQuestions: results.questions?.length || 0,
      syncedAt: new Date().toISOString(),
    };
    
    console.log('=== GBP DATA SUMMARY ===');
    console.log('Description:', gbpData.description ? `${gbpData.description.substring(0, 50)}...` : 'MISSING');
    console.log('Products:', gbpData.totalProducts);
    console.log('Services:', gbpData.totalServices);
    console.log('Photos:', gbpData.totalPhotos);

    // Save GBP data to the businesses table for persistence
    console.log('Saving GBP data to database for business:', businessId);
    console.log('Data to save - averageRating:', gbpData.averageRating, 'totalReviews:', gbpData.totalReviews);
    
    const { data: updateData, error: updateError } = await supabase
      .from('businesses')
      .update({ 
        gbp_data: gbpData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)
      .select('id, gbp_data')
      .single();

    if (updateError) {
      console.error('=== DATABASE UPDATE FAILED ===');
      console.error('Error:', updateError);
      console.error('This might be an RLS policy issue');
    } else {
      console.log('=== DATABASE UPDATE SUCCESS ===');
      console.log('Saved data - averageRating:', updateData?.gbp_data?.averageRating, 'totalReviews:', updateData?.gbp_data?.totalReviews);
    }

    return NextResponse.json({
      success: true,
      businessId,
      locationId,
      data: gbpData,
    });

  } catch (error) {
    console.error('GBP sync error:', error);
    return NextResponse.json({ error: 'Failed to sync GBP data' }, { status: 500 });
  }
}

